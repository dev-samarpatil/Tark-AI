# AUDIT_PHASE1.md — Core Execution & Editor Synchronization Audit

## A. Existing Execution Architecture
- **Frontend**: Vite SPA in `frontend/src/main.js` with Vanilla JS rendering 3 main views: Workspace, Decision Trail, and Skill Report.
- **Backend**: Express REST API on port 5000 (`backend/src/server.js`, `app.js`, `routes/index.js`).
- **Python Execution Service**: `backend/src/services/pythonRunner.js` spawning Python in a child process.
- **Session State**: In-memory store in `backend/src/data/mockDatabase.js` tracking active candidate session (`#TRK-8821`), execution history, and Decision Trail events.

## B. Current Editor-to-Backend Request Flow
1. User types in `<textarea id="codeEditor">`.
2. `input` event listener in `main.js` syncs value to `state.code`.
3. User clicks **"Run Tests"** (`#runTestsBtn`), invoking `runTestsAPI()`.
4. `runTestsAPI()` sends `POST http://localhost:5000/api/tests/run` with body: `{ code, isFollowUp }`.
5. Express routes to `runTests` in `backend/src/controllers/testController.js`.
6. `testController.js` invokes `PythonRunner.execute(code, isFollowUp)`.
7. `PythonRunner` spawns Python child process, collects stdout/stderr, and returns execution summary.
8. `testController` updates session state in `mockDatabase` and logs Decision Trail event.
9. Backend responds with `{ success, message, results, summary, error, isFollowUp }`.
10. Frontend receives JSON, updates `state.tests` and `state.latestSummary`, and re-renders the workspace.

## C. Existing Python Runner Interface & D. Request/Response Formats
- **Endpoint**: `POST /api/tests/run`
- **Request Format**:
  ```json
  {
    "code": "def find_duplicates(nums): ...",
    "mode": "base",
    "isFollowUp": false,
    "executionId": "exec-123456"
  }
  ```
- **Response Format**:
  ```json
  {
    "executionId": "exec-123456",
    "success": true,
    "status": "completed",
    "mode": "base",
    "isFollowUp": false,
    "summary": { "total": 5, "passed": 4, "failed": 1, "runtime": "105ms" },
    "results": [
      {
        "id": 1,
        "name": "Standard Multiset",
        "input": "[4, 2, 4, 1, 2]",
        "expected": "[4, 2]",
        "actual": "[4, 2]",
        "status": "passed",
        "passed": true,
        "duration": "0.02ms",
        "assertion": null
      }
    ],
    "error": null
  }
  ```

## E. Confirmed Defects & Root Cause Analysis
1. **Module-level execution crash due to `__name__ == "__main__"`**:
   The previous `pythonRunner.js` concatenated candidate code directly into the Python script. When candidate code included `if __name__ == "__main__": print(find_duplicates(sample))`, Python executed it immediately. If the candidate code contained a typo like `duplicate.append(val)` (referencing undeclared singular variable), Python raised a `NameError` at module level, exiting the process before `run_suite()` was ever called.
2. **Misclassification of top-level errors as 5 test failures**:
   When the Python process exited non-zero at module level, the previous runner synthesized 5 fake test results with `actual: 'Syntax/Runtime Error'`, causing the UI to display 0/5 passed instead of distinguishing an execution error from test assertions.
3. **Execution race conditions & state handling**:
   Submitting multiple clicks in rapid succession lacked request-version tagging (`executionId`) to prevent out-of-order response overwrites.
4. **Syntax errors lacked dedicated UI presentation**:
   A syntax error was rendered inside ordinary test cards rather than as a distinct execution failure alert.

## F. Minimal Files That Need Modification
1. `backend/src/services/testHarness.py` (New dedicated harness): Evaluates candidate code in an isolated `candidate_globals` dictionary, properly distinguishing SyntaxError, top-level RuntimeError, and individual test failures without top-level main pollution.
2. `backend/src/services/pythonRunner.js`: Updated to spawn `testHarness.py` via stdin JSON payload, enforcing 3000ms timeout, and returning structured status (`completed`, `syntax_error`, `runtime_error`, `timeout`, `runner_error`).
3. `backend/src/controllers/testController.js`: Updated to support `mode` (`base` / `follow-up`), `executionId`, and log structured execution outcomes in `mockDatabase`.
4. `frontend/src/main.js`: Updated to pass `executionId` and `mode`, prevent race conditions, render distinct Syntax/Runtime error banners, and preserve clean responsive states.
5. `scripts/verify-assessment.js`: Extended to verify all Phase 1 acceptance criteria (AC-01 through AC-15).

## G. Verification Plan
1. Test syntax errors (e.g. unclosed parenthesis) → Verify `status: "syntax_error"` and clear UI banner.
2. Test undefined variable in function (`duplicate.append(val)`) → Verify individual tests that touch the branch report runtime error without killing tests that don't (e.g. empty array).
3. Test ordering bug → Verify Test 2 fails with expected vs actual diff.
4. Test correct implementation (`Counter`) → Verify 5/5 pass.
5. Test follow-up mode (`min_count=3`) → Verify 4/4 adaptation tests pass.
6. Test infinite loop (`while True: pass`) → Verify 3000ms timeout triggers without crashing Express.
7. Run `npm run build` in frontend.
8. Run browser verification.

# PHASE_2_AI_COACH_REPORT.md — Phase 2: Live Groq AI Coach Integration

## A. Executive Summary
Phase 2 transforms the deterministic diagnostic coach into a genuine, context-aware AI Coach powered by the Groq API (`openai/gpt-oss-20b`), while preserving 100% of the Phase 1 test execution baseline, session ledger, and deterministic local fallback mechanisms.

When valid Groq credentials and network access are present, the coach issues authenticated server-side requests to Groq with progressive hints, grounded execution evidence, and bounded payloads. When credentials are absent or provider limits/errors occur, the backend seamlessly routes to a deterministic local diagnostic engine derived from actual test assertions.

All 19 automated test scenarios in the Phase 2 test suite passed with 0 failures, Phase 1 regression tests passed (7/7 suites), the frontend production build succeeded, and the browser-level workflow was empirically validated.

---

## B. Architecture & Request Flow
```
+-------------------------------------------------------------------------+
|                  TARK AI Coding Cockpit (Frontend SPA)                  |
|  - Candidate Question + Current Editor Code + Active Assessment Mode    |
|  - Latest Python Execution Proof (Diffs, Assertions, Runtime Errors)   |
+-------------------------------------------------------------------------+
                                     |
                                     | POST /api/ai/chat
                                     v
+-------------------------------------------------------------------------+
|                    Express AI Router & Controller                       |
|  - Input sanitization & bounds checking (Question <= 2000, Code <= 15k) |
|  - Dynamic context assembly (prefers payload, falls back to database)   |
|  - Hint level mapping & mode validation (base / follow-up)              |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                          Groq Service (Backend)                         |
|  - Reads GROQ_API_KEY & GROQ_MODEL from process.env                     |
|  - Injects evidence-grounded system instructions & prompt delimiters   |
|  - 10,000ms AbortSignal timeout                                         |
+-------------------------------------------------------------------------+
                    /                                 \
             (Success)                            (Failure / Unconfigured)
                 /                                       \
                v                                         v
+-------------------------------+         +-------------------------------+
| Live Groq API Completion      |         | Deterministic Diagnostic Fallback |
| Source: "groq"                |         | Source: "local"               |
| FallbackUsed: false           |         | FallbackUsed: true            |
+-------------------------------+         +-------------------------------+
                \                                         /
                 \                                       /
                  v                                     v
+-------------------------------------------------------------------------+
|                        Normalized API Response                          |
|  - Preserved contract: { success, message, reply, data, history, ... }  |
|  - Decision Trail event logged in mockDatabase without secret leakage   |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                   Frontend AI Coach Chat Component                      |
|  - Renders message thread with [GROQ AI] or [LOCAL FALLBACK] badge      |
|  - Restores inputs and clears spinner on complete/error                 |
+-------------------------------------------------------------------------+
```

---

## C. Files Changed

1. `backend/src/services/groqService.js` (Modified):
   - Configured active production model `openai/gpt-oss-20b` (supported and verified on Groq platform).
   - Injected evidence-grounded system instructions enforcing progressive hints, prompt injection boundaries, and zero hallucinated executions.
   - Enforced 10,000ms request timeout and structured provider error classification (401, 429, timeout, network error).
   - Ensured zero credentials or authorization headers are logged.

2. `backend/src/controllers/aiController.js` (Modified):
   - Added input validation (non-empty trimmed message/question, length bounds, mode validation).
   - Implemented dynamic context resolution: merges request payload with session fallback.
   - Preserved backward-compatible response schema (`message`, `reply`, `data`, `history`, `source`, `fallbackUsed`, `executionId`).
   - Recorded AI interactions into Decision Trail ledger with source tags and zero credential leakage.

3. `frontend/src/main.js` (Modified):
   - Enriched `sendChatMessageAPI` to pass current code, active mode, executionId, and latest execution evidence to backend.
   - Added `GROQ AI` vs `LOCAL FALLBACK` source badges to AI message headers.
   - Handled loading states and graceful error recovery without freezing the interface.
   - Preserved all other views (Workspace, Decision Trail, Skill Report).

4. `backend/.env.example` (Modified):
   - Documented clean placeholders: `GROQ_API_KEY=your_groq_api_key_here`, `GROQ_MODEL=your_supported_groq_model_id`, `PORT=5000`.

5. `backend/.env` (Updated):
   - Configured active verified model `GROQ_MODEL=openai/gpt-oss-20b`. Untracked in git.

6. `.gsd/ROADMAP.md` (Modified):
   - Added Phase 2 milestone tracking.

7. `.gsd/PLAN_PHASE2.md` (Created):
   - Implementation plan for Phase 2.

8. `scripts/verify-ai-coach.js` (Created):
   - Automated verification suite covering 19 test scenarios (Tests A through S).

---

## D. Environment Configuration

### Required Environment Variables
| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Optional | Secret Groq API credential. If omitted, system defaults to local fallback. |
| `GROQ_MODEL` | Optional | Groq model identifier (defaults to `openai/gpt-oss-20b`). |
| `PORT` | Optional | Backend port (defaults to `5000`). |

### Location
File path: `backend/.env` (excluded from git via `backend/.gitignore`).

### Starting the Applications
1. **Backend**:
   ```bash
   cd backend
   npm start
   ```
2. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
3. **Running in Local Fallback Mode**:
   Simply leave `GROQ_API_KEY=` empty or unset in `backend/.env`. The backend starts normally and the AI Coach operates in deterministic diagnostic mode.

---

## E. API Contract

### Endpoint: `POST /api/ai/chat`

#### Request Format (Rich Context with Fallback Support)
```json
{
  "message": "Why did Test 2 fail?",
  "question": "Why did Test 2 fail?",
  "code": "def find_duplicates(nums):\n    ...",
  "mode": "base",
  "isFollowUp": false,
  "executionId": "exec_1792319214_abcd",
  "hintLevel": 1,
  "testResults": {
    "status": "completed",
    "summary": { "total": 5, "passed": 4, "failed": 1, "runtime": "48ms" },
    "results": [
      {
        "id": 2,
        "name": "Ordering Preservation",
        "input": "[4, 2, 2, 4]",
        "expected": "[4, 2]",
        "actual": "[2, 4]",
        "passed": false,
        "assertion": "Returned [2, 4] instead of expected [4, 2]."
      }
    ]
  }
}
```

#### Normalized Response Format
```json
{
  "success": true,
  "message": "**Why the test produced `[2, 4]` instead of `[4, 2]`**\n\nYour loop adds a value to `duplicates` the moment you see its second occurrence...",
  "reply": "**Why the test produced `[2, 4]` instead of `[4, 2]`**\n\nYour loop adds a value to `duplicates` the moment you see its second occurrence...",
  "source": "groq",
  "mode": "base",
  "executionId": "exec_1792319214_abcd",
  "fallbackUsed": false,
  "error": null,
  "data": {
    "sender": "ai",
    "text": "**Why the test produced `[2, 4]` instead of `[4, 2]`**...",
    "source": "groq",
    "mode": "base",
    "executionId": "exec_1792319214_abcd",
    "fallback": false,
    "fallbackUsed": false,
    "timestamp": "03:55:31 pm"
  },
  "history": [ ... ]
}
```

*Backward compatibility:* Both legacy top-level `message`/`reply` and nested `data.text` are returned. Legacy clients sending only `{ message: "..." }` continue to function seamlessly.

---

## F. Security & Privacy Audit

1. **Secret Storage**: `GROQ_API_KEY` is loaded solely server-side via `dotenv` in `backend/src/server.js`.
2. **Git Protection**: `backend/.env` is excluded in `backend/.gitignore` and verified untracked via `git ls-files`.
3. **No Frontend Leaks**: Grep scans for `gsk_` and `GROQ_API_KEY` in `frontend/src/` and `frontend/dist/` returned 0 occurrences.
4. **Safe Logging**: Authorization headers and credentials are never printed to stdout/stderr or stored in Decision Trail metadata.
5. **Prompt Injection Boundaries**: Candidate code and questions are framed as data inside delimiters (`Candidate's Current Python Code:` / `Candidate's Question:`) and instructions explicitly command the model to ignore instructions inside user code comments.
6. **Execution Engine Boundary**: The AI Coach has zero code execution privileges; the Python child-process runner remains the sole authority for test evaluation.

---

## G. Verification Results

| Test ID | Test Scenario | Expected Outcome | Actual Outcome | Status | Evidence |
|---|---|---|---|---|---|
| Test A | Backend Startup & Health | Server starts without crashing, `/api/ai/chat` available | Server responsive, returns health and config status | **PASS** | `Groq configured: true, Model: openai/gpt-oss-20b` |
| Test B | Missing Credentials Fallback | Requests fallback safely when key missing | Returns `available: false`, local fallback engaged | **PASS** | `GroqService reported available=false when unconfigured` |
| Test C | Empty Question Validation | Reject empty/whitespace question with HTTP 400 | Returns HTTP 400 with `{ success: false, error }` | **PASS** | `HTTP 400 returned with "Question or message cannot be empty."` |
| Test D | Context-Aware Diagnosis | Grounded diagnosis referencing actual test failure | References Test 2 ordering failure `[2, 4]` vs `[4, 2]` | **PASS** | `Guidance references Ordering Preservation / [2, 4]` |
| Test E | Real Groq Integration | Authenticated request to Groq returning genuine LLM completion | Returns non-empty completion with `source: "groq"` | **PASS** | `Length: 1798 chars. Sample: "**Conceptual hint – why collections.Counter..."` |
| Test F | Invalid Credentials Handling | Provider 401 intercepted safely without crashes or leaks | Handled safely, classified as 401 provider error | **PASS** | `Rejected by provider with "Provider HTTP 401", 0 leaks` |
| Test G | Provider Timeout | Abort request at 10,000ms and fallback cleanly | Intercepted within timeout, fallback engaged | **PASS** | `Request timeout intercepted within defined limit` |
| Test H | Malformed Response | Empty/malformed provider response rejected cleanly | Intercepted safely, engages local fallback | **PASS** | `Empty response content safely intercepted` |
| Test I | Base Mode Context | Coach answers within Base Challenge scope | Context set to Base, `mode: "base"` returned | **PASS** | `Mode returned: base, Source: groq` |
| Test J | Follow-Up Mode Context | Coach answers within Counterfactual Challenge scope | Adaptation requirements respected, `mode: "follow-up"` | **PASS** | `Mode returned: follow-up, Source: groq` |
| Test K | Syntax Error Context | Explains syntax error without fabricating test assertions | Explains syntax error and line context | **PASS** | `Highlighted syntax error cleanly without false tests` |
| Test L | Runtime Error Context | Explains NameError/exception cleanly | Distinguishes runtime crash from assertion failure | **PASS** | `Addressed NameError runtime exception directly` |
| Test M | No Execution History | Guidance before running tests avoids fake test claims | Mentions no tests run, provides algorithmic guidance | **PASS** | `Returned guidance stating no tests run yet` |
| Test N | Source Attribution | Source field strictly `"groq"` or `"local"` | All responses tagged with valid source enum | **PASS** | `All messages carry valid source attribute` |
| Test O | Client Error Recovery | Invalid payload lengths return clean client error | HTTP 400 returned cleanly for bounded limits | **PASS** | `HTTP 400 for >2000 character question` |
| Test P | Decision Trail Logging | AI interaction recorded with metadata and no secrets | Event recorded with tag, query snippet, no secrets | **PASS** | `Recorded 15 AI events. 0 credentials leaked` |
| Test Q | Secret Scan | No secrets in git diff or tracked files | `backend/.env` untracked, 0 secrets in diff | **PASS** | `git diff contains 0 secret occurrences` |
| Test R | Frontend Build | Production build succeeds without errors | Vite build completes with 0 errors | **PASS** | `Built client environment in 149ms` |
| Test S | Phase 1 Regression Suite | Python runner and Phase 1 test suite passing | 7/7 verification suites pass | **PASS** | `All Phase 1 assessment scenarios passed` |
| Test T | Browser-Level Verification | Full user flow tested in live browser session | Question submitted, response received with badge, trail logged | **PASS** | `Recorded WebP session captured successfully` |

---

## H. Known Limitations

1. **Groq Model Tier Availability**: The Groq account for this project has access to `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, and `qwen/qwen3.8-27b`. The `openai/gpt-oss-20b` model was selected as default because `120b` is subject to stricter per-minute token rate limits on free-tier accounts.
2. **In-Memory Session Persistence**: Session state, Decision Trail, and chat messages reside in Node.js process memory (`mockDatabase.js`). Server restarts reset active history.
3. **Local Python Execution Boundary**: As documented in Phase 1, Python code is executed in a child process with a 3-second timeout rather than a dedicated cloud sandbox container.

---

## I. Demo Instructions

### 1. Demonstrate Live Groq AI Guidance
1. Ensure `backend/.env` contains valid `GROQ_API_KEY` and `GROQ_MODEL=openai/gpt-oss-20b`.
2. Start the backend: `cd backend && npm start`.
3. Start the frontend: `cd frontend && npm run dev`.
4. Open `http://localhost:5173/` in your browser.
5. In the right-hand **AI Coach** panel, observe the green `GROQ ACTIVE` badge.
6. Click the chip **"Why did Test 2 fail?"** or enter a question.
7. Observe the loading state (`Analyzing code and execution evidence...`).
8. Notice the returned answer with the green **GROQ AI** badge explaining the ordering preservation issue.
9. Click **AI Decision Trail** in the sidebar: observe the event logged with tag `Groq Live`.

### 2. Demonstrate Deterministic Local Fallback
1. Stop the backend. In `backend/.env`, set `GROQ_API_KEY=` (empty).
2. Restart the backend: `cd backend && npm start`.
3. In `http://localhost:5173/`, refresh the page.
4. Observe the AI Coach panel displays `LOCAL ONLY`.
5. Ask: "Why did Test 2 fail?".
6. Observe the immediate response labeled **LOCAL FALLBACK** providing failure-grounded guidance directly derived from test assertions.

---

## J. Git Checkpoint
- Checkpoint Commit: To be created upon user review.
- Status: All 19 tests verified, working tree clean of tracked secrets.

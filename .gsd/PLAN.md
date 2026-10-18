# PLAN.md — Tark AI Implementation Plan

## Phase 1: Python Runner Service & Test Execution API

<task type="auto" effort="medium">
  <name>Create Python Runner Service</name>
  <files>backend/src/services/pythonRunner.js</files>
  <action>
    Implement an isolated Python executor that:
    1. Spawns `python` as a separate child process (`child_process.spawn`).
    2. Enforces a 3000ms execution timeout to guard against infinite loops.
    3. Injects the candidate's code alongside a deterministic test harness for:
       - Base challenge: `find_duplicates(nums: List[int]) -> List[int]`
       - Follow-up challenge: `find_duplicates(nums: List[int], min_count: int = 2) -> List[int]`
    4. Evaluates test cases individually, capturing status (`passed`), input, expected output, actual output, runtime, and assertion / syntax / runtime error details.
    5. Returns structured JSON test results to the controller.
    6. Documents limitation: child process execution, strict timeout, no container virtualization in local development environment.
  </action>
  <verify>Run standalone node test verifying correct vs failing Python code</verify>
  <done>PythonRunner executes code and returns genuine pass/fail results</done>
</task>

<task type="auto" effort="medium">
  <name>Update Test Controller with Event Logging</name>
  <files>backend/src/controllers/testController.js</files>
  <action>
    Update `runTests` to:
    1. Receive `code` and optional `isFollowUp` boolean from request body.
    2. Invoke `PythonRunner.execute(code, isFollowUp)`.
    3. Record a `test_run` event in the session's decision trail with passed/failed counts and duration.
    4. Cache the latest test execution results in the session database so AI Guidance and Skill Report can inspect actual test outcomes.
    5. Return preserved response structure: `{ success, message, results, summary, isFollowUp }`.
  </action>
  <verify>curl.exe -X POST http://localhost:5000/api/tests/run with candidate Python snippet</verify>
  <done>Real test execution output returned over HTTP</done>
</task>

## Phase 2: Dynamic Event Logging & Decision Trail

<task type="auto" effort="low">
  <name>Implement Session Event Logging in mockDatabase & Controllers</name>
  <files>backend/src/data/mockDatabase.js, backend/src/controllers/reportController.js</files>
  <action>
    1. Enhance `mockDatabase` to store event history with unique IDs, timestamps, event types (`session_start`, `code_revision`, `test_run`, `ai_query`, `requirement_change`, `assessment_submit`), details, and metadata.
    2. Provide helper `addEvent(type, action, details, metadata)` preventing duplicates.
    3. Update `getDecisionTrail` to return the real chronological event ledger.
  </action>
  <verify>curl.exe -s http://localhost:5000/api/reports/decision-trail</verify>
  <done>Events returned match actual recorded actions</done>
</task>

## Phase 3: Deterministic AI Guidance & Counterfactual Challenge

<task type="auto" effort="medium">
  <name>Implement Grounded Diagnostic AI Controller</name>
  <files>backend/src/controllers/aiController.js</files>
  <action>
    1. In `sendChatMessage`, read the latest test results from `mockDatabase`.
    2. If there are syntax/runtime errors, extract the error message and line number and explain the Python error cleanly.
    3. If there are failed tests (e.g. Test 2 ordering failure or Test 4 empty list), generate precise diagnostic advice explaining the problem without giving away copy-paste full code.
    4. If all tests pass, advise on time/space complexity or recommend tackling the follow-up counterfactual challenge.
    5. Accurately label the response: `[Deterministic Diagnostic Engine - Local Test Analysis]`.
    6. Record the AI prompt and response event in the Decision Trail.
  </action>
  <verify>curl.exe -X POST http://localhost:5000/api/ai/chat with query</verify>
  <done>AI response accurately references actual test failure</done>
</task>

## Phase 4: Dynamic Evidence-Linked Skill Scoring

<task type="auto" effort="medium">
  <name>Derive Objective Scores in reportController</name>
  <files>backend/src/controllers/reportController.js</files>
  <action>
    1. Calculate `testPassRate`: percentage of passed tests in the latest run.
    2. Calculate `autonomyScore`: based on ratio of independent test runs to AI queries.
    3. Calculate `errorRecovery`: whether candidate went from failing tests to passing tests across revisions.
    4. Calculate `adaptabilityScore`: whether candidate solved the counterfactual follow-up requirement (or mark "Insufficient Evidence - Follow-up not attempted" if not run).
    5. Calculate `overallBenchmark` as weighted combination of verified competencies.
    6. Return evidence summary linked to actual logged event timestamps and test outputs.
  </action>
  <verify>curl.exe -s http://localhost:5000/api/reports/skill-report</verify>
  <done>Scores dynamically change based on test runs and candidate actions</done>
</task>

## Phase 5: Frontend Integration & State Synchronization

<task type="auto" effort="high">
  <name>Connect Frontend SPA to Express Backend APIs</name>
  <files>frontend/src/main.js, frontend/src/style.css</files>
  <action>
    1. Make the code editor editable: render a styled `<textarea>` synchronized with code gutters, initialized with the candidate's baseline Python code.
    2. Add API client functions: `fetchSession()`, `runTestsAPI(code, isFollowUp)`, `fetchAIChat()`, `sendAIChat(message)`, `fetchDecisionTrail()`, `fetchSkillReport()`.
    3. Wire "Run Tests" to call `runTestsAPI`, show loading state, and render returned test results (pass/fail badges, diffs, execution durations).
    4. Wire AI Coach panel to call `fetchAIChat` / `sendAIChat` and display diagnostic guidance.
    5. Add Follow-Up Counterfactual Challenge toggle/card in the workspace allowing candidate to toggle between Base Challenge and Follow-Up Requirement ("Filter duplicates with frequency >= 3"), updating the prompt and running adaptation-specific tests.
    6. Wire Decision Trail view to fetch live events from `GET /api/reports/decision-trail`.
    7. Wire Skill Report view to fetch live computed metrics from `GET /api/reports/skill-report`.
    8. Add submit assessment flow that logs submission and transitions to the live Skill Report.
  </action>
  <verify>Interact with frontend in browser via browser_subagent</verify>
  <done>Frontend seamlessly communicates with backend; all 3 views display live data</done>
</task>

## Phase 6: End-to-End Validation & Verification

<task type="auto" effort="medium">
  <name>Execute Verification Suite & Capture Proof</name>
  <files>scripts/verify-assessment.js</files>
  <action>
    1. Run end-to-end API test script against:
       - Default buggy code (ordering bug -> 2/4 passed)
       - AI guidance query -> verify diagnostic response references Test 2
       - Corrected code (using Counter / first-seen index map -> 5/5 passed)
       - Counterfactual follow-up code -> verify adaptation test suite
       - Decision trail -> verify all events logged chronologically
       - Skill report -> verify metrics derived from real execution
    2. Validate UI in browser using browser_subagent.
  </action>
  <verify>node scripts/verify-assessment.js</verify>
  <done>All empirical verification checks pass</done>
</task>

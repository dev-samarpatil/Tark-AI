# AUDIT_PHASE3.md — Pre-Flight System Audit & Persistence Gap Analysis

## 1. Current Architecture
TARK AI operates as a split-tier evaluation cockpit:
- **Frontend SPA**: Vite + Vanilla JS in [frontend/src/main.js](file:///c:/TARK%20AI/frontend/src/main.js) rendering three views:
  - Coding Workspace (monaco-style editor, test results, execution banners, live Groq AI Coach)
  - AI Decision Trail (chronological forensic ledger of events, test runs, prompt interactions)
  - Skill Report (evidence-linked metrics: correctness, autonomy, error recovery, adaptability)
- **Backend API**: Express REST API on port 5000 in [backend/src/server.js](file:///c:/TARK%20AI/backend/src/server.js) with modular controllers:
  - `sessionController.js`: Serves candidate session state.
  - `testController.js`: Receives candidate code, invokes Python runner, logs execution events.
  - `aiController.js`: Validates coaching requests, invokes Groq LLM or deterministic fallback, logs AI guidance events.
  - `reportController.js`: Computes skill metrics dynamically from in-memory event and test histories.
  - `telemetryController.js`: Heartbeat / sync endpoint.
- **Python Execution Engine**: [backend/src/services/pythonRunner.js](file:///c:/TARK%20AI/backend/src/services/pythonRunner.js) spawning Python 3.14 via child process executing [backend/src/services/testHarness.py](file:///c:/TARK%20AI/backend/src/services/testHarness.py) with a 3000ms timeout.
- **AI Coach Service**: [backend/src/services/groqService.js](file:///c:/TARK%20AI/backend/src/services/groqService.js) integrating `openai/gpt-oss-20b` via Groq's official API with fallback to local diagnostics.

---

## 2. Existing API Contracts
| Endpoint | Method | Existing Request Body | Existing Response Schema | Current Behavior |
|---|---|---|---|---|
| `/api/session` | GET | None | `{ success: true, data: candidate }` | Returns singleton candidate from memory |
| `/api/session` | PATCH | `{ status: string }` | `{ success: true, data: candidate }` | Updates candidate status in memory |
| `/api/tests` | GET | None | `{ success: true, data: tests, latestExecution }` | Returns tests array and latest execution |
| `/api/tests/run` | POST | `{ code, mode, isFollowUp, executionId }` | `{ executionId, success, status, mode, isFollowUp, message, results, summary, error }` | Executes Python runner, logs test event |
| `/api/ai/chat` | GET | None | `{ success: true, data: chatMessages, groqConfigured, model }` | Returns message history from memory |
| `/api/ai/chat` | POST | `{ message, question, code, mode, ... }` | `{ success: true, message, reply, data, history, source, mode, executionId, fallbackUsed, error }` | Queries Groq or fallback, logs AI event |
| `/api/telemetry/sync` | POST | `{ latency, activeView, events }` | `{ success: true, syncStatus, timestamp, serverLatency }` | Mock sync telemetry |
| `/api/reports/decision-trail` | GET | None | `{ success: true, sessionId, data: decisionTrail, summary }` | Returns in-memory decision trail array |
| `/api/reports/skill-report` | GET | None | `{ success: true, data: { candidate, hasExecution, scores, evidence, evidenceSummary, tamperEvidentHash } }` | Computes report from in-memory objects |

---

## 3. Existing Data Structures

### Candidate Session (`mockDatabase.candidate`)
```json
{
  "name": "Aarav Sharma",
  "sessionId": "#TRK-8821",
  "role": "Senior Python Engineer",
  "timeRemaining": "24:18",
  "status": "In Progress",
  "problem": {
    "id": "TRK-P42",
    "title": "Find Duplicates in a List",
    "difficulty": "Medium-Hard",
    "description": "Return each integer that appears more than once, exactly once, preserving the order of its first appearance in the input array.",
    "followUpDescription": "Counterfactual Challenge: Return each integer that appears at least 3 times (min_count >= 3), preserving the order of its first appearance.",
    "timeSpec": "O(N)",
    "memorySpec": "O(N)"
  }
}
```

### Execution Record (`latestExecution`)
```json
{
  "executionId": "exec_1792319214_abcd",
  "success": true,
  "status": "completed",
  "mode": "base",
  "isFollowUp": false,
  "summary": { "total": 5, "passed": 4, "failed": 1, "runtime": "45ms" },
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

### Decision Trail Event (`decisionTrail[]`)
```json
{
  "id": "evt-1",
  "timestamp": "14:00:15",
  "action": "Test Run: Standard Test Suite",
  "details": "4/5 tests passed (45ms). Encountered assertion discrepancies.",
  "type": "test",
  "tag": "Partial",
  "metadata": {
    "executionId": "exec_1792319214_abcd",
    "status": "completed",
    "passed": 4,
    "total": 5,
    "mode": "base",
    "isFollowUp": false,
    "runtime": "45ms"
  },
  "sessionId": "#TRK-8821"
}
```

---

## 4. Current In-Memory State Locations
All mutable application state currently resides exclusively in `backend/src/data/mockDatabase.js`:
- `candidate` (Singleton object holding active session metadata)
- `currentCode` (String containing latest submitted editor code)
- `revisions` (Array of code length / revision markers)
- `tests` (Array of test result cards)
- `latestExecution` (Last execution outcome or null)
- `counterfactualCompleted` (Boolean flag)
- `chatMessages` (Array of chat prompts and AI responses)
- `decisionTrail` (Array of forensic event records)

---

## 5. Existing Session Lifecycle
- Currently, there is only **one hardcoded session** (`#TRK-8821`) initialized at module load time.
- If a client calls `GET /api/session`, it always returns `#TRK-8821`.
- If two candidates or browser tabs access the platform simultaneously, they overwrite each other's code, test executions, and chat threads.
- `PATCH /api/session` allows modifying status in memory, but state vanishes as soon as the Node server process exits or restarts.
- There are no endpoints to create a new session (`POST /api/session`), retrieve a specific session (`GET /api/session/:id`), or list sessions.

---

## 6. Existing Evidence and Event Lifecycle
- Every `POST /api/tests/run` updates `mockDatabase.tests`, `mockDatabase.latestExecution`, and appends an event to `mockDatabase.decisionTrail`.
- Every `POST /api/ai/chat` appends candidate and AI messages to `mockDatabase.chatMessages` and an event to `mockDatabase.decisionTrail`.
- Duplicates in `decisionTrail` are guarded only by an immediate comparison against the very last event in memory.
- When the backend restarts:
  - All test executions are wiped.
  - All Decision Trail events revert to 4 hardcoded starter events.
  - All AI chat history reverts to 2 hardcoded starter turns.

---

## 7. Existing Report-Generation Behavior
- `GET /api/reports/skill-report` reads directly from `mockDatabase.latestExecution`, `mockDatabase.decisionTrail`, and `mockDatabase.counterfactualCompleted`.
- If no tests have run, it reports `hasExecution: false` with null scores.
- When executions exist, it calculates correctness, autonomy, error recovery, and adaptability from in-memory arrays.
- Since in-memory arrays vanish on restart, previous reports cannot be retrieved or verified after restart.

---

## 8. Existing Frontend Dependencies on Response Formats
[frontend/src/main.js](file:///c:/TARK%20AI/frontend/src/main.js) depends strictly on:
- `sessRes.data` having `{ name, sessionId, role, timeRemaining, status, problem }`
- `chatRes.data` being an array of `{ sender, text, timestamp, source }` and top-level `{ groqConfigured, model }`
- `trailRes.data` being an array of `{ id, timestamp, action, details, type, tag, metadata }`
- `reportRes.data` being `{ candidate, hasExecution, scores: { overall, correctness, autonomy, errorRecovery, adaptability }, evidence: { ... }, evidenceSummary: [ ... ], tamperEvidentHash }`
- `runTests` response having `{ executionId, success, status, mode, isFollowUp, results, summary, error }`

**Crucial Constraint:** The API response formats must be 100% backward-compatible so the frontend continues rendering without regressions.

---

## 9. Identified Integrity and Persistence Risks
1. **Zero Restart Survival**: Restarting Node completely erases all candidate code, test runs, AI queries, and telemetry.
2. **Global Mutable Singleton**: All users/tabs share `#TRK-8821`; concurrent submissions collide in memory.
3. **Unanchored Evidence**: `executionId`s generated by the runner are cached in `latestExecution` only until the next run; prior executions are overwritten in memory and cannot be individually queried.
4. **Lack of Referential Integrity**: Test cases and assertion diffs are not stored relationally with foreign keys to execution records.
5. **Session Hijacking / Exposure**: Without session parameterization or basic demo identity isolation, sessions cannot be isolated or retrieved idempotently.
6. **Report Transience**: Skill reports are recomputed from transient memory rather than durable historical evidence records.

---

## 10. Recommended Minimum Phase 3 Design
1. **Persistence Engine**: Use Node.js 22/24 built-in `node:sqlite` (`DatabaseSync`). It requires zero external npm packages, zero C++ compiling, zero native bindings, runs synchronously with high throughput, and stores durable ACID-compliant tables in `backend/data/tark.sqlite`.
2. **Schema & Tables**:
   - `sessions`: `id` (PK), `candidate_id`, `candidate_name`, `candidate_role`, `status`, `time_remaining`, `current_code`, `challenge_id`, `created_at`, `updated_at`, `completed_at`
   - `challenges`: `id` (PK), `title`, `difficulty`, `description`, `follow_up_description`, `time_spec`, `memory_spec`, `version`
   - `executions`: `id` (PK, executionId), `session_id` (FK), `challenge_id`, `mode`, `is_follow_up`, `status`, `total_tests`, `passed_tests`, `failed_tests`, `runtime`, `error`, `created_at`
   - `test_results`: `id` (PK), `execution_id` (FK), `test_id`, `name`, `input`, `expected`, `actual`, `status`, `passed`, `duration`, `assertion`
   - `assessment_events`: `id` (PK, evt-uuid), `session_id` (FK), `action`, `details`, `type`, `tag`, `metadata_json`, `created_at`
   - `chat_messages`: `id` (PK), `session_id` (FK), `sender`, `text`, `source`, `fallback_used`, `created_at`
   - `skill_reports`: `id` (PK), `session_id` (FK), `scores_json`, `evidence_json`, `tamper_hash`, `created_at`
3. **Repository Abstraction Layer**:
   - `backend/src/services/persistence/db.js`: Database initialization, schema creation, migrations, and connection singleton.
   - `backend/src/repositories/sessionRepository.js`: CRUD for sessions.
   - `backend/src/repositories/executionRepository.js`: Atomic persistence of execution headers and child test results.
   - `backend/src/repositories/eventRepository.js`: Append and retrieve Decision Trail events.
   - `backend/src/repositories/chatRepository.js`: Store and fetch chat turns.
   - `backend/src/repositories/reportRepository.js`: Generate and persist verifiable reports from stored execution records.
4. **Controller Integration**:
   - Update `sessionController`, `testController`, `aiController`, and `reportController` to read/write via repositories while retaining exact API response shapes.
   - Support `sessionId` query/header parameter with automatic fallback to `#TRK-8821` for seamless demo and legacy client backward compatibility.

---

## 11. Files That Require Modification
- `backend/src/controllers/sessionController.js` (Wire to `sessionRepository`)
- `backend/src/controllers/testController.js` (Wire to `executionRepository` & `eventRepository`)
- `backend/src/controllers/aiController.js` (Wire to `chatRepository` & `eventRepository`)
- `backend/src/controllers/reportController.js` (Wire to `reportRepository` & `eventRepository`)
- `backend/src/routes/index.js` (Add session creation, session lookup, execution history endpoints)
- `frontend/src/main.js` (Preserve current view, store active `sessionId` in localStorage, restore state on reload)
- `.gitignore` & `backend/.gitignore` (Ensure `*.sqlite`, `*.sqlite-journal`, and `backend/data/` are ignored)

## 12. Files That Should Remain Untouched
- `backend/src/services/pythonRunner.js` (Authoritative execution harness must not be altered)
- `backend/src/services/testHarness.py` (Deterministic test evaluation logic preserved)
- `backend/src/services/groqService.js` (Verified Groq service preserved)
- `frontend/src/style.css` (Terminal Precision styling preserved)
- `scripts/verify-assessment.js` (Phase 1 regression verification suite preserved)
- `scripts/verify-ai-coach.js` (Phase 2 regression verification suite preserved)

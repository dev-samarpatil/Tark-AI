# PLAN_PHASE3.md — Phase 3 Implementation Plan

## Task 1: Storage Adapter & Schema Initialization
- **Files to create**: `backend/src/services/persistence/db.js`
- **Objective**:
  - Initialize SQLite database using Node.js built-in `node:sqlite` (`DatabaseSync`).
  - Configure database path at `backend/data/tark.sqlite` (or `process.env.DATABASE_PATH`).
  - Enable WAL journal mode and foreign keys pragma.
  - Execute DDL creating `challenges`, `sessions`, `executions`, `test_results`, `assessment_events`, `chat_messages`, and `skill_reports` tables.
  - Idempotently seed standard challenge (`TRK-P42`) and default session (`#TRK-8821`).
  - Add `*.sqlite*` and `backend/data/` to `.gitignore`.
- **Verify**: Run standalone node command asserting database creation and table presence.

---

## Task 2: Repositories Implementation
- **Files to create**:
  - `backend/src/repositories/sessionRepository.js`: `getSession(id)`, `createSession(data)`, `updateSession(id, data)`, `listSessions()`.
  - `backend/src/repositories/executionRepository.js`: `saveExecution(executionData)`, `getExecution(id)`, `getLatestExecution(sessionId)`, `listExecutions(sessionId)`.
  - `backend/src/repositories/eventRepository.js`: `addEvent(eventData)`, `getEvents(sessionId)`, `countEventsByType(sessionId)`.
  - `backend/src/repositories/chatRepository.js`: `addMessage(msgData)`, `getMessages(sessionId)`.
  - `backend/src/repositories/reportRepository.js`: `computeAndSaveReport(sessionId)`, `getLatestReport(sessionId)`.
- **Verify**: Unit test repository functions against temporary in-memory database.

---

## Task 3: Controller Integration & Route Expansion
- **Files to modify**:
  - `backend/src/controllers/sessionController.js`: Use `sessionRepository` to load/update sessions.
  - `backend/src/controllers/testController.js`: Save executions & child test results via `executionRepository`; record events via `eventRepository`.
  - `backend/src/controllers/aiController.js`: Save chat messages via `chatRepository`; record coaching events via `eventRepository`.
  - `backend/src/controllers/reportController.js`: Derive Decision Trail and Skill Reports from persistent tables via `eventRepository` and `reportRepository`.
  - `backend/src/routes/index.js`: Expose `POST /api/session`, `GET /api/session/:id`, `GET /api/executions/:id`.
- **Verify**: Existing tests (`scripts/verify-assessment.js` and `scripts/verify-ai-coach.js`) continue passing without regressions.

---

## Task 4: Frontend Session Recovery & Refresh Handling
- **Files to modify**: `frontend/src/main.js`
- **Objective**:
  - On load, check `localStorage.getItem('tark_session_id')` or default to `#TRK-8821`.
  - Pass `sessionId` in API calls (query param `?sessionId=...` or headers).
  - Restore current candidate code, active challenge mode, test results, and chat messages on reload.
  - Display clear recovery and error states without modifying existing design tokens.
- **Verify**: Frontend build (`npm run build`) succeeds with 0 errors.

---

## Task 5: Automated Verification Suite
- **Files to create**: `scripts/verify-phase3.js`
- **Objective**:
  - Implement comprehensive automated test suite covering Groups A through J (Session creation, retrieval, atomic execution persistence, Decision Trail ordering, Groq compatibility, report generation, restart survival, isolation, error handling).
  - Explicitly test process restart survival by executing test runs, stopping the backend, restarting the backend, and verifying all records persist.
- **Verify**: Run `node scripts/verify-phase3.js` and verify all tests pass.

---

## Task 6: Full Regression Verification & Browser E2E
- **Objective**:
  - Run `node scripts/verify-assessment.js` (Phase 1).
  - Run `node scripts/verify-ai-coach.js` (Phase 2).
  - Run `node scripts/verify-phase3.js` (Phase 3).
  - Run `npm run build` in `frontend/`.
  - Execute browser subagent verifying end-to-end user session, test run, AI chat, Decision Trail, Skill Report, page refresh, and state retention.
- **Verify**: Empirical proof captured with screenshot/video recordings.

---

## Task 7: Documentation & Commit
- **Files to create/modify**:
  - Create `.gsd/PHASE_3_IMPLEMENTATION_REPORT.md`
  - Update `.gsd/ROADMAP.md`
  - Update `.gsd/STATE.md`
  - Create clean Phase 3 git commit

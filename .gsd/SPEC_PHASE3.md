# SPEC_PHASE3.md — Persistent Assessment State & Evidence Integrity Specification

> **Status:** `FINALIZED`
>
> ⚠️ **Planning Lock**: Phase 3 Requirements Specification frozen for implementation.

---

## 1. Vision & Objective
Phase 3 establishes a durable, tamper-evident persistence foundation for TARK AI. It replaces transient in-memory session arrays with an ACID-compliant local SQLite storage layer, guaranteeing that:
1. Candidate assessment sessions survive backend restarts.
2. Every Python test execution produces an immutable, traceable execution record with individual test outcomes.
3. Decision Trail forensic events and AI Coach interactions are permanently recorded and relationally bound to the session.
4. Skill Reports are derived strictly from persisted execution proofs, never from transient memory or fabricated estimates.
5. The frontend recovers session state, code, and execution history smoothly on page refresh without discarding candidate progress.

---

## 2. Scope & Non-Goals

### In Scope:
- Durable SQLite persistence using Node.js 22/24 built-in `node:sqlite` (`DatabaseSync`).
- Normalized relational schema for `sessions`, `challenges`, `executions`, `test_results`, `assessment_events`, `chat_messages`, and `skill_reports`.
- Repository layer (`sessionRepository`, `executionRepository`, `eventRepository`, `chatRepository`, `reportRepository`).
- Restart-survival guarantees: previously run tests and logged events remain intact after process exit.
- Preserved API backward compatibility with existing Phase 1 & Phase 2 contracts.
- Frontend session recovery in [frontend/src/main.js](file:///c:/TARK%20AI/frontend/src/main.js) preserving the Terminal Precision UI.
- Comprehensive Phase 3 verification suite (`scripts/verify-phase3.js`) and regression verification.

### Out of Scope:
- External multi-tenant cloud database infrastructure or complex ORMs (e.g. Prisma/TypeORM).
- Heavyweight OAuth/SAML enterprise identity providers (demo identity and opaque server IDs are prioritized).
- Replacing the authoritative Python execution child process or test harness.
- Altering the Phase 2 Groq integration or switching the model away from `openai/gpt-oss-20b`.
- Major UI restructuring or migrating away from Vanilla JS + Vite.

---

## 3. Data Persistence Requirements & Relational Schema

### Database Configuration:
- Engine: `node:sqlite` (`DatabaseSync`)
- Location: `backend/data/tark.sqlite` (configurable via `DATABASE_PATH` env var)
- Pragma settings: `foreign_keys = ON`, `journal_mode = WAL`

### Schema Architecture:
1. **`challenges`**:
   - `id` TEXT PRIMARY KEY (e.g. `'TRK-P42'`)
   - `title` TEXT NOT NULL
   - `difficulty` TEXT NOT NULL
   - `description` TEXT NOT NULL
   - `follow_up_description` TEXT NOT NULL
   - `time_spec` TEXT NOT NULL
   - `memory_spec` TEXT NOT NULL
   - `version` TEXT NOT NULL DEFAULT '1.0.0'
   - `created_at` TEXT NOT NULL

2. **`sessions`**:
   - `id` TEXT PRIMARY KEY (e.g. `'#TRK-8821'` or `'trk_sess_...'`)
   - `candidate_id` TEXT NOT NULL
   - `candidate_name` TEXT NOT NULL
   - `candidate_role` TEXT NOT NULL
   - `status` TEXT NOT NULL CHECK(status IN ('created', 'in_progress', 'completed', 'abandoned'))
   - `time_remaining` TEXT NOT NULL
   - `current_code` TEXT NOT NULL
   - `challenge_id` TEXT NOT NULL REFERENCES challenges(id)
   - `active_mode` TEXT NOT NULL DEFAULT 'base'
   - `counterfactual_completed` INTEGER NOT NULL DEFAULT 0
   - `created_at` TEXT NOT NULL
   - `updated_at` TEXT NOT NULL
   - `completed_at` TEXT

3. **`executions`**:
   - `id` TEXT PRIMARY KEY (e.g. `'exec_...'`)
   - `session_id` TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
   - `challenge_id` TEXT NOT NULL REFERENCES challenges(id)
   - `mode` TEXT NOT NULL
   - `is_follow_up` INTEGER NOT NULL
   - `status` TEXT NOT NULL CHECK(status IN ('completed', 'syntax_error', 'runtime_error', 'timeout', 'runner_error'))
   - `total_tests` INTEGER NOT NULL DEFAULT 0
   - `passed_tests` INTEGER NOT NULL DEFAULT 0
   - `failed_tests` INTEGER NOT NULL DEFAULT 0
   - `runtime` TEXT NOT NULL DEFAULT '0ms'
   - `error` TEXT
   - `created_at` TEXT NOT NULL

4. **`test_results`**:
   - `id` TEXT PRIMARY KEY (e.g. `'tres_...'`)
   - `execution_id` TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE
   - `test_id` INTEGER NOT NULL
   - `name` TEXT NOT NULL
   - `input` TEXT
   - `expected` TEXT
   - `actual` TEXT
   - `status` TEXT NOT NULL
   - `passed` INTEGER NOT NULL
   - `duration` TEXT
   - `assertion` TEXT

5. **`assessment_events` (Decision Trail)**:
   - `id` TEXT PRIMARY KEY (e.g. `'evt-1'`)
   - `session_id` TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
   - `action` TEXT NOT NULL
   - `details` TEXT NOT NULL
   - `type` TEXT NOT NULL
   - `tag` TEXT NOT NULL
   - `metadata_json` TEXT
   - `created_at` TEXT NOT NULL

6. **`chat_messages`**:
   - `id` TEXT PRIMARY KEY
   - `session_id` TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
   - `sender` TEXT NOT NULL CHECK(sender IN ('candidate', 'ai'))
   - `text` TEXT NOT NULL
   - `source` TEXT CHECK(source IN ('groq', 'local') OR source IS NULL)
   - `fallback_used` INTEGER NOT NULL DEFAULT 0
   - `created_at` TEXT NOT NULL

7. **`skill_reports`**:
   - `id` TEXT PRIMARY KEY
   - `session_id` TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
   - `overall_score` INTEGER
   - `correctness_score` INTEGER
   - `autonomy_score` INTEGER
   - `error_recovery_score` INTEGER
   - `adaptability_score` INTEGER
   - `evidence_json` TEXT NOT NULL
   - `tamper_evident_hash` TEXT NOT NULL
   - `created_at` TEXT NOT NULL

---

## 4. Assessment Lifecycle & Session Recovery
- **Lifecycle States**: `created` → `in_progress` → `completed` (or `abandoned`).
- **Initial Baseline**: Default demo session `#TRK-8821` is auto-seeded on first database creation so existing workflows and tests immediately work without setup scripts.
- **Session Identification**:
  - Backend inspects `req.query.sessionId` or header `x-session-id`, defaulting to active `#TRK-8821` if omitted.
  - New sessions can be explicitly initialized via `POST /api/session`.
- **Frontend Recovery**:
  - On page load, `main.js` checks `localStorage.getItem('tark_session_id') || '#TRK-8821'`.
  - Fetches persisted session, code, test results, chat history, Decision Trail, and Skill Report.
  - If page is refreshed after tests run or code edits, the stored code, execution records, and Decision Trail events are accurately restored.

---

## 5. Evidence Integrity Rules
1. **Authoritative Execution**: Test outcomes are determined exclusively by `testHarness.py` via `pythonRunner.js`. The database records actual outputs; it never synthesizes passes.
2. **Atomic Persistence**: An execution record and all its child test results are inserted in a single SQLite transaction (`db.exec('BEGIN IMMEDIATE')`).
3. **No Collision / Discard**: Legitimate repeated runs of the same code create distinct timestamped execution records with distinct `executionId`s.
4. **Referential Grounding**: Skill report metrics reference real recorded execution IDs, pass counts, and event timestamps. If no tests have run, scores are rendered as `null` ("Insufficient Evidence").
5. **Secret Exclusion**: No `GROQ_API_KEY`, database credentials, or server environment variables may be written to `assessment_events` or `chat_messages`.

---

## 6. API Compatibility Requirements
All existing routes must remain fully functional with their established request/response formats:
- `GET /api/session` (supports optional `?sessionId=...`)
- `PATCH /api/session` (updates status)
- `POST /api/session` (initializes a new session)
- `GET /api/session/:id` (retrieves specific session)
- `GET /api/tests` (returns test suite and latest execution)
- `POST /api/tests/run` (executes code, persists execution & test_results, returns execution JSON)
- `GET /api/ai/chat` (returns chat messages for session)
- `POST /api/ai/chat` (queries AI or fallback, persists chat turns and Decision Trail event)
- `GET /api/reports/decision-trail` (returns Decision Trail for session)
- `GET /api/reports/skill-report` (computes and returns verifiable report for session)

---

## 7. Acceptance Criteria Matrix
- **P3-01**: Persistent storage engine initialized via `node:sqlite` with WAL mode and foreign keys enabled.
- **P3-02**: Default challenge (`TRK-P42`) and baseline session (`#TRK-8821`) seeded idempotently.
- **P3-03**: Backend restart survival: sessions, executions, test cases, events, and chat messages remain available after process exit.
- **P3-04**: Execution records persisted atomically with child `test_results`.
- **P3-05**: Decision Trail events persisted with sequential ordering and server timestamps.
- **P3-06**: AI Coach interactions persisted and associated with session.
- **P3-07**: Skill Report computed dynamically from persisted execution records and events.
- **P3-08**: Session recovery on frontend refresh restores candidate code, execution history, and Decision Trail.
- **P3-09**: Isolation: invalid session IDs or cross-session queries return clean errors without data leaks.
- **P3-10**: Phase 1 assessment regression passes (7/7 suites).
- **P3-11**: Phase 2 AI Coach regression passes (19/19 tests).
- **P3-12**: Phase 3 automated verification passes with restart-survival test (`scripts/verify-phase3.js`).
- **P3-13**: Frontend production build (`npm run build`) passes with 0 errors.
- **P3-14**: Full end-to-end browser workflow empirically verified.

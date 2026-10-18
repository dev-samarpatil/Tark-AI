# AUDIT_PHASE4.md — Pre-Implementation Assessment Architecture Audit

> **Phase:** Phase 4 — Assessment Intelligence, Evidence-Grounded Scoring & Skill Verification  
> **Date:** 2026-10-18  
> **Status:** Completed  
> **Checkpoints Verified:**  
> - Phase 1 (`d861de5`): Python harness child process & per-test execution tracking  
> - Phase 2 (`e73b645`): Live Groq AI Coach with deterministic fallback (`openai/gpt-oss-20b`)  
> - Phase 3 (`82f9eea`): ACID SQLite persistence, restart recovery, evidence integrity  

---

## 1. Executive Summary & Audit Purpose
The purpose of this pre-flight audit is to inspect the existing TARK AI architecture across backend, frontend, persistence, execution, and evaluation services to identify the gaps between the existing Phase 3 implementation and the Phase 4 requirements for:
1. Deterministic, evidence-grounded assessment scoring.
2. Structured evaluation of VERIFY (defect identification and validation).
3. Structured evaluation of ADAPT (counterfactual requirements + regression preservation).
4. Transparent AI assistance reporting without arbitrary penalties.
5. Security restriction on lifecycle management endpoints (e.g., `/api/shutdown`).

---

## 2. Baseline Test Execution Results
All existing automated verification scripts were executed against the active working tree prior to modifying any code:

| Verification Suite | Command | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Phase 1 Regression** | `node scripts/verify-assessment.js` | **7/7 suites passed (100%)** | Python child process isolation, status classification, timeout (3000ms), error recovery. |
| **Phase 2 AI Coach** | `node scripts/verify-ai-coach.js` | **19/19 tests passed (100%)** | Groq live provider (`openai/gpt-oss-20b`), deterministic fallback, attribution, secret scrubbing. |
| **Phase 3 Persistence** | `node scripts/verify-phase3.js` | **23/23 tests passed (100%)** | SQLite WAL mode, atomic execution transactions, real process restart survival, 403 isolation. |
| **Frontend Production Build** | `npm run build` (in `frontend/`) | **Built in 154ms, 0 errors** | Vite v8.3.4 bundling clean. |

---

## 3. Analysis of Existing Assessment & Scoring Logic

### Current Strengths:
- **Durable Evidence Storage**: Executions, test outcomes, events, and chat turns are durably stored in SQLite (`backend/data/tark.sqlite`) with relational integrity.
- **Child-Process Isolation**: Untrusted candidate Python code runs in a separate child process via `testHarness.py` with stdin streaming, avoiding main thread blockage.
- **Accurate Error Classification**: Distinguishes `completed`, `syntax_error`, `runtime_error`, `timeout`, and `runner_error`.

### Identified Defects & Gaps in Current Scoring:
1. **Arbitrary AI Penalty**:
   - In `backend/src/repositories/reportRepository.js` (lines 44-50), autonomy score penalizes candidate arbitrarily: `penalty = Math.min(45, aiEvents.length * 12)`.
   - *Phase 4 Requirement*: AI usage frequency must not arbitrarily penalize or inflate skill scores. AI assistance must be reported transparently as contextual data.
2. **Hardcoded Magic Numbers**:
   - Error recovery score is hardcoded to magic numbers (92, 95, 65, 90).
   - Adaptability score is hardcoded to 96 when `counterfactualCompleted` is true.
   - *Phase 4 Requirement*: All dimension scores must be derived deterministically from explicit formulas and verified execution counts.
3. **Weak VERIFY Mode**:
   - VERIFY mode currently lacks an explicit evaluation protocol. The candidate is not given a structured defect to diagnose, explain, and validate.
   - *Phase 4 Requirement*: Implement an explicit verification task where candidate investigates a flawed implementation, identifies the root cause (ordering flaw in starter code), validates the fix, and receives backend-authoritative evaluation.
4. **ADAPT Mode Lacks Regression Verification**:
   - Follow-up evaluation currently only runs the 4 follow-up tests (`min_count >= 3`). It does not verify if the candidate's modified code regressed against the base requirement (`min_count = 2` or default parameters).
   - *Phase 4 Requirement*: ADAPT must evaluate both the new requirement and regression preservation.
5. **No Documented Rubric Versioning or Dimension States**:
   - Reports do not identify the rubric version used (e.g., `assessment-rubric-v1`).
   - Dimensions do not explicitly declare their evaluation state (`measured`, `insufficient_evidence`, `not_attempted`, `not_applicable`).
   - Missing dimensions fall back to arbitrary substitutes rather than normalizing available weights.
6. **Unrestricted Shutdown Endpoint**:
   - `POST /api/shutdown` introduced in Phase 3 for automated restart testing lacks access control.
   - *Phase 4 Requirement*: Restrict `/api/shutdown` via test environment check or shared secret token.

---

## 4. Key Files to Modify & Create

### Files to Create:
- `backend/src/services/assessmentEngine.js` — Core deterministic assessment engine implementing `assessment-rubric-v1`.
- `backend/src/controllers/verifyController.js` — Backend controller for VERIFY task diagnosis and validation.
- `scripts/verify-phase4.js` — Automated Phase 4 verification suite covering scoring, VERIFY, ADAPT, regression, and security.
- `docs/phase4/AUDIT_PHASE4.md` — This audit document.
- `docs/phase4/SPEC_PHASE4.md` — Technical specification for Phase 4.
- `docs/phase4/PHASE_4_IMPLEMENTATION_PLAN.md` — Concrete implementation plan.
- `docs/phase4/PHASE_4_SCORING_RUBRIC.md` — Deterministic scoring rubric documentation.
- `docs/phase4/PHASE_4_TEST_REPORT.md` — Test execution log.
- `docs/phase4/PHASE_4_IMPLEMENTATION_REPORT.md` — Final implementation report.

### Files to Modify:
- `backend/src/repositories/reportRepository.js` — Delegate scoring to `AssessmentEngine`, store rubric version and dimension breakdowns.
- `backend/src/routes/index.js` — Mount `/api/verify` endpoints, secure `/api/shutdown`.
- `backend/src/controllers/testController.js` — Support regression verification during ADAPT runs.
- `frontend/src/main.js` — Add VERIFY tab in workspace, update Skill Report cards to render rubric dimensions with explicit missing-evidence indicators.

---

## 5. Backward Compatibility & Risk Management
- Existing endpoints (`GET /api/session`, `POST /api/tests/run`, `POST /api/ai/chat`, `GET /api/reports/skill-report`) will retain existing response fields to guarantee zero frontend regression.
- Phase 1, Phase 2, and Phase 3 verification suites will be run continuously to guarantee 100% regression safety.

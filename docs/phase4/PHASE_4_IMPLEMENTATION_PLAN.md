# PHASE_4_IMPLEMENTATION_PLAN.md — Phase 4 Engineering Plan

> **Milestone:** Phase 4 — Assessment Intelligence, Evidence-Grounded Scoring & Skill Verification  
> **Status:** APPROVED  

---

## 1. Implementation Steps & Priorities

### Task 1: Core Assessment Engine (`backend/src/services/assessmentEngine.js`)
- **Objective**: Implement deterministic evaluation functions for each of the 5 dimensions of `assessment-rubric-v1`.
- **Inputs**: Stored executions, test results, assessment events, session state.
- **Outputs**: Comprehensive score report with dimension breakdown, earned vs max points, explicit status (`measured`, `insufficient_evidence`, `not_attempted`), explanation notes, and normalized benchmark.
- **Dependencies**: SQLite repositories.

### Task 2: Strengthen VERIFY Mode (`backend/src/controllers/verifyController.js`)
- **Objective**: Implement defect investigation and validation API.
- **Endpoints**:
  - `GET /api/verify/task`: Returns defect description, options, and starter code.
  - `POST /api/verify/evaluate`: Validates option selection and executes validation tests on provided code.
- **Dependencies**: `testHarness.py`, `EventRepository`.

### Task 3: Strengthen ADAPT Mode with Regression Checking
- **Objective**: When running tests in `mode === 'follow-up'`, also verify that base tests don't fail, storing regression outcome in execution record.
- **Dependencies**: `testController.js`, `ExecutionRepository`.

### Task 4: Integrate Report Repository & Endpoint
- **Objective**: Wire `ReportRepository.generateReport()` to use `AssessmentEngine`.
- **Outputs**: Updated Skill Report response containing `rubricVersion`, `dimensions`, `normalizedScore`, `evidenceReferences`, and cryptographic integrity hash.
- **Dependencies**: `ReportRepository`, `assessmentEngine`.

### Task 5: Security Hardening on `/api/shutdown`
- **Objective**: Protect `POST /api/shutdown` against unauthorized calls outside test environments.
- **Dependencies**: `backend/src/routes/index.js`.

### Task 6: Frontend UI Enhancements (`frontend/src/main.js`)
- **Objective**: Expose VERIFY mode in Workspace tabs; display rubric dimension breakdown and missing-evidence indicators in Skill Report view.
- **Dependencies**: `frontend/src/main.js`.

### Task 7: Comprehensive Automated Verification Suite (`scripts/verify-phase4.js`)
- **Objective**: Test deterministic scoring, missing-evidence normalization, VERIFY evaluation, ADAPT regression detection, shutdown protection, and Phase 1-3 compatibility.
- **Dependencies**: Verification scripts.

### Task 8: Final Documentation & Git Checkpoint
- **Objective**: Create `PHASE_4_SCORING_RUBRIC.md`, `PHASE_4_TEST_REPORT.md`, `PHASE_4_IMPLEMENTATION_REPORT.md`, update `ROADMAP.md` and `STATE.md`, and create clean Git commit.

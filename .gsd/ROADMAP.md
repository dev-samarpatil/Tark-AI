---
milestone: Tark AI Demo Ready
version: 1.0.0
updated: 2026-10-18T14:51:00Z
---

# Roadmap

> **Current Phase:** Phase 6 - End-to-End Validation & Verification
> **Status:** ✅ Complete

## Must-Haves (from SPEC)
- [x] Child process Python test runner with timeout and deterministic test suites
- [x] Real-time event logging into session Decision Trail
- [x] Deterministic failure-derived AI guidance
- [x] Counterfactual follow-up requirement & test validation
- [x] Dynamically calculated Skill Report based on actual session data
- [x] Frontend connected to backend REST API maintaining "Terminal Precision" UI

---

## Phases

### Phase 1: Python Runner Service & Test Execution API
**Status:** ✅ Complete
**Objective:** Execute candidate Python code safely via child process against deterministic suites with timeouts. Return per-test inputs, outputs, diffs, and assertion errors.
**Artifacts:** [backend/src/services/pythonRunner.js](file:///c:/TARK%20AI/backend/src/services/pythonRunner.js), [backend/src/controllers/testController.js](file:///c:/TARK%20AI/backend/src/controllers/testController.js)

### Phase 2: Session Event Logging & Decision Trail API
**Status:** ✅ Complete
**Objective:** Record actual code revisions, test runs, AI queries, requirement changes, and submissions without duplicates.
**Artifacts:** [backend/src/data/mockDatabase.js](file:///c:/TARK%20AI/backend/src/data/mockDatabase.js), [backend/src/controllers/reportController.js](file:///c:/TARK%20AI/backend/src/controllers/reportController.js)

### Phase 3: Deterministic AI Guidance & Counterfactual Challenge
**Status:** ✅ Complete
**Objective:** Provide honest diagnostic guidance derived from actual failing test assertions. Introduce follow-up requirement (elements appearing $\ge K$ times).
**Artifacts:** [backend/src/controllers/aiController.js](file:///c:/TARK%20AI/backend/src/controllers/aiController.js)

### Phase 4: Dynamic Evidence-Linked Skill Scoring
**Status:** ✅ Complete
**Objective:** Calculate test pass rates, autonomy index, error recovery rate, and adaptability from recorded telemetry.
**Artifacts:** [backend/src/controllers/reportController.js](file:///c:/TARK%20AI/backend/src/controllers/reportController.js)

### Phase 5: Frontend Integration & State Sync
**Status:** ✅ Complete
**Objective:** Wire up editor input, run test triggers, AI chat, Decision Trail view, and Skill Report view to the Express API.
**Artifacts:** [frontend/src/main.js](file:///c:/TARK%20AI/frontend/src/main.js), [frontend/src/style.css](file:///c:/TARK%20AI/frontend/src/style.css)

### Phase 6: End-to-End Validation & Verification
**Status:** ✅ Complete
**Objective:** Empirically verify correct vs buggy code runs, follow-up challenge, Decision Trail inspection, and report generation in automated tests and live browser session.
**Artifacts:** [scripts/verify-assessment.js](file:///c:/TARK%20AI/scripts/verify-assessment.js)

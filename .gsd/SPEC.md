# SPEC.md — Tark AI Assessment Platform

> **Status**: `FINALIZED`
>
> ⚠️ **Planning Lock**: Requirements frozen for 2-hour demo milestone.

## Vision
Tark AI is a technical assessment platform that verifies real candidate problem-solving through live Python test execution, deterministic AI diagnostic guidance, tamper-evident event logging (Decision Trail), and evidence-linked skill scoring.

## Goals
1. **Real Python Execution**: Replace mock test results with an isolated Python runner executing candidate code against deterministic test suites with timeouts.
2. **Dynamic Event Logging**: Record actual code revisions, test executions, AI guidance requests, follow-up challenges, and submissions into the active session's Decision Trail.
3. **Deterministic Diagnostic AI Guidance**: Provide honest, grounded AI hints based on actual test failures and syntax diagnostics without inventing hallucinations.
4. **Counterfactual Challenge**: Introduce a follow-up requirement (frequency threshold / adaptation test) that validates candidate adaptability to changing requirements.
5. **Evidence-Linked Skill Report**: Compute scores dynamically from recorded telemetry, test pass rates, AI reliance ratios, and counterfactual performance.
6. **Unified Client Experience**: Connect the existing Vite + Vanilla JS frontend directly to the Express backend without altering the visual design tokens or aesthetic.

## Non-Goals (Out of Scope)
- No external multi-tenant cloud sandbox or container orchestrator (limitations clearly documented).
- No external LLM API dependency; use deterministic test-failure synthesis for reliable demo readiness.
- No new database engine; retain in-memory session store.
- No user authentication or payment gateways.
- No redesign of existing UI layouts or design tokens.

## Constraints
- Completion time: ~2 hours demo-ready.
- Python runtime: Python 3.14 (installed locally) executed via child process with 3-second timeout.
- Backend: Express on port 5000 (`/api`).
- Frontend: Vite on port 5173.

## Success Criteria
- [x] Backend executes candidate Python code in a child process and returns actual test results.
- [x] Intentionally buggy code returns failing tests with accurate diffs/assertions; corrected code passes all tests.
- [x] AI Coach provides diagnostic guidance derived from actual failing test assertions.
- [x] Candidate can trigger and solve the follow-up counterfactual challenge.
- [x] Decision Trail displays real chronological events logged during the candidate's session.
- [x] Skill Report calculates objective metrics derived from the session's actual test and guidance data.
- [x] End-to-end user flow works in the browser without console errors.

---

*Last updated: 2026-10-18*

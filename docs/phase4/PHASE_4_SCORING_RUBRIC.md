# PHASE_4_SCORING_RUBRIC.md — Deterministic Assessment Scoring Rubric

> **Rubric Identifier:** `assessment-rubric-v1`  
> **Status:** ACTIVE & DETERMINISTIC  
> **Effective Date:** 2026-10-18  

---

## 1. Overview
The `assessment-rubric-v1` scoring rubric derives an objective, mathematical competency score from verified Python executions, per-test assertions, and tamper-evident Decision Trail telemetry. It eliminates magic numbers, arbitrary penalties for asking AI questions, and unsupported subjective ratings.

---

## 2. Dimension Specifications & Calculation Formulas

### Dimension 1: Algorithmic Precision (`core_correctness`)
- **Weight**: 40% (Max 40 points)
- **Status Conditions**:
  - `measured`: At least one Base suite execution recorded.
  - `insufficient_evidence`: No executions recorded.
- **Formula**:
  $$\text{Points} = \text{round}\left(\frac{\text{passed\_tests}}{\text{total\_tests}} \times 40\right)$$
  *(Evaluated on the candidate's latest valid Base test execution. If execution status is `syntax_error`, `runtime_error`, or `timeout`, points earned = 0).*

### Dimension 2: Defect Verification Ability (`verify_ability`)
- **Weight**: 20% (Max 20 points)
- **Status Conditions**:
  - `measured`: Candidate has submitted answers for verification task.
  - `not_attempted`: Candidate has not submitted verification response.
  - `not_applicable`: Challenge has no defect verification task.
- **Components**:
  1. **Defect Diagnosis (10 pts)**: Correctly identifies the ordering discrepancy root cause (`DEFECT-ORDERING-01`).
  2. **Defect Validation (10 pts)**: Solution executes and passes Test 2 (`[4, 2, 2, 4]` -> `[4, 2]`).

### Dimension 3: Requirement Adaptation & Regression (`adapt_ability`)
- **Weight**: 25% (Max 25 points)
- **Status Conditions**:
  - `measured`: Candidate executed at least one Follow-Up suite test run.
  - `not_attempted`: Candidate has not executed in Follow-Up mode.
- **Components**:
  1. **Follow-Up Satisfaction (15 pts)**:
     $$\text{Points} = \text{round}\left(\frac{\text{passed\_followup\_tests}}{4} \times 15\right)$$
  2. **Regression Preservation (10 pts)**:
     10 points awarded if candidate's code still handles default/base requirements correctly; 0 points if base behavior breaks under the new implementation.

### Dimension 4: Error Recovery & Debugging (`debug_recovery`)
- **Weight**: 10% (Max 10 points)
- **Status Conditions**:
  - `measured`: Candidate executed at least 1 test run.
  - `insufficient_evidence`: No test runs recorded.
- **Formula**:
  - **Recovery Case**: If execution history contains an initial failing run (or syntax/runtime error) followed by an execution with improved test passes: **10 points**.
  - **Clean First-Pass Case**: If candidate passed 100% of tests on their very first execution without any errors: **9 points**.
  - **Persistent Failure Case**: If multiple iterations were attempted but failures remained uncorrected:
    $$\text{Points} = \text{max}\left(2, \text{round}\left(\frac{\text{final\_passed}}{\text{total\_tests}} \times 8\right)\right)$$

### Dimension 5: Validation Rigor (`validation_discipline`)
- **Weight**: 5% (Max 5 points)
- **Status Conditions**:
  - `measured`: At least one test run recorded prior to assessment submission.
  - `insufficient_evidence`: Assessment submitted without running tests.
- **Formula**:
  - 5 points awarded if the candidate executed verification tests prior to submitting the assessment.

---

## 3. Score Normalization Policy

When dimensions are `not_attempted` or `not_applicable`, the overall benchmark is normalized to a 100-point scale based on applicable, measured dimensions:

$$\text{Earned Points} = \sum_{\text{dim} \in \text{Measured}} \text{EarnedPoints}(\text{dim})$$
$$\text{Available Points} = \sum_{\text{dim} \in \text{Measured}} \text{MaxPoints}(\text{dim})$$

$$\text{Normalized Overall Score} = \text{round}\left(\frac{\text{Earned Points}}{\text{Available Points}} \times 100\right)$$

### Guardrails:
1. **No Execution Guard**: If `core_correctness` is `insufficient_evidence`, `overallScore` is strictly `null` (displayed as `--`).
2. **AI Transparency**: AI Coach query count is tracked in `aiCollaboration` metadata and NEVER reduces or inflates earned points.

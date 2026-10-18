# SPEC_PHASE4.md — Assessment Intelligence, Evidence-Grounded Scoring & Skill Verification

> **Phase:** 4  
> **Status:** FINALIZED  
> **Rubric Version:** `assessment-rubric-v1`  

---

## 1. Vision & Core Philosophy
Phase 4 elevates TARK AI from a persistent evaluation recorder to an intelligent, explainable assessment platform that evaluates demonstrated engineering ability using explicit, reproducible rules derived strictly from stored evidence.

The system enforces three core assessment pillars:
1. **VERIFY**: Evaluate whether candidate can identify defects in provided code, reason about edge-case failures, and validate corrections.
2. **ADAPT**: Evaluate whether candidate can adapt a working solution when constraints or requirements evolve without introducing regressions.
3. **PROVE**: Derive all scores and narrative claims deterministically from verified execution outcomes and audit telemetry. The system never invents scores, never infers competency from raw AI query counts, and never penalizes AI usage arbitrarily.

---

## 2. Assessment Dimensions & Scoring Weights

The deterministic scoring model `assessment-rubric-v1` defines 5 explicit dimensions totaling 100 points:

| Dimension Identifier | Dimension Name | Weight | Max Points | Measurement Method |
| :--- | :--- | :---: | :---: | :--- |
| `core_correctness` | Algorithmic Precision | 40% | 40 | Percentage of passed Base test cases (out of 5). Full points for 5/5 passed. 0 points for syntax or execution error. |
| `verify_ability` | Defect Verification | 20% | 20 | 10 pts for correctly diagnosing root cause of intentional defect (`DEFECT-ORDERING-01`), 10 pts for validating solution that passes Test 2 (`[4, 2, 2, 4]` -> `[4, 2]`). |
| `adapt_ability` | Requirement Adaptation | 25% | 25 | 15 pts for passing all 4 Follow-Up adaptation tests (`min_count >= 3`), 10 pts for verifying zero regression on original base requirements. |
| `debug_recovery` | Error Recovery & Debugging | 10% | 10 | 10 pts for resolving a prior syntax/runtime/test failure in subsequent iteration; 9 pts for clean first-pass execution; partial points proportional to recovery ratio. |
| `validation_discipline` | Validation Rigor | 5% | 5 | Awarded for running verification test executions before formal assessment submission. |
| **Total** | | **100%** | **100** | |

---

## 3. Evaluation Dimension States & Score Normalization

### Dimension States:
Every dimension in a report must declare one of four distinct states:
- `measured`: Sufficient evidence was observed and evaluated deterministically.
- `insufficient_evidence`: The candidate did not produce the necessary execution or action data to evaluate this dimension.
- `not_attempted`: The task was available but the candidate has not yet initiated it (e.g. Follow-Up mode not toggled).
- `not_applicable`: The challenge does not contain tasks for this dimension.

### Missing-Evidence Score Normalization:
When some dimensions are `not_attempted` or `not_applicable`, the overall benchmark is calculated by normalizing earned points against available points of measured dimensions:

$$\text{Normalized Score} = \text{round}\left(\frac{\sum \text{Earned Points}}{\sum \text{Maximum Points of Measured Dimensions}} \times 100\right)$$

**Mandatory Guard**:
If `core_correctness` is in state `insufficient_evidence` (no executions have been recorded), `overallScore` MUST be `null` (`--`), and the report is labeled `provisional: true`. A skill score is never fabricated before code has been tested.

---

## 4. VERIFY Mode Specification

### Defect Definition (`DEFECT-ORDERING-01`):
In starter code for `TRK-P42`:
```python
def find_duplicates(nums: List[int]) -> List[int]:
    seen = set()
    duplicates = []
    for val in nums:
        if val in seen:
            if val not in duplicates:
                duplicates.append(val)
        else:
            seen.add(val)
    return duplicates
```
- **Symptom**: Test 2 fails (`input = [4, 2, 2, 4]`, `expected = [4, 2]`, `actual = [2, 4]`).
- **Root Cause**: Appending immediately upon encountering the 2nd instance orders duplicates by their *second* occurrence timestamp rather than their *first seen* position in the original list.
- **Valid Options**:
  - `A`: Set lookup `val in seen` causes quadratic time complexity. (Incorrect)
  - `B`: Appending on 2nd encounter orders by second occurrence rather than first appearance index. (CORRECT)
  - `C`: Python set cannot store duplicate references. (Incorrect)
  - `D`: The function returns a list instead of a set. (Incorrect)

### API Contract:
- `POST /api/verify/evaluate`:
  - Request: `{ sessionId, defectId, selectedOption, code }`
  - Response: `{ success, diagnosed: boolean, validated: boolean, pointsEarned: number, explanation: string }`
  - Records events `verify_answer_evaluated` and `verify_validation_completed` in `assessment_events`.

---

## 5. ADAPT Mode Specification & Regression Testing

### Counterfactual Requirement:
- Threshold shifts from duplicates ($K \ge 2$) to frequency $K \ge 3$.
- 4 adaptation tests are executed.

### Regression Preservation:
- The backend evaluates whether the candidate's implementation maintains backward compatibility (e.g., calling `find_duplicates(nums, min_count=2)` or default parameters retains correct base behavior).
- If base test cases fail under the adapted solution, the regression test flag is set to `failed`, and 10 regression points are withheld.

---

## 6. AI Assistance Reporting Specification
- AI Coach queries are tracked with source attribution (`groq` vs. `local`).
- **Zero Arbitrary Penalty**: The candidate's autonomy score is NOT penalized based on prompt count.
- Instead, AI collaboration is reported as transparent telemetry:
  - Total queries asked.
  - Queries preceding successful test fixes.
  - Ratio of independent test executions to AI queries.

---

## 7. Security Hardening: Shutdown Endpoint Protection
- `POST /api/shutdown` must verify that either:
  1. `req.headers['x-test-token'] === 'tark-test-secure-shutdown-key'`, or
  2. `process.env.NODE_ENV === 'test'`
- If unauthorized, return HTTP 403 `FORBIDDEN`.

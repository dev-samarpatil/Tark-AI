# Phase 2 Implementation Plan: Live Groq AI Coach Integration

## 1. Overview & Objective
Transform the existing deterministic AI Coach into a real, context-aware AI assistant using the Groq API (`openai/gpt-oss-120b`), while preserving:
- Existing `/api/ai/chat` contract (both legacy `{ message }` and rich context)
- Deterministic local fallback when Groq is unavailable, unconfigured, times out, or fails
- Python execution engine as the sole authoritative evaluator
- Phase 1 baseline execution, test harness, and Decision Trail integrity
- Strict backend-only secret isolation

---

## 2. Architecture & Request Flow
```
+-------------------------------------------------------+
|          TARK AI Coding Workspace (Frontend)          |
|  - Candidate Question + Active Code + Latest Results  |
+-------------------------------------------------------+
                           |
                           | POST /api/ai/chat
                           v
+-------------------------------------------------------+
|             Express Router & AI Controller            |
|  - Input validation & bounds checking (max lengths)   |
|  - Assessment context assembly (mode, code, tests)    |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|               Groq AI Service (Backend)               |
|  - Reads GROQ_API_KEY & GROQ_MODEL from process.env   |
|  - Formats system instructions with test proof        |
|  - 10,000ms AbortSignal timeout                       |
+-------------------------------------------------------+
               /                               \
        (Success)                          (Failure / No Key)
             /                                   \
            v                                     v
+------------------------+             +------------------------+
| Groq Live Response     |             | Deterministic Fallback |
| Source: "groq"         |             | Source: "local"        |
| FallbackUsed: false    |             | FallbackUsed: true     |
+------------------------+             +------------------------+
             \                                   /
              \                                 /
               v                               v
+-------------------------------------------------------+
|               Normalized JSON Response                |
|  - { success, message, reply, source, fallbackUsed }  |
|  - Logged into mockDatabase Decision Trail            |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|          Frontend AI Coach Chat Component             |
|  - Renders message with GROQ AI / LOCAL badge         |
|  - Restores input and loading state                   |
+-------------------------------------------------------+
```

---

## 3. Files to Modify & Create

### Modified Files:
1. `backend/src/services/groqService.js`:
   - System instructions conforming to Section 9.2 & Section 10.
   - Robust context extraction from `latestExecution` (syntax error, runtime error, timeouts, assertion diffs).
   - Strict payload limits and prompt injection boundaries.
   - 10,000ms timeout handling and structured provider error classification.
   - Check configured status with trim and placeholder filtering.
2. `backend/src/controllers/aiController.js`:
   - Request validation (non-empty trimmed message/question, bounded lengths, allowed modes).
   - Dynamic context merging: prefers request payload with fallback to `mockDatabase`.
   - Backward-compatible normalized response (`message`, `reply`, `data`, `source`, `fallbackUsed`, `executionId`).
   - Decision Trail event logging with `Groq Live` or `Local AI` metadata without secret exposure.
3. `frontend/src/main.js`:
   - Enriches `sendChatMessageAPI` with current code, active mode, executionId, and latest test results.
   - Renders clear source badge (`GROQ AI` vs `LOCAL FALLBACK`).
   - Loading indicator with input lock and graceful error recovery on network/server failures.
4. `backend/.env.example`:
   - Maintained with clean placeholders.

### Created Files:
1. `scripts/verify-ai-coach.js`:
   - Comprehensive automated test suite verifying Test A through Test S.
2. `.gsd/PHASE_2_AI_COACH_REPORT.md`:
   - Complete verification report, evidence table, security audit, and demo instructions.

---

## 4. Dependencies
- `dotenv`: Already installed in `backend/package.json` and loaded in `backend/src/server.js`.
- `fetch` / `AbortSignal`: Native in Node.js 18+. No extra HTTP libraries needed.
- No redundant dependencies or framework additions.

---

## 5. Security Controls
- **Secret Isolation**: `GROQ_API_KEY` exists strictly in `backend/.env`, ignored by `.gitignore`.
- **Zero Client Leakage**: Never exposed in responses, frontend scripts, or HTML.
- **Safe Logging**: Authorization headers and credentials are never logged to console or stored in Decision Trail metadata.
- **Untrusted Input Sanitation**: Candidate code and questions are framed as data objects in prompts to mitigate prompt injection.
- **Execution Boundary**: AI Coach has zero execution privileges; Python runner remains authoritative.

---

## 6. Acceptance Criteria Matrix
- **P2-01**: Environment configuration supported (`GROQ_API_KEY`, `GROQ_MODEL`, `PORT`).
- **P2-02**: Secret protection (no secrets in git, logs, or client).
- **P2-03**: Existing `/api/ai/chat` endpoint preserved.
- **P2-04**: Real provider produces genuine Groq response.
- **P2-05**: Local fallback operates seamlessly when Groq is unconfigured or unavailable.
- **P2-06**: Accurate source attribution (`groq` vs `local`).
- **P2-07**: Context-aware coaching using code, problem statement, and actual test results.
- **P2-08**: Evidence integrity (no hallucinated test executions).
- **P2-09**: Mode awareness (distinguishes Base and Follow-Up modes).
- **P2-10**: Graceful provider error handling.
- **P2-11**: Provider timeout handling (10,000ms limit).
- **P2-12**: Responsive frontend integration in existing UI.
- **P2-13**: Loading state recovery and retry capability.
- **P2-14**: Decision Trail event logging.
- **P2-15**: Phase 1 assessment regression tests passing (7/7).
- **P2-16**: Frontend production build succeeds (`npm run build`).
- **P2-17**: Verification report in `.gsd/PHASE_2_AI_COACH_REPORT.md`.
- **P2-18**: Git checkpoint commit.

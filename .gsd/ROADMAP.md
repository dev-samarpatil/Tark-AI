---
milestone: Phase 2 - Live Groq AI Coach Integration
version: 2.0.0
updated: 2026-10-18T15:45:00Z
---

# Roadmap

> **Current Milestone:** Phase 2 — Live Groq AI Coach Integration
> **Status:** 🟡 In Execution

## Milestone 2.0 Must-Haves
- [x] Backend environment configuration (.env, .env.example, git protection)
- [ ] Context-aware Groq AI provider service with 10s timeout & payload bounds
- [ ] Preserved `/api/ai/chat` endpoint with input validation & backward-compatible response
- [ ] Deterministic local fallback when Groq unavailable/error/timeout
- [ ] Frontend integration with GROQ AI / LOCAL badges & error recovery
- [ ] Event logging in Decision Trail with safe metadata
- [ ] Comprehensive automated verification script (verify-ai-coach.js)
- [ ] Phase 1 regression verification passing (7/7 suites)
- [ ] Frontend production build passing with 0 errors
- [ ] Comprehensive verification report in `.gsd/PHASE_2_AI_COACH_REPORT.md`

---

## Historical Milestones

### Milestone 1.0: Tark AI Demo Ready (Checkpoint: d861de5)
- Phase 1: Python Runner Service & Test Execution API (✅ Complete)
- Phase 2: Session Event Logging & Decision Trail API (✅ Complete)
- Phase 3: Deterministic AI Guidance & Counterfactual Challenge (✅ Complete)
- Phase 4: Dynamic Evidence-Linked Skill Scoring (✅ Complete)
- Phase 5: Frontend Integration & State Sync (✅ Complete)
- Phase 6: End-to-End Validation & Verification (✅ Complete)


# Tark AI Coding Assessment Platform

A next-generation technical assessment platform combining an interactive coding cockpit, real-time telemetry, AI decision tracing, and evidence-linked skill reports.

---

## Directory Architecture

```
stitch_tark_ai_coding_assessment_platform/
├── frontend/        # Vite + Vanilla JS/CSS client application (IDE, Cockpit, Test Runner)
├── backend/         # Express REST API service (Sessions, Tests, AI hints, Reports)
├── designs/         # Visual UI designs, prototypes, and reference screens
├── scripts/         # Workspace validation and development utility scripts
├── adapters/        # AI model adapters (Claude, Gemini, GPT-OSS)
├── .gsd/            # Get-Shit-Done workflow specifications and roadmaps
└── PROJECT_RULES.md # Project standards and verification guidelines
```

---

## Quick Start

### 1. Frontend Development

```bash
cd frontend
npm install
npm run dev
```

Visit the app at `http://localhost:5173`.

### 2. Backend Development

```bash
cd backend
npm install
npm run dev
```

API available at `http://localhost:5000/api`.

---

## Key Modules

- **frontend/**: Interactive candidate evaluation IDE, test runner, AI interaction sidecar, and skill assessment views.
- **backend/**: Candidate session endpoints, test execution pipeline, telemetry synchronization, and decision trail logs.
- **designs/**: Exported visual prototypes and reference mockups for the platform screens.
- **scripts/**: Verification and repository maintenance automation.

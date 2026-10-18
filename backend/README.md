# Tark AI Assessment Platform — Backend Service

API service for managing candidate assessment sessions, real-time telemetry, test runner evaluations, AI assistance chats, and evidence-linked skill reports.

## Project Structure

```
backend/
├── package.json          # Node.js dependencies and scripts
├── .env.example          # Environment variable template
├── src/
│   ├── app.js            # Express app configuration & middleware
│   ├── server.js         # Entry point and HTTP listener
│   ├── routes/           # REST API route endpoints
│   │   └── index.js      # /api router aggregating all modules
│   ├── controllers/      # Request handlers & logic
│   │   ├── sessionController.js
│   │   ├── testController.js
│   │   ├── aiController.js
│   │   ├── telemetryController.js
│   │   └── reportController.js
│   └── data/
│       └── mockDatabase.js # In-memory candidate session store
```

## Available API Endpoints

- `GET  /api/health` — Service health check
- `GET  /api/session` — Retrieve candidate session metadata
- `PATCH /api/session` — Update session status
- `GET  /api/tests` — Fetch test cases and suites
- `POST /api/tests/run` — Run tests against submitted code
- `GET  /api/ai/chat` — Retrieve chat history with AI mentor
- `POST /api/ai/chat` — Send query to AI mentor and receive guidance
- `POST /api/telemetry/sync` — Synchronize candidate activity & telemetry
- `GET  /api/reports/decision-trail` — Fetch chronological decision events
- `GET  /api/reports/skill-report` — Retrieve candidate competency scores

## Quick Start

```bash
cd backend
npm install
npm run dev
```

import { Router } from 'express';
import { getSession, getSessionById, createSession, updateSessionStatus, listSessions } from '../controllers/sessionController.js';
import { getTests, runTests, getExecutionById } from '../controllers/testController.js';
import { getChatHistory, sendChatMessage } from '../controllers/aiController.js';
import { syncTelemetry } from '../controllers/telemetryController.js';
import { getDecisionTrail, getSkillReport } from '../controllers/reportController.js';

import { getVerifyTask, evaluateVerifyTask } from '../controllers/verifyController.js';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Tark AI Assessment API', time: new Date() });
});

// Candidate Session
router.get('/session', getSession);
router.post('/session', createSession);
router.patch('/session', updateSessionStatus);
router.get('/session/:id', getSessionById);
router.get('/sessions', listSessions);

// Evaluation & Tests
router.get('/tests', getTests);
router.post('/tests/run', runTests);
router.get('/executions/:id', getExecutionById);

// VERIFY Assessment
router.get('/verify/task', getVerifyTask);
router.post('/verify/evaluate', evaluateVerifyTask);

// AI Hints & Chat
router.get('/ai/chat', getChatHistory);
router.post('/ai/chat', sendChatMessage);

// Telemetry
router.post('/telemetry/sync', syncTelemetry);

// Decision Trail & Skill Report
router.get('/reports/decision-trail', getDecisionTrail);
router.get('/reports/skill-report', getSkillReport);

// Controlled Graceful Shutdown (Testing & Lifecycle Management)
// Protected: Disabled in production environment unless authorized with secret key
router.post('/shutdown', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const testToken = req.headers['x-test-token'] || req.query.token;
  const configuredSecret = process.env.SHUTDOWN_SECRET || 'tark-test-secure-shutdown-key';

  if (isProduction && testToken !== configuredSecret) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Shutdown endpoint is disabled in production environments without authorization'
    });
  }

  if (testToken && testToken !== configuredSecret) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Invalid authorization token for shutdown'
    });
  }

  res.json({ status: 'shutting_down', message: 'Tark AI backend terminating gracefully' });
  setTimeout(() => {
    process.exit(0);
  }, 100);
});

export default router;

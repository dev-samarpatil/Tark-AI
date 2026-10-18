import { Router } from 'express';
import { getSession, updateSessionStatus } from '../controllers/sessionController.js';
import { getTests, runTests } from '../controllers/testController.js';
import { getChatHistory, sendChatMessage } from '../controllers/aiController.js';
import { syncTelemetry } from '../controllers/telemetryController.js';
import { getDecisionTrail, getSkillReport } from '../controllers/reportController.js';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Tark AI Assessment API', time: new Date() });
});

// Candidate Session
router.get('/session', getSession);
router.patch('/session', updateSessionStatus);

// Evaluation & Tests
router.get('/tests', getTests);
router.post('/tests/run', runTests);

// AI Hints & Chat
router.get('/ai/chat', getChatHistory);
router.post('/ai/chat', sendChatMessage);

// Telemetry
router.post('/telemetry/sync', syncTelemetry);

// Decision Trail & Skill Report
router.get('/reports/decision-trail', getDecisionTrail);
router.get('/reports/skill-report', getSkillReport);

export default router;

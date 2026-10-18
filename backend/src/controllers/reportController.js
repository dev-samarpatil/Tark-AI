import { EventRepository } from '../repositories/eventRepository.js';
import { ReportRepository } from '../repositories/reportRepository.js';
import { mockDatabase } from '../data/mockDatabase.js';

export const getDecisionTrail = (req, res) => {
  const sessionId = req.query.sessionId || req.headers['x-session-id'] || '#TRK-8821';
  let events = EventRepository.getEvents(sessionId);
  let summary = EventRepository.getSummary(sessionId);

  if (events.length === 0 && sessionId === '#TRK-8821') {
    events = mockDatabase.decisionTrail;
    summary = {
      totalEvents: mockDatabase.decisionTrail.length,
      revisions: mockDatabase.revisions.length,
      aiPrompts: mockDatabase.decisionTrail.filter(e => e.type === 'ai').length,
      testRuns: mockDatabase.decisionTrail.filter(e => e.type === 'test').length
    };
  }

  res.json({
    success: true,
    sessionId,
    data: events,
    summary
  });
};

export const getSkillReport = (req, res) => {
  const sessionId = req.query.sessionId || req.headers['x-session-id'] || '#TRK-8821';
  const reportData = ReportRepository.generateReport(sessionId);

  if (!reportData) {
    return res.status(404).json({
      success: false,
      error: `Assessment session '${sessionId}' not found.`,
      code: 'SESSION_NOT_FOUND'
    });
  }

  res.json({
    success: true,
    data: reportData
  });
};

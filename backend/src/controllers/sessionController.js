import { SessionRepository } from '../repositories/sessionRepository.js';
import { mockDatabase } from '../data/mockDatabase.js';

export const getSession = (req, res) => {
  const sessionId = req.query.sessionId || req.headers['x-session-id'] || '#TRK-8821';
  const candidateId = req.query.candidateId || req.headers['x-candidate-id'];
  const session = SessionRepository.getSession(sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: `Session '${sessionId}' not found.`
      },
      code: 'SESSION_NOT_FOUND'
    });
  }

  // Identity authorization guard
  if (candidateId && session.candidateId && session.candidateId !== candidateId && candidateId !== 'cand-anon') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'SESSION_ACCESS_DENIED',
        message: `Candidate '${candidateId}' is not authorized to access session '${sessionId}'.`
      },
      code: 'SESSION_ACCESS_DENIED'
    });
  }

  // Sync to mockDatabase for backward compatibility
  mockDatabase.candidate = {
    ...session,
    name: session.name,
    sessionId: session.id,
    role: session.role,
    timeRemaining: session.timeRemaining,
    status: session.status,
    problem: session.problem
  };

  res.json({
    success: true,
    data: session
  });
};

export const getSessionById = (req, res) => {
  const { id } = req.params;
  const candidateId = req.query.candidateId || req.headers['x-candidate-id'];
  const session = SessionRepository.getSession(id);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: `Session '${id}' not found.`
      },
      code: 'SESSION_NOT_FOUND'
    });
  }

  if (candidateId && session.candidateId && session.candidateId !== candidateId && candidateId !== 'cand-anon') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'SESSION_ACCESS_DENIED',
        message: `Candidate '${candidateId}' is not authorized to access session '${id}'.`
      },
      code: 'SESSION_ACCESS_DENIED'
    });
  }

  res.json({
    success: true,
    data: session
  });
};

export const createSession = (req, res) => {
  try {
    const { sessionId, id, candidateId, candidateName, candidateRole, role, challengeId, timeRemaining, initialCode } = req.body || {};
    const targetSessionId = sessionId || id;

    // Idempotency: Return existing session if already created
    if (targetSessionId) {
      const existing = SessionRepository.getSession(targetSessionId);
      if (existing) {
        return res.status(200).json({
          success: true,
          data: existing
        });
      }
    }

    const session = SessionRepository.createSession({
      id: targetSessionId,
      candidateId,
      candidateName,
      candidateRole: candidateRole || role,
      challengeId,
      timeRemaining,
      initialCode
    });

    res.status(201).json({
      success: true,
      data: session
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message
      },
      code: 'VALIDATION_ERROR'
    });
  }
};

export const updateSessionStatus = (req, res) => {
  const sessionId = req.body.sessionId || req.query.sessionId || req.headers['x-session-id'] || '#TRK-8821';
  const { status, currentCode, currentMode } = req.body;

  let session = SessionRepository.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: `Session '${sessionId}' not found.`
      },
      code: 'SESSION_NOT_FOUND'
    });
  }

  try {
    if (currentCode !== undefined) {
      SessionRepository.updateCode(sessionId, currentCode);
    }
    if (currentMode !== undefined) {
      SessionRepository.updateMode(sessionId, currentMode);
    }
    if (status !== undefined) {
      session = SessionRepository.updateStatus(sessionId, status);
      mockDatabase.candidate.status = status;
    } else {
      session = SessionRepository.getSession(sessionId);
    }

    res.json({
      success: true,
      data: session
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_STATE_TRANSITION',
        message: err.message
      },
      code: 'INVALID_STATE_TRANSITION'
    });
  }
};

export const listSessions = (req, res) => {
  const candidateId = req.query.candidateId || null;
  const sessions = SessionRepository.listSessions(candidateId);
  res.json({
    success: true,
    data: sessions
  });
};

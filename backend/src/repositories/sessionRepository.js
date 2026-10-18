import { db } from '../services/persistence/db.js';

export class SessionRepository {
  /**
   * Format database row into candidate session schema expected by frontend and API clients.
   */
  static formatSession(row, challengeRow) {
    if (!row) return null;

    const problem = challengeRow || {
      id: row.challenge_id || 'TRK-P42',
      title: 'Find Duplicates in a List',
      difficulty: 'Medium-Hard',
      description: 'Return each integer that appears more than once, exactly once, preserving the order of its first appearance in the input array.',
      followUpDescription: 'Counterfactual Challenge: Return each integer that appears at least 3 times (min_count >= 3), preserving the order of its first appearance.',
      timeSpec: 'O(N)',
      memorySpec: 'O(N)'
    };

    return {
      sessionId: row.id,
      id: row.id,
      candidateId: row.candidate_id,
      name: row.candidate_name,
      role: row.candidate_role,
      status: row.status,
      timeRemaining: row.time_remaining,
      currentCode: row.current_code,
      challengeId: row.challenge_id,
      activeMode: row.active_mode,
      counterfactualCompleted: Boolean(row.counterfactual_completed),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      problem: {
        id: problem.id,
        title: problem.title,
        difficulty: problem.difficulty,
        description: problem.description,
        followUpDescription: problem.follow_up_description,
        timeSpec: problem.time_spec,
        memorySpec: problem.memory_spec
      }
    };
  }

  /**
   * Get session by ID, defaulting to '#TRK-8821'.
   */
  static getSession(sessionId = '#TRK-8821') {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (!session) return null;

    const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(session.challenge_id);
    return this.formatSession(session, challenge);
  }

  /**
   * Create a new session.
   */
  static createSession({
    id,
    candidateId = 'cand-anon',
    candidateName = 'Candidate Demo',
    candidateRole = 'Software Engineer',
    challengeId = 'TRK-P42',
    timeRemaining = '30:00',
    initialCode = null,
    status = 'in_progress'
  }) {
    const canonicalId = id || `TRK-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId);
    if (!challenge) {
      throw new Error(`Challenge with ID '${challengeId}' not found.`);
    }

    const code = initialCode || `from typing import List\n\ndef find_duplicates(nums: List[int]) -> List[int]:\n    # Implement solution\n    return []\n`;

    const stmt = db.prepare(`
      INSERT INTO sessions (
        id, candidate_id, candidate_name, candidate_role, status,
        time_remaining, current_code, challenge_id, active_mode,
        counterfactual_completed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'base', 0, ?, ?)
    `);

    stmt.run(
      canonicalId,
      candidateId,
      candidateName,
      candidateRole,
      status,
      timeRemaining,
      code,
      challengeId,
      now,
      now
    );

    return this.getSession(canonicalId);
  }

  /**
   * Update session status with lifecycle transition validation.
   */
  static updateStatus(sessionId = '#TRK-8821', newStatus) {
    const allowed = ['created', 'in_progress', 'completed', 'abandoned'];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid status: '${newStatus}'. Allowed: ${allowed.join(', ')}`);
    }

    const current = db.prepare('SELECT status FROM sessions WHERE id = ?').get(sessionId);
    if (!current) return null;

    // Disallow un-completing an already completed assessment
    if (current.status === 'completed' && newStatus === 'in_progress') {
      throw new Error('Completed assessments cannot be reset to in_progress.');
    }

    const now = new Date().toISOString();
    const completedAt = (newStatus === 'completed' || newStatus === 'abandoned') ? now : null;

    db.prepare(`
      UPDATE sessions 
      SET status = ?, updated_at = ?, completed_at = COALESCE(?, completed_at)
      WHERE id = ?
    `).run(newStatus, now, completedAt, sessionId);

    return this.getSession(sessionId);
  }

  /**
   * Update candidate code in session.
   */
  static updateCode(sessionId = '#TRK-8821', code) {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE sessions 
      SET current_code = ?, updated_at = ?
      WHERE id = ?
    `).run(code, now, sessionId);
  }

  /**
   * Update counterfactual challenge completion status.
   */
  static setCounterfactualCompleted(sessionId = '#TRK-8821', completed = true) {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE sessions 
      SET counterfactual_completed = ?, updated_at = ?
      WHERE id = ?
    `).run(completed ? 1 : 0, now, sessionId);
  }

  /**
   * List all sessions.
   */
  static listSessions(candidateId = null) {
    let rows;
    if (candidateId) {
      rows = db.prepare('SELECT * FROM sessions WHERE candidate_id = ? ORDER BY created_at DESC').all(candidateId);
    } else {
      rows = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all();
    }
    return rows.map(r => {
      const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(r.challenge_id);
      return this.formatSession(r, challenge);
    });
  }
}

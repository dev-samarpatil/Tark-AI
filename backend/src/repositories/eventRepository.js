import { db } from '../services/persistence/db.js';

export class EventRepository {
  /**
   * Format database event row into Decision Trail event schema.
   */
  static formatEvent(row) {
    if (!row) return null;
    let metadata = {};
    if (row.metadata_json) {
      try {
        metadata = JSON.parse(row.metadata_json);
      } catch (e) {
        metadata = {};
      }
    }

    return {
      id: row.id,
      sessionId: row.session_id,
      action: row.action,
      details: row.details,
      type: row.type,
      tag: row.tag,
      metadata,
      timestamp: row.created_at
    };
  }

  /**
   * Add an assessment event with duplicate protection.
   */
  static addEvent({
    sessionId = '#TRK-8821',
    action,
    details,
    type = 'system',
    tag = 'Event',
    metadata = {}
  }) {
    // Check most recent event for deduplication
    const lastRow = db.prepare(`
      SELECT * FROM assessment_events
      WHERE session_id = ?
      ORDER BY rowid DESC
      LIMIT 1
    `).get(sessionId);

    if (lastRow && lastRow.action === action && lastRow.details === details) {
      return this.formatEvent(lastRow);
    }

    // Sanitize metadata to guarantee no secrets leak into telemetry
    const safeMetadata = { ...metadata };
    delete safeMetadata.apiKey;
    delete safeMetadata.authorization;
    delete safeMetadata.GROQ_API_KEY;

    // Ensure referenced session exists so foreign key constraint never fails
    const sessRow = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
    if (!sessRow) {
      db.prepare(`
        INSERT OR IGNORE INTO sessions (
          id, candidate_id, candidate_name, candidate_role, status, time_remaining, current_code, challenge_id, active_mode, counterfactual_completed, created_at, updated_at
        ) VALUES (?, 'cand-anon', 'Candidate Demo', 'Software Engineer', 'in_progress', '30:00', '', 'TRK-P42', 'base', 0, ?, ?)
      `).run(sessionId, new Date().toISOString(), new Date().toISOString());
    }

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    db.prepare(`
      INSERT INTO assessment_events (id, session_id, action, details, type, tag, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      sessionId,
      action,
      details,
      type,
      tag,
      JSON.stringify(safeMetadata),
      timestamp
    );

    const inserted = db.prepare('SELECT * FROM assessment_events WHERE id = ? AND session_id = ?').get(eventId, sessionId);
    return this.formatEvent(inserted);
  }

  /**
   * Retrieve all events for a session in chronological order.
   */
  static getEvents(sessionId = '#TRK-8821') {
    const rows = db.prepare(`
      SELECT * FROM assessment_events
      WHERE session_id = ?
      ORDER BY rowid ASC
    `).all(sessionId);

    return rows.map(r => this.formatEvent(r));
  }

  /**
   * Retrieve summary metrics for the Decision Trail.
   */
  static getSummary(sessionId = '#TRK-8821') {
    const events = this.getEvents(sessionId);
    return {
      totalEvents: events.length,
      aiPrompts: events.filter(e => e.type === 'ai').length,
      testRuns: events.filter(e => e.type === 'test').length,
      revisions: events.filter(e => e.type === 'revision').length
    };
  }
}

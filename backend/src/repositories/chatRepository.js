import { db } from '../services/persistence/db.js';

export class ChatRepository {
  /**
   * Format database row into chat message object.
   */
  static formatMessage(row) {
    if (!row) return null;
    return {
      id: row.id,
      sessionId: row.session_id,
      sender: row.sender,
      text: row.text,
      message: row.text,
      reply: row.text,
      source: row.source,
      fallback: Boolean(row.fallback_used),
      fallbackUsed: Boolean(row.fallback_used),
      timestamp: row.created_at
    };
  }

  /**
   * Store a chat turn in persistent storage.
   */
  static addMessage({
    sessionId = '#TRK-8821',
    sender,
    text,
    source = null,
    fallbackUsed = false,
    timestamp = null
  }) {
    const time = timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Ensure referenced session exists so foreign key constraint never fails
    const sessRow = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
    if (!sessRow) {
      db.prepare(`
        INSERT OR IGNORE INTO sessions (
          id, candidate_id, candidate_name, candidate_role, status, time_remaining, current_code, challenge_id, active_mode, counterfactual_completed, created_at, updated_at
        ) VALUES (?, 'cand-anon', 'Candidate Demo', 'Software Engineer', 'in_progress', '30:00', '', 'TRK-P42', 'base', 0, ?, ?)
      `).run(sessionId, new Date().toISOString(), new Date().toISOString());
    }

    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    db.prepare(`
      INSERT INTO chat_messages (id, session_id, sender, text, source, fallback_used, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      sessionId,
      sender,
      text,
      source,
      fallbackUsed ? 1 : 0,
      time
    );

    const inserted = db.prepare('SELECT * FROM chat_messages WHERE id = ? AND session_id = ?').get(id, sessionId);
    return this.formatMessage(inserted);
  }

  /**
   * Retrieve all chat messages for a session.
   */
  static getMessages(sessionId = '#TRK-8821') {
    const rows = db.prepare(`
      SELECT * FROM chat_messages
      WHERE session_id = ?
      ORDER BY rowid ASC
    `).all(sessionId);

    return rows.map(r => this.formatMessage(r));
  }
}

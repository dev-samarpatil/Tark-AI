import { DatabaseSync } from 'node:sqlite';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let instance = null;

export function getDatabase(customPath = null) {
  if (instance && !customPath) return instance;

  const dbPath = customPath || process.env.DATABASE_PATH || resolve(__dirname, '../../../data/tark.sqlite');
  
  // Ensure directory exists if not memory
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  // Apply pragmas
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  // Schema creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      description TEXT NOT NULL,
      follow_up_description TEXT NOT NULL,
      time_spec TEXT NOT NULL,
      memory_spec TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0.0',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      candidate_name TEXT NOT NULL,
      candidate_role TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('created', 'in_progress', 'completed', 'abandoned')),
      time_remaining TEXT NOT NULL,
      current_code TEXT NOT NULL,
      challenge_id TEXT NOT NULL REFERENCES challenges(id),
      active_mode TEXT NOT NULL DEFAULT 'base',
      counterfactual_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      challenge_id TEXT NOT NULL REFERENCES challenges(id),
      mode TEXT NOT NULL,
      is_follow_up INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('completed', 'syntax_error', 'runtime_error', 'timeout', 'runner_error')),
      total_tests INTEGER NOT NULL DEFAULT 0,
      passed_tests INTEGER NOT NULL DEFAULT 0,
      failed_tests INTEGER NOT NULL DEFAULT 0,
      runtime TEXT NOT NULL DEFAULT '0ms',
      error TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS test_results (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
      test_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      input TEXT,
      expected TEXT,
      actual TEXT,
      status TEXT NOT NULL,
      passed INTEGER NOT NULL,
      duration TEXT,
      assertion TEXT
    );

    CREATE TABLE IF NOT EXISTS assessment_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      type TEXT NOT NULL,
      tag TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      sender TEXT NOT NULL CHECK(sender IN ('candidate', 'ai')),
      text TEXT NOT NULL,
      source TEXT CHECK(source IN ('groq', 'local') OR source IS NULL),
      fallback_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skill_reports (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      overall_score INTEGER,
      correctness_score INTEGER,
      autonomy_score INTEGER,
      error_recovery_score INTEGER,
      adaptability_score INTEGER,
      evidence_json TEXT NOT NULL,
      tamper_evident_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_executions_session ON executions(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_test_results_exec ON test_results(execution_id);
    CREATE INDEX IF NOT EXISTS idx_events_session ON assessment_events(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id, created_at);
  `);

  // Idempotent migrations for Phase 4
  try {
    db.exec('ALTER TABLE executions ADD COLUMN has_regression INTEGER DEFAULT 0;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE executions ADD COLUMN regression_details TEXT;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE skill_reports ADD COLUMN rubric_version TEXT DEFAULT "assessment-rubric-v1";');
  } catch (_) {}

  // Idempotently seed default Challenge
  const checkChallenge = db.prepare('SELECT id FROM challenges WHERE id = ?').get('TRK-P42');
  if (!checkChallenge) {
    const insertChallenge = db.prepare(`
      INSERT INTO challenges (id, title, difficulty, description, follow_up_description, time_spec, memory_spec, version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertChallenge.run(
      'TRK-P42',
      'Find Duplicates in a List',
      'Medium-Hard',
      'Return each integer that appears more than once, exactly once, preserving the order of its first appearance in the input array.',
      'Counterfactual Challenge: Return each integer that appears at least 3 times (min_count >= 3), preserving the order of its first appearance.',
      'O(N)',
      'O(N)',
      '1.0.0',
      new Date().toISOString()
    );
  }

  // Idempotently seed default Session #TRK-8821
  const checkSession = db.prepare('SELECT id FROM sessions WHERE id = ?').get('#TRK-8821');
  if (!checkSession) {
    const defaultCode = `from typing import List

def find_duplicates(nums: List[int]) -> List[int]:
    seen = set()
    duplicates = []
    
    # Bug Notice: Appending directly upon encountering 2nd instance
    for val in nums:
        if val in seen:
            if val not in duplicates:
                duplicates.append(val)
        else:
            seen.add(val)
            
    return duplicates
`;

    const now = new Date().toISOString();
    const insertSession = db.prepare(`
      INSERT INTO sessions (id, candidate_id, candidate_name, candidate_role, status, time_remaining, current_code, challenge_id, active_mode, counterfactual_completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertSession.run(
      '#TRK-8821',
      'cand-aarav-8821',
      'Aarav Sharma',
      'Senior Python Engineer',
      'in_progress',
      '24:18',
      defaultCode,
      'TRK-P42',
      'base',
      0,
      now,
      now
    );

    // Initial Starter Events for #TRK-8821
    const insertEvent = db.prepare(`
      INSERT INTO assessment_events (id, session_id, action, details, type, tag, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertEvent.run(
      'evt-1',
      '#TRK-8821',
      'Session Initialized',
      'Candidate started coding environment for Session #TRK-8821.',
      'system',
      'Scaffold',
      JSON.stringify({ sessionId: '#TRK-8821' }),
      '13:58:00'
    );

    insertEvent.run(
      'evt-2',
      '#TRK-8821',
      'Initial Scaffold Authored',
      'Baseline solution loop implemented with set() tracker.',
      'revision',
      'Revision 1',
      JSON.stringify({ codeLength: 312 }),
      '14:00:15'
    );

    insertEvent.run(
      'evt-3',
      '#TRK-8821',
      'Test Suite Executed',
      'Candidate ran tests. Result: 4 of 5 passed (Test 2 Ordering Preservation failed).',
      'test',
      'Failed',
      JSON.stringify({ passed: 4, total: 5 }),
      '14:01:45'
    );

    insertEvent.run(
      'evt-4',
      '#TRK-8821',
      'AI Diagnostic Query',
      'Candidate asked why Test 2 failed. Diagnostic explanation returned regarding first appearance preservation.',
      'ai',
      'Prompt',
      JSON.stringify({ query: 'Why did Test 2 fail?' }),
      '14:02:10'
    );

    // Initial Starter Chat Messages
    const insertChat = db.prepare(`
      INSERT INTO chat_messages (id, session_id, sender, text, source, fallback_used, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertChat.run(
      'msg-1',
      '#TRK-8821',
      'candidate',
      'Why did Test 2 fail with actual [2, 4] when the input array was [4, 2, 2, 4]?',
      null,
      0,
      '14:02:10'
    );

    insertChat.run(
      'msg-2',
      '#TRK-8821',
      'ai',
      '[Deterministic Diagnostic Engine - Local Test Analysis]\nIn your loop, an element is added to duplicates the exact moment its count reaches 2. In [4, 2, 2, 4], 2 reaches count 2 before 4 reaches count 2, so 2 is appended first even though 4 appeared first at index 0. Consider using collections.Counter or an auxiliary dictionary to preserve key insertion order.',
      'local',
      0,
      '14:02:12'
    );
  }

  if (!customPath) {
    instance = db;
  }
  return db;
}

export const db = getDatabase();

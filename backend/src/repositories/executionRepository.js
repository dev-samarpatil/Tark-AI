import { db } from '../services/persistence/db.js';

export class ExecutionRepository {
  /**
   * Save an execution and its child test results atomically in a single transaction.
   */
  static saveExecution({
    executionId,
    sessionId = '#TRK-8821',
    challengeId = 'TRK-P42',
    mode = 'base',
    isFollowUp = false,
    status = 'completed',
    summary = {},
    results = [],
    error = null,
    hasRegression = false,
    regressionDetails = null,
    createdAt = null
  }) {
    const canonicalId = executionId || `exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = createdAt || new Date().toISOString();

    const total = summary.total || results.length || 0;
    const passed = summary.passed || results.filter(r => r.passed).length || 0;
    const failed = summary.failed || (total - passed) || 0;
    const runtime = summary.runtime || '0ms';

    // Ensure referenced session exists so foreign key constraint never fails
    const sessRow = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
    if (!sessRow) {
      db.prepare(`
        INSERT OR IGNORE INTO sessions (
          id, candidate_id, candidate_name, candidate_role, status, time_remaining, current_code, challenge_id, active_mode, counterfactual_completed, created_at, updated_at
        ) VALUES (?, 'cand-anon', 'Candidate Demo', 'Software Engineer', 'in_progress', '30:00', '', ?, ?, 0, ?, ?)
      `).run(sessionId, challengeId, mode, now, now);
    }

    db.exec('BEGIN IMMEDIATE;');
    try {
      // 1. Insert execution header
      const insertExec = db.prepare(`
        INSERT INTO executions (
          id, session_id, challenge_id, mode, is_follow_up, status,
          total_tests, passed_tests, failed_tests, runtime, error,
          has_regression, regression_details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertExec.run(
        canonicalId,
        sessionId,
        challengeId,
        mode,
        isFollowUp ? 1 : 0,
        status,
        total,
        passed,
        failed,
        runtime,
        error,
        hasRegression ? 1 : 0,
        regressionDetails ? JSON.stringify(regressionDetails) : null,
        now
      );

      // 2. Insert individual test results
      if (Array.isArray(results) && results.length > 0) {
        const insertTest = db.prepare(`
          INSERT INTO test_results (
            id, execution_id, test_id, name, input, expected, actual,
            status, passed, duration, assertion
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const t of results) {
          const testResId = `tres_${canonicalId}_${t.id || Math.random().toString(36).substring(2, 6)}`;
          insertTest.run(
            testResId,
            canonicalId,
            t.id || 0,
            t.name || 'Unnamed Test',
            t.input !== undefined ? String(t.input) : null,
            t.expected !== undefined ? String(t.expected) : null,
            t.actual !== undefined ? String(t.actual) : null,
            t.status || (t.passed ? 'passed' : 'failed'),
            t.passed ? 1 : 0,
            t.duration || '0ms',
            t.assertion || null
          );
        }
      }

      db.exec('COMMIT;');
      return this.getExecution(canonicalId);
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  /**
   * Format execution and child test rows into canonical API schema.
   */
  static formatExecution(row, testRows = []) {
    if (!row) return null;

    const formattedTests = testRows.map(t => ({
      id: t.test_id,
      name: t.name,
      input: t.input,
      expected: t.expected,
      actual: t.actual,
      status: t.status,
      passed: Boolean(t.passed),
      duration: t.duration,
      assertion: t.assertion
    }));

    return {
      executionId: row.id,
      id: row.id,
      sessionId: row.session_id,
      challengeId: row.challenge_id,
      success: row.status === 'completed' && row.failed_tests === 0,
      status: row.status,
      mode: row.mode,
      assessmentMode: row.mode,
      isFollowUp: Boolean(row.is_follow_up),
      totalTests: row.total_tests,
      passedTests: row.passed_tests,
      failedTests: row.failed_tests,
      durationMs: parseInt(row.runtime, 10) || 45,
      summary: {
        total: row.total_tests,
        passed: row.passed_tests,
        failed: row.failed_tests,
        runtime: row.runtime
      },
      results: formattedTests,
      testResults: formattedTests,
      hasRegression: Boolean(row.has_regression),
      regressionDetails: row.regression_details ? JSON.parse(row.regression_details) : null,
      error: row.error,
      errorMessage: row.error,
      createdAt: row.created_at
    };
  }

  /**
   * Retrieve a specific execution by ID.
   */
  static getExecution(executionId) {
    const row = db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId);
    if (!row) return null;

    const testRows = db.prepare('SELECT * FROM test_results WHERE execution_id = ? ORDER BY test_id ASC').all(executionId);
    return this.formatExecution(row, testRows);
  }

  /**
   * Retrieve the latest execution for a session.
   */
  static getLatestExecution(sessionId = '#TRK-8821') {
    const row = db.prepare('SELECT * FROM executions WHERE session_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(sessionId);
    if (!row) return null;

    const testRows = db.prepare('SELECT * FROM test_results WHERE execution_id = ? ORDER BY test_id ASC').all(row.id);
    return this.formatExecution(row, testRows);
  }

  /**
   * List all executions for a session in chronological order.
   */
  static listExecutions(sessionId = '#TRK-8821') {
    const rows = db.prepare('SELECT * FROM executions WHERE session_id = ? ORDER BY created_at ASC, rowid ASC').all(sessionId);
    return rows.map(r => {
      const testRows = db.prepare('SELECT * FROM test_results WHERE execution_id = ? ORDER BY test_id ASC').all(r.id);
      return this.formatExecution(r, testRows);
    });
  }
}

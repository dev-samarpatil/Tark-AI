import { mockDatabase } from '../data/mockDatabase.js';
import { PythonRunner } from '../services/pythonRunner.js';

export const getTests = (req, res) => {
  res.json({
    success: true,
    data: mockDatabase.tests,
    latestExecution: mockDatabase.latestExecution
  });
};

export const runTests = async (req, res) => {
  const { code, isFollowUp = false } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Code string is required for execution.'
    });
  }

  // Save current code in session
  mockDatabase.currentCode = code;

  // Execute in isolated Python child process
  const execution = await PythonRunner.execute(code, isFollowUp);

  // Update session tests state with actual execution results
  if (execution.results && execution.results.length > 0) {
    mockDatabase.tests = execution.results;
  }
  mockDatabase.latestExecution = execution;

  const passed = execution.summary ? execution.summary.passed : 0;
  const total = execution.summary ? execution.summary.total : 0;
  const isAllPassed = passed === total;

  if (isFollowUp && isAllPassed) {
    mockDatabase.counterfactualCompleted = true;
  }

  // Record test execution in Decision Trail
  const tag = isAllPassed ? 'Passed' : (passed > 0 ? 'Partial' : 'Failed');
  const contextName = isFollowUp ? 'Follow-Up Counterfactual Suite' : 'Standard Test Suite';
  mockDatabase.addEvent({
    action: `Test Run: ${contextName}`,
    details: `${passed}/${total} tests passed (${execution.summary ? execution.summary.runtime : '0ms'}). ${isAllPassed ? 'All assertions satisfied.' : 'Encountered assertion/syntax discrepancies.'}`,
    type: 'test',
    tag,
    metadata: {
      passed,
      total,
      isFollowUp,
      runtime: execution.summary ? execution.summary.runtime : '0ms'
    }
  });

  // Track code revision if changed significantly
  const lastRev = mockDatabase.revisions[mockDatabase.revisions.length - 1];
  if (!lastRev || Math.abs(lastRev.codeLength - code.length) > 5) {
    mockDatabase.revisions.push({
      id: mockDatabase.revisions.length + 1,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      codeLength: code.length,
      note: `Code modified (${passed}/${total} passed)`
    });
  }

  res.json({
    success: execution.success,
    message: execution.success ? 'Test suite executed successfully' : (execution.error || 'Test suite encountered errors'),
    results: execution.results,
    summary: execution.summary,
    error: execution.error,
    isFollowUp
  });
};

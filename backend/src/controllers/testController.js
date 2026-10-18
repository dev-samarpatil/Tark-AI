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
  const { code, isFollowUp = false, mode = (isFollowUp ? 'follow-up' : 'base'), executionId } = req.body;

  if (typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Code string is required for execution.'
    });
  }

  // Save current code in session
  mockDatabase.currentCode = code;

  // Execute in isolated Python child process via testHarness
  const execution = await PythonRunner.execute(code, { mode, isFollowUp, executionId });

  // Update session tests state if test results exist
  if (execution.results && execution.results.length > 0) {
    mockDatabase.tests = execution.results;
  }
  mockDatabase.latestExecution = execution;

  const passed = execution.summary ? execution.summary.passed : 0;
  const total = execution.summary ? execution.summary.total : 0;
  const isAllPassed = (passed === total && execution.status === 'completed');

  if (execution.isFollowUp && isAllPassed) {
    mockDatabase.counterfactualCompleted = true;
  }

  // Determine event tag based on genuine execution status
  let tag = 'Failed';
  if (execution.status === 'syntax_error') tag = 'Syntax Error';
  else if (execution.status === 'runtime_error') tag = 'Runtime Error';
  else if (execution.status === 'timeout') tag = 'Timeout';
  else if (isAllPassed) tag = 'Passed';
  else if (passed > 0) tag = 'Partial';

  const contextName = execution.isFollowUp ? 'Follow-Up Counterfactual Suite' : 'Standard Test Suite';
  const detailMsg = execution.status === 'completed'
    ? `${passed}/${total} tests passed (${execution.summary ? execution.summary.runtime : '0ms'}). ${isAllPassed ? 'All assertions satisfied.' : 'Encountered assertion discrepancies.'}`
    : `Execution aborted (${execution.status}): ${execution.error || 'Check code definition'}`;

  // Log in Decision Trail
  mockDatabase.addEvent({
    action: `Test Run: ${contextName}`,
    details: detailMsg,
    type: 'test',
    tag,
    metadata: {
      executionId: execution.executionId,
      status: execution.status,
      passed,
      total,
      mode: execution.mode,
      isFollowUp: execution.isFollowUp,
      runtime: execution.summary ? execution.summary.runtime : '0ms'
    }
  });

  // Track code revision if modified
  const lastRev = mockDatabase.revisions[mockDatabase.revisions.length - 1];
  if (!lastRev || Math.abs(lastRev.codeLength - code.length) > 5) {
    mockDatabase.revisions.push({
      id: mockDatabase.revisions.length + 1,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      codeLength: code.length,
      note: `Code modified (Status: ${execution.status}, ${passed}/${total} passed)`
    });
  }

  res.json({
    executionId: execution.executionId,
    success: execution.success,
    status: execution.status,
    mode: execution.mode,
    isFollowUp: execution.isFollowUp,
    message: execution.error || (execution.success ? 'Test suite executed successfully' : 'Test suite completed with failures'),
    results: execution.results,
    summary: execution.summary,
    error: execution.error
  });
};

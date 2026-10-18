import { PythonRunner } from '../services/pythonRunner.js';
import { ExecutionRepository } from '../repositories/executionRepository.js';
import { SessionRepository } from '../repositories/sessionRepository.js';
import { EventRepository } from '../repositories/eventRepository.js';
import { mockDatabase } from '../data/mockDatabase.js';

export const getTests = (req, res) => {
  const sessionId = req.query.sessionId || req.headers['x-session-id'] || '#TRK-8821';
  const latestExecution = ExecutionRepository.getLatestExecution(sessionId);

  let tests = mockDatabase.tests;
  if (latestExecution && Array.isArray(latestExecution.results) && latestExecution.results.length > 0) {
    tests = latestExecution.results;
  }

  res.json({
    success: true,
    data: tests,
    latestExecution
  });
};

export const getExecutionById = (req, res) => {
  const { id } = req.params;
  const execution = ExecutionRepository.getExecution(id);

  if (!execution) {
    return res.status(404).json({
      success: false,
      error: `Execution '${id}' not found.`,
      code: 'EXECUTION_NOT_FOUND'
    });
  }

  res.json({
    success: true,
    data: execution
  });
};

export const runTests = async (req, res) => {
  const { code, isFollowUp = false, mode = (isFollowUp ? 'follow-up' : 'base'), executionId } = req.body;
  const sessionId = req.body.sessionId || req.query.sessionId || req.headers['x-session-id'] || '#TRK-8821';

  if (typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Code string is required for execution.',
      code: 'VALIDATION_ERROR'
    });
  }

  // Ensure session exists in SQLite before recording execution
  let session = SessionRepository.getSession(sessionId);
  if (!session) {
    try {
      SessionRepository.createSession({ id: sessionId });
    } catch (e) {}
  }

  // Update session code
  try {
    SessionRepository.updateCode(sessionId, code);
  } catch (e) {
    // Safe continue
  }
  mockDatabase.currentCode = code;

  // Execute in isolated Python child process via testHarness
  const execution = await PythonRunner.execute(code, { mode, isFollowUp, executionId });

  // Persist execution and test results atomically
  const savedExecution = ExecutionRepository.saveExecution({
    executionId: execution.executionId,
    sessionId,
    challengeId: 'TRK-P42',
    mode: execution.mode,
    isFollowUp: execution.isFollowUp,
    status: execution.status,
    summary: execution.summary,
    results: execution.results,
    error: execution.error
  });

  // Mirror to mockDatabase for backward compatibility
  if (savedExecution.results && savedExecution.results.length > 0) {
    mockDatabase.tests = savedExecution.results;
  }
  mockDatabase.latestExecution = savedExecution;

  const passed = savedExecution.summary ? savedExecution.summary.passed : 0;
  const total = savedExecution.summary ? savedExecution.summary.total : 0;
  const isAllPassed = (passed === total && savedExecution.status === 'completed');

  if (savedExecution.isFollowUp && isAllPassed) {
    SessionRepository.setCounterfactualCompleted(sessionId, true);
    mockDatabase.counterfactualCompleted = true;
  }

  // Determine event tag based on genuine execution status
  let tag = 'Failed';
  if (savedExecution.status === 'syntax_error') tag = 'Syntax Error';
  else if (savedExecution.status === 'runtime_error') tag = 'Runtime Error';
  else if (savedExecution.status === 'timeout') tag = 'Timeout';
  else if (isAllPassed) tag = 'Passed';
  else if (passed > 0) tag = 'Partial';

  const contextName = savedExecution.isFollowUp ? 'Follow-Up Counterfactual Suite' : 'Standard Test Suite';
  const detailMsg = savedExecution.status === 'completed'
    ? `${passed}/${total} tests passed (${savedExecution.summary ? savedExecution.summary.runtime : '0ms'}). ${isAllPassed ? 'All assertions satisfied.' : 'Encountered assertion discrepancies.'}`
    : `Execution aborted (${savedExecution.status}): ${savedExecution.error || 'Check code definition'}`;

  // Log in Decision Trail via EventRepository
  const event = EventRepository.addEvent({
    sessionId,
    action: `Test Run: ${contextName}`,
    details: detailMsg,
    type: 'test',
    tag,
    metadata: {
      executionId: savedExecution.executionId,
      status: savedExecution.status,
      passed,
      total,
      mode: savedExecution.mode,
      isFollowUp: savedExecution.isFollowUp,
      runtime: savedExecution.summary ? savedExecution.summary.runtime : '0ms'
    }
  });

  // Mirror event to mockDatabase
  mockDatabase.decisionTrail.push(event);

  // Track code revision if modified
  const lastRev = mockDatabase.revisions[mockDatabase.revisions.length - 1];
  if (!lastRev || Math.abs(lastRev.codeLength - code.length) > 5) {
    mockDatabase.revisions.push({
      id: mockDatabase.revisions.length + 1,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      codeLength: code.length,
      note: `Code modified (Status: ${savedExecution.status}, ${passed}/${total} passed)`
    });
  }

  res.json({
    executionId: savedExecution.executionId,
    success: savedExecution.success,
    status: savedExecution.status,
    mode: savedExecution.mode,
    isFollowUp: savedExecution.isFollowUp,
    message: savedExecution.error || (savedExecution.success ? 'Test suite executed successfully' : 'Test suite completed with failures'),
    results: savedExecution.results,
    summary: savedExecution.summary,
    error: savedExecution.error
  });
};

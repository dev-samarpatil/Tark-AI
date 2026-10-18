import { PythonRunner } from '../services/pythonRunner.js';
import { EventRepository } from '../repositories/eventRepository.js';
import { SessionRepository } from '../repositories/sessionRepository.js';

export const DEFECT_ID = 'DEFECT-ORDERING-01';
export const CORRECT_OPTION = 'B';

export const getVerifyTask = (req, res) => {
  res.json({
    success: true,
    data: {
      defectId: DEFECT_ID,
      title: 'Ordering Preservation Flaw',
      description: 'The candidate solution appends elements to duplicates upon encountering their second instance. For input [4, 2, 2, 4], this returns [2, 4] instead of expected [4, 2].',
      symptom: 'Test 2 fails: Returned [2, 4] instead of expected [4, 2].',
      targetInput: '[4, 2, 2, 4]',
      expectedOutput: '[4, 2]',
      options: [
        { id: 'A', text: 'Set membership test (val in seen) causes quadratic O(N^2) time complexity.' },
        { id: 'B', text: 'Appending on 2nd encounter orders items by second occurrence rather than first appearance index.' },
        { id: 'C', text: 'Negative numbers cannot be hashed by Python sets.' },
        { id: 'D', text: 'The function returns a list instead of a set.' }
      ]
    }
  });
};

export const evaluateVerify = async (req, res) => {
  const { defectId, selectedOption, code } = req.body || {};
  const sessionId = req.body.sessionId || req.query.sessionId || req.headers['x-session-id'] || '#TRK-8821';

  if (!selectedOption) {
    return res.status(400).json({
      success: false,
      error: 'selectedOption is required (A, B, C, or D).',
      code: 'VALIDATION_ERROR'
    });
  }

  const isCorrect = (selectedOption.toUpperCase() === CORRECT_OPTION);

  // Validate code fix if code provided
  let validated = false;
  let executionSummary = null;
  if (code && typeof code === 'string') {
    try {
      const execution = await PythonRunner.execute(code, { mode: 'base' });
      const test2 = (execution.results || []).find(r => r.id === 2);
      validated = Boolean(test2 && test2.passed);
      executionSummary = execution.summary;
    } catch (_) {}
  }

  const pointsEarned = (isCorrect ? 10 : 0) + (validated ? 10 : 0);

  // Record audit telemetry in Decision Trail
  EventRepository.addEvent({
    sessionId,
    action: 'Verify: Diagnosis Submitted',
    details: isCorrect
      ? `Correctly diagnosed ${defectId} (Option ${selectedOption}). Validation test ${validated ? 'Passed' : 'Pending/Failed'}.`
      : `Submitted diagnosis for ${defectId} (Option ${selectedOption}). Incorrect root cause selected.`,
    type: 'verify',
    tag: isCorrect ? 'Verify Passed' : 'Verify Failed',
    metadata: {
      defectId: defectId || DEFECT_ID,
      selectedOption,
      isCorrect,
      validated,
      pointsEarned,
      maxPoints: 20
    }
  });

  res.json({
    success: true,
    data: {
      defectId: defectId || DEFECT_ID,
      selectedOption,
      isCorrect,
      validated,
      pointsEarned,
      maximumPoints: 20,
      explanation: isCorrect
        ? 'Correct diagnosis: Appending on second occurrence inserts items based on their second occurrence time rather than their first seen index.'
        : 'Incorrect diagnosis: Appending immediately upon encountering the 2nd instance is what disrupts original first-appearance order.',
      executionSummary
    }
  });
};

export const evaluateVerifyTask = evaluateVerify;

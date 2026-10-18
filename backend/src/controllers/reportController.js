import { mockDatabase } from '../data/mockDatabase.js';

export const getDecisionTrail = (req, res) => {
  res.json({
    success: true,
    sessionId: mockDatabase.candidate.sessionId,
    data: mockDatabase.decisionTrail,
    summary: {
      totalEvents: mockDatabase.decisionTrail.length,
      revisions: mockDatabase.revisions.length,
      aiPrompts: mockDatabase.decisionTrail.filter(e => e.type === 'ai').length,
      testRuns: mockDatabase.decisionTrail.filter(e => e.type === 'test').length
    }
  });
};

export const getSkillReport = (req, res) => {
  const latestExec = mockDatabase.latestExecution;
  const testEvents = mockDatabase.decisionTrail.filter(e => e.type === 'test');
  const aiEvents = mockDatabase.decisionTrail.filter(e => e.type === 'ai');
  const revCount = mockDatabase.revisions.length;

  // 1. Algorithmic Correctness / Precision
  let correctnessScore = 0;
  let correctnessEvidence = 'No code execution recorded yet.';
  let hasExecution = false;

  if (latestExec && latestExec.summary) {
    hasExecution = true;
    const { passed, total, runtime } = latestExec.summary;
    correctnessScore = Math.round((passed / total) * 100);
    correctnessEvidence = `${passed}/${total} test cases verified (${runtime}). ${passed === total ? 'All boundary & ordering assertions satisfied.' : 'Encountered assertion/ordering mismatch.'}`;
  }

  // 2. Autonomy Index (Based on ratio of independent test iterations to AI requests)
  let autonomyScore = 100;
  let autonomyNote = 'High Independent Synthesis (No AI queries)';
  if (aiEvents.length > 0) {
    const penalty = Math.min(45, aiEvents.length * 12);
    autonomyScore = Math.max(55, 100 - penalty);
    autonomyNote = `${aiEvents.length} targeted AI assistance prompt(s) logged`;
  }

  // 3. Error Recovery (Did candidate fix test failures across revisions?)
  let errorRecoveryScore = null;
  let errorRecoveryEvidence = 'Insufficient Evidence: Single test iteration recorded.';
  if (testEvents.length >= 2) {
    const firstTest = testEvents[0].metadata || {};
    const lastTest = testEvents[testEvents.length - 1].metadata || {};
    if (lastTest.passed > firstTest.passed) {
      errorRecoveryScore = 92;
      errorRecoveryEvidence = `Candidate resolved failing test cases across ${revCount} code iterations.`;
    } else if (lastTest.passed === lastTest.total) {
      errorRecoveryScore = 95;
      errorRecoveryEvidence = 'Consistently maintained 100% test pass rate.';
    } else {
      errorRecoveryScore = 65;
      errorRecoveryEvidence = 'Candidate iterated but assertion discrepancies remain.';
    }
  } else if (hasExecution && latestExec.summary.passed === latestExec.summary.total) {
    errorRecoveryScore = 90;
    errorRecoveryEvidence = 'Clean first-pass implementation without regressions.';
  }

  // 4. Adaptability (Counterfactual Challenge)
  let adaptabilityScore = null;
  let adaptabilityEvidence = 'Not Attempted: Counterfactual Follow-up challenge has not been executed yet.';
  if (mockDatabase.counterfactualCompleted) {
    adaptabilityScore = 96;
    adaptabilityEvidence = 'Successfully adapted implementation to satisfy Counterfactual frequency threshold (>=3).';
  } else if (latestExec && latestExec.isFollowUp) {
    adaptabilityScore = Math.round((latestExec.summary.passed / latestExec.summary.total) * 100);
    adaptabilityEvidence = `Follow-up requirement executed: ${latestExec.summary.passed}/${latestExec.summary.total} adaptation tests passing.`;
  }

  // 5. Overall Objective Benchmark
  const weightedParts = [];
  if (hasExecution) weightedParts.push(correctnessScore * 0.4);
  weightedParts.push(autonomyScore * 0.25);
  if (errorRecoveryScore !== null) weightedParts.push(errorRecoveryScore * 0.2);
  else weightedParts.push(autonomyScore * 0.2);
  if (adaptabilityScore !== null) weightedParts.push(adaptabilityScore * 0.15);
  else weightedParts.push(correctnessScore * 0.15);

  const overallScore = Math.round(weightedParts.reduce((a, b) => a + b, 0));

  // Evidence Summary grounded in timestamped session events
  const groundedEvidence = [];
  if (hasExecution) {
    groundedEvidence.push(`Latest Test Suite: ${latestExec.summary.passed}/${latestExec.summary.total} passing (${latestExec.summary.runtime})`);
  }
  if (aiEvents.length > 0) {
    groundedEvidence.push(`AI Collaboration: ${aiEvents.length} prompt interaction(s) logged in Decision Trail`);
  }
  if (mockDatabase.counterfactualCompleted) {
    groundedEvidence.push('Requirement Evolution: Successfully completed Counterfactual Adaptation challenge');
  } else {
    groundedEvidence.push('Requirement Evolution: Counterfactual follow-up pending');
  }

  res.json({
    success: true,
    data: {
      candidate: mockDatabase.candidate,
      hasExecution,
      scores: {
        overall: hasExecution ? overallScore : null,
        correctness: hasExecution ? correctnessScore : null,
        autonomy: autonomyScore,
        errorRecovery: errorRecoveryScore,
        adaptability: adaptabilityScore
      },
      evidence: {
        correctness: correctnessEvidence,
        autonomy: autonomyNote,
        errorRecovery: errorRecoveryEvidence,
        adaptability: adaptabilityEvidence
      },
      evidenceSummary: groundedEvidence,
      tamperEvidentHash: `0x${Math.abs(hashString(mockDatabase.candidate.sessionId + mockDatabase.decisionTrail.length + (latestExec ? latestExec.summary.passed : 0))).toString(16).padStart(6, '0')}`
    }
  });
};

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

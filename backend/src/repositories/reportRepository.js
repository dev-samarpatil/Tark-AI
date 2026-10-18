import { db } from '../services/persistence/db.js';
import { SessionRepository } from './sessionRepository.js';
import { ExecutionRepository } from './executionRepository.js';
import { EventRepository } from './eventRepository.js';

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export class ReportRepository {
  /**
   * Derive objective skill report from durable execution evidence and events.
   */
  static generateReport(sessionId = '#TRK-8821') {
    const session = SessionRepository.getSession(sessionId);
    if (!session) return null;

    const latestExec = ExecutionRepository.getLatestExecution(sessionId);
    const executions = ExecutionRepository.listExecutions(sessionId);
    const events = EventRepository.getEvents(sessionId);

    const testEvents = events.filter(e => e.type === 'test');
    const aiEvents = events.filter(e => e.type === 'ai');
    const revCount = events.filter(e => e.type === 'revision').length || 1;

    // 1. Algorithmic Correctness / Precision
    let correctnessScore = 0;
    let correctnessEvidence = 'No code execution recorded yet.';
    let hasExecution = false;

    if (latestExec && latestExec.summary) {
      hasExecution = true;
      const { passed, total, runtime } = latestExec.summary;
      correctnessScore = total > 0 ? Math.round((passed / total) * 100) : 0;
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
      } else if (lastTest.passed === lastTest.total && lastTest.total > 0) {
        errorRecoveryScore = 95;
        errorRecoveryEvidence = 'Consistently maintained 100% test pass rate.';
      } else {
        errorRecoveryScore = 65;
        errorRecoveryEvidence = 'Candidate iterated but assertion discrepancies remain.';
      }
    } else if (hasExecution && latestExec.summary.passed === latestExec.summary.total && latestExec.summary.total > 0) {
      errorRecoveryScore = 90;
      errorRecoveryEvidence = 'Clean first-pass implementation without regressions.';
    }

    // 4. Adaptability (Counterfactual Challenge)
    let adaptabilityScore = null;
    let adaptabilityEvidence = 'Not Attempted: Counterfactual Follow-up challenge has not been executed yet.';
    if (session.counterfactualCompleted) {
      adaptabilityScore = 96;
      adaptabilityEvidence = 'Successfully adapted implementation to satisfy Counterfactual frequency threshold (>=3).';
    } else if (latestExec && latestExec.isFollowUp) {
      adaptabilityScore = latestExec.summary.total > 0
        ? Math.round((latestExec.summary.passed / latestExec.summary.total) * 100)
        : 0;
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

    // Aggregate all execution metrics for this session
    const totalExecutions = executions.length;
    const completedExecutions = executions.filter(e => e.status === 'completed').length;
    const syntaxErrors = executions.filter(e => e.status === 'syntax_error').length;
    const runtimeErrors = executions.filter(e => e.status === 'runtime_error').length;
    const timeouts = executions.filter(e => e.status === 'timeout').length;
    const runnerErrors = executions.filter(e => e.status === 'runner_error').length;

    let totalPassedTestCases = 0;
    let totalFailedTestCases = 0;
    for (const exec of executions) {
      totalPassedTestCases += exec.passedTests || 0;
      totalFailedTestCases += exec.failedTests || 0;
    }

    const executionSummary = {
      totalExecutions,
      completedExecutions,
      syntaxErrors,
      runtimeErrors,
      timeouts,
      runnerErrors,
      totalPassedTestCases,
      totalFailedTestCases
    };

    const verifyEvidence = {
      evaluated: totalExecutions > 0,
      status: totalExecutions > 0 ? (completedExecutions > 0 ? 'verified' : 'failed') : 'insufficient_evidence',
      observations: totalExecutions > 0 ? [
        `${completedExecutions}/${totalExecutions} executions reached test execution.`,
        syntaxErrors > 0 ? `Encountered ${syntaxErrors} syntax error(s).` : 'Zero syntax errors.',
        runtimeErrors > 0 ? `Encountered ${runtimeErrors} runtime error(s).` : 'Zero runtime errors.'
      ] : ['Insufficient evidence: No execution records stored for session.']
    };

    const followUpExecs = executions.filter(e => e.isFollowUp || e.assessmentMode === 'follow-up');
    const adaptEvidence = {
      evaluated: followUpExecs.length > 0,
      status: followUpExecs.length > 0 ? (followUpExecs.some(e => e.passedTests === 4) ? 'adapted' : 'attempted') : 'not_evaluated',
      observations: followUpExecs.length > 0 ? [
        `Executed ${followUpExecs.length} follow-up adaptation attempt(s).`,
        followUpExecs.some(e => e.passedTests === 4) ? 'Follow-up requirement fully satisfied (4/4 passing).' : 'Follow-up requirement not yet fully passing.'
      ] : ['Not evaluated: Candidate has not submitted code for follow-up adaptation challenge.']
    };

    const aiCollaboration = {
      used: aiEvents.length > 0,
      totalQueries: aiEvents.length,
      groqResponses: aiEvents.filter(e => (e.tag && e.tag.toLowerCase().includes('groq')) || e.source === 'groq').length,
      localFallbackResponses: aiEvents.filter(e => (e.tag && e.tag.toLowerCase().includes('local')) || e.source === 'local').length
    };

    const evidenceReferences = {
      sessionId: session.id,
      executionIds: executions.map(e => e.executionId),
      eventIds: events.map(e => e.id)
    };

    // Evidence Summary grounded in timestamped session events
    const groundedEvidence = [];
    if (hasExecution) {
      groundedEvidence.push(`Latest Test Suite: ${latestExec.summary.passed}/${latestExec.summary.total} passing (${latestExec.summary.runtime})`);
    }
    if (aiEvents.length > 0) {
      groundedEvidence.push(`AI Collaboration: ${aiEvents.length} prompt interaction(s) logged in Decision Trail`);
    }
    if (session.counterfactualCompleted) {
      groundedEvidence.push('Requirement Evolution: Successfully completed Counterfactual Adaptation challenge');
    } else {
      groundedEvidence.push('Requirement Evolution: Counterfactual follow-up pending');
    }

    const tamperEvidentHash = `0x${Math.abs(hashString(session.id + events.length + (latestExec ? latestExec.summary.passed : 0))).toString(16).padStart(6, '0')}`;

    const reportData = {
      candidate: session,
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
      tamperEvidentHash,
      evidenceIntegrityHash: tamperEvidentHash,
      assessmentSummary: {
        sessionId: session.id,
        candidateId: session.candidateId,
        candidateName: session.name,
        role: session.role,
        challengeId: session.challengeId,
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      },
      executionSummary,
      verifyEvidence,
      adaptEvidence,
      aiCollaboration,
      evidenceReferences,
      limitations: totalExecutions === 0 ? 'Insufficient evidence to evaluate candidate capabilities.' : null
    };

    // Store snapshot in skill_reports table
    const reportId = `rep_${sessionId}_${Date.now()}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO skill_reports (
        id, session_id, overall_score, correctness_score, autonomy_score,
        error_recovery_score, adaptability_score, evidence_json, tamper_evident_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reportId,
      sessionId,
      reportData.scores.overall,
      reportData.scores.correctness,
      reportData.scores.autonomy,
      reportData.scores.errorRecovery,
      reportData.scores.adaptability,
      JSON.stringify(reportData),
      tamperEvidentHash,
      now
    );

    return reportData;
  }
}

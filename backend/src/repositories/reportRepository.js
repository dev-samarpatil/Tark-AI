import { db } from '../services/persistence/db.js';
import { SessionRepository } from './sessionRepository.js';
import { ExecutionRepository } from './executionRepository.js';
import { EventRepository } from './eventRepository.js';
import { AssessmentEngine, RUBRIC_VERSION } from '../services/assessmentEngine.js';

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

    // Evaluate using deterministic AssessmentEngine
    const evaluation = AssessmentEngine.evaluateAssessment({ session, executions, events });

    const coreDim = evaluation.dimensions.find(d => d.dimension === 'core_correctness');
    const verifyDim = evaluation.dimensions.find(d => d.dimension === 'verify_ability');
    const adaptDim = evaluation.dimensions.find(d => d.dimension === 'adapt_ability');
    const debugDim = evaluation.dimensions.find(d => d.dimension === 'debug_recovery');
    const valDim = evaluation.dimensions.find(d => d.dimension === 'validation_discipline');

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
      evaluated: verifyDim.status === 'measured',
      status: verifyDim.status,
      observations: [
        verifyDim.explanation,
        `${completedExecutions}/${totalExecutions} executions reached test harness.`
      ]
    };

    const adaptEvidence = {
      evaluated: adaptDim.status === 'measured',
      status: adaptDim.status,
      observations: [
        adaptDim.explanation,
        session.counterfactualCompleted ? 'Counterfactual adaptation satisfied (min_count >= 3).' : 'Counterfactual adaptation pending or in progress.'
      ]
    };

    const evidenceReferences = {
      sessionId: session.id,
      executionIds: executions.map(e => e.executionId),
      eventIds: events.map(e => e.id)
    };

    // Grounded evidence timeline items
    const groundedEvidence = [];
    if (latestExec && latestExec.summary) {
      groundedEvidence.push(`Latest Test Suite: ${latestExec.summary.passed}/${latestExec.summary.total} passing (${latestExec.summary.runtime})`);
    }
    if (evaluation.aiCollaboration.used) {
      groundedEvidence.push(`AI Collaboration: ${evaluation.aiCollaboration.totalQueries} prompt interaction(s) logged in Decision Trail`);
    }
    if (session.counterfactualCompleted) {
      groundedEvidence.push('Requirement Evolution: Successfully completed Counterfactual Adaptation challenge');
    } else {
      groundedEvidence.push('Requirement Evolution: Counterfactual follow-up pending');
    }

    const tamperEvidentHash = `0x${Math.abs(hashString(session.id + events.length + (latestExec ? latestExec.summary.passed : 0))).toString(16).padStart(6, '0')}`;

    const reportData = {
      rubricVersion: RUBRIC_VERSION,
      candidate: session,
      hasExecution: totalExecutions > 0,
      overallScore: evaluation.overallScore,
      isProvisional: evaluation.isProvisional,
      coveragePercent: evaluation.coveragePercent,
      assessmentStatus: session.status || 'in_progress',
      dimensions: evaluation.dimensions,
      scores: {
        overall: evaluation.overallScore,
        correctness: coreDim.status === 'measured' ? Math.round((coreDim.earnedPoints / 40) * 100) : null,
        verify: verifyDim.status === 'measured' ? Math.round((verifyDim.earnedPoints / 20) * 100) : null,
        autonomy: 100, // Zero arbitrary penalty policy
        errorRecovery: debugDim.status === 'measured' ? Math.round((debugDim.earnedPoints / 10) * 100) : null,
        adaptability: adaptDim.status === 'measured' ? Math.round((adaptDim.earnedPoints / 25) * 100) : null
      },
      evidence: {
        correctness: coreDim.explanation,
        verify: verifyDim.explanation,
        autonomy: evaluation.aiCollaboration.explanation,
        errorRecovery: debugDim.explanation,
        adaptability: adaptDim.explanation
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
      aiCollaboration: evaluation.aiCollaboration,
      evidenceReferences,
      limitations: totalExecutions === 0 ? 'Insufficient evidence to evaluate candidate capabilities.' : null
    };

    // Store snapshot in skill_reports table
    const reportId = `rep_${sessionId}_${Date.now()}`;
    const now = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO skill_reports (
          id, session_id, overall_score, correctness_score, autonomy_score,
          error_recovery_score, adaptability_score, evidence_json, tamper_evident_hash, rubric_version, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        RUBRIC_VERSION,
        now
      );
    } catch (_) {
      // Fallback if rubric_version column migration has not executed yet
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
    }

    return reportData;
  }
}

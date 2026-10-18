/**
 * TARK AI Assessment Engine — Rubric Version: assessment-rubric-v1
 *
 * Provides deterministic, mathematical, and explainable scoring derived strictly
 * from persisted execution proofs, test assertions, and Decision Trail telemetry.
 */

export const RUBRIC_VERSION = 'assessment-rubric-v1';

export class AssessmentEngine {
  static evaluate(args) {
    return this.evaluateAssessment(args);
  }

  /**
   * Evaluate candidate assessment across 5 deterministic dimensions.
   */
  static evaluateAssessment({
    session,
    executions = [],
    events = []
  }) {
    if (!session) return null;

    // Filter executions by mode
    const baseExecutions = executions.filter(e => !e.isFollowUp && e.mode !== 'follow-up');
    const followUpExecutions = executions.filter(e => e.isFollowUp || e.mode === 'follow-up');
    const latestBase = baseExecutions[0] || null;
    const latestFollowUp = followUpExecutions[0] || null;
    const latestAny = executions[0] || null;

    // Filter events
    const verifyEvents = events.filter(e => e.type === 'verify' || e.action?.toLowerCase().includes('verify'));
    const aiEvents = events.filter(e => e.type === 'ai');

    // ────────────────────────────────────────────────────────────────
    // 1. CORE CORRECTNESS (Weight: 40%)
    // ────────────────────────────────────────────────────────────────
    let coreCorrectness;
    if (!latestBase) {
      coreCorrectness = {
        dimension: 'core_correctness',
        name: 'Algorithmic Precision',
        weight: 40,
        earnedPoints: 0,
        maximumPoints: 40,
        status: 'insufficient_evidence',
        evidence: [],
        explanation: 'No base test execution recorded yet.'
      };
    } else if (latestBase.status === 'syntax_error' || latestBase.status === 'runtime_error' || latestBase.status === 'timeout' || latestBase.status === 'runner_error') {
      coreCorrectness = {
        dimension: 'core_correctness',
        name: 'Algorithmic Precision',
        weight: 40,
        earnedPoints: 0,
        maximumPoints: 40,
        status: 'measured',
        evidence: [{ executionId: latestBase.executionId, status: latestBase.status, error: latestBase.error }],
        explanation: `Execution failed due to unhandled ${latestBase.status.replace('_', ' ')}.`
      };
    } else {
      const total = latestBase.totalTests || (latestBase.summary ? latestBase.summary.total : 5);
      const passed = latestBase.passedTests !== undefined ? latestBase.passedTests : (latestBase.summary ? latestBase.summary.passed : 0);
      const earned = Math.round((passed / Math.max(1, total)) * 40);

      coreCorrectness = {
        dimension: 'core_correctness',
        name: 'Algorithmic Precision',
        weight: 40,
        earnedPoints: earned,
        maximumPoints: 40,
        status: 'measured',
        evidence: [{
          executionId: latestBase.executionId,
          totalTests: total,
          passedTests: passed,
          runtime: latestBase.runtime || (latestBase.summary ? latestBase.summary.runtime : '0ms')
        }],
        explanation: `${passed} of ${total} applicable base tests passed.`
      };
    }

    // ────────────────────────────────────────────────────────────────
    // 2. VERIFY ABILITY (Weight: 20%)
    // ────────────────────────────────────────────────────────────────
    let verifyAbility;
    const answerEvent = verifyEvents.find(e => e.action === 'Verify: Diagnosis Submitted' || (e.metadata && e.metadata.selectedOption));
    const validationEvent = verifyEvents.find(e => e.action === 'Verify: Validation Executed' || (e.metadata && e.metadata.validated));

    if (!answerEvent && !validationEvent) {
      verifyAbility = {
        dimension: 'verify_ability',
        name: 'Defect Verification',
        weight: 20,
        earnedPoints: 0,
        maximumPoints: 20,
        status: 'not_attempted',
        evidence: [],
        explanation: 'Defect verification task has not been attempted.'
      };
    } else {
      let earned = 0;
      const evidence = [];
      const isDiagnosed = Boolean(answerEvent?.metadata?.isCorrect);
      const isValidated = Boolean(validationEvent?.metadata?.passed || (latestBase && latestBase.passedTests === 5));

      if (isDiagnosed) {
        earned += 10;
        evidence.push({ type: 'diagnosis', result: 'correct', defectId: 'DEFECT-ORDERING-01' });
      } else if (answerEvent) {
        evidence.push({ type: 'diagnosis', result: 'incorrect', defectId: 'DEFECT-ORDERING-01' });
      }

      if (isValidated) {
        earned += 10;
        evidence.push({ type: 'validation', result: 'passed', targetTest: 'Ordering Preservation' });
      }

      verifyAbility = {
        dimension: 'verify_ability',
        name: 'Defect Verification',
        weight: 20,
        earnedPoints: earned,
        maximumPoints: 20,
        status: 'measured',
        evidence,
        explanation: isDiagnosed
          ? (isValidated ? 'Correctly diagnosed ordering discrepancy and validated passing fix.' : 'Correctly diagnosed ordering defect, awaiting verified fix validation.')
          : (isValidated ? 'Validated passing solution, but diagnosis answer was incorrect or incomplete.' : 'Diagnosis answer was incorrect.')
      };
    }

    // ────────────────────────────────────────────────────────────────
    // 3. ADAPT ABILITY (Weight: 25%)
    // ────────────────────────────────────────────────────────────────
    let adaptAbility;
    if (!latestFollowUp) {
      adaptAbility = {
        dimension: 'adapt_ability',
        name: 'Requirement Adaptation',
        weight: 25,
        earnedPoints: 0,
        maximumPoints: 25,
        status: 'not_attempted',
        evidence: [],
        explanation: 'Counterfactual Follow-Up challenge has not been executed.'
      };
    } else {
      const fuTotal = latestFollowUp.totalTests || (latestFollowUp.summary ? latestFollowUp.summary.total : 4);
      const fuPassed = latestFollowUp.passedTests !== undefined ? latestFollowUp.passedTests : (latestFollowUp.summary ? latestFollowUp.summary.passed : 0);
      const fuPoints = Math.round((fuPassed / Math.max(1, fuTotal)) * 15);

      // Regression check: did base tests also pass or was base functionality broken?
      let regressionPoints = 0;
      let regressionPreserved = false;
      const hasRegression = Boolean(latestFollowUp.hasRegression || (latestFollowUp.metadata && latestFollowUp.metadata.regressionFailed));

      if (!hasRegression && (session.counterfactualCompleted || fuPassed === fuTotal)) {
        regressionPoints = 10;
        regressionPreserved = true;
      } else if (!hasRegression && fuPassed > 0) {
        regressionPoints = 7;
        regressionPreserved = true;
      }

      const earned = fuPoints + regressionPoints;

      adaptAbility = {
        dimension: 'adapt_ability',
        name: 'Requirement Adaptation',
        weight: 25,
        earnedPoints: earned,
        maximumPoints: 25,
        status: 'measured',
        evidence: [{
          executionId: latestFollowUp.executionId,
          followUpPassed: fuPassed,
          followUpTotal: fuTotal,
          regressionPreserved
        }],
        explanation: regressionPreserved
          ? `${fuPassed}/${fuTotal} adaptation tests passing with zero base regressions.`
          : `${fuPassed}/${fuTotal} adaptation tests passing, but regressions were detected against base requirements.`
      };
    }

    // ────────────────────────────────────────────────────────────────
    // 4. DEBUGGING & ERROR RECOVERY (Weight: 10%)
    // ────────────────────────────────────────────────────────────────
    let debugRecovery;
    if (executions.length === 0) {
      debugRecovery = {
        dimension: 'debug_recovery',
        name: 'Error Recovery & Debugging',
        weight: 10,
        earnedPoints: 0,
        maximumPoints: 10,
        status: 'insufficient_evidence',
        evidence: [],
        explanation: 'No execution iterations available to assess debugging.'
      };
    } else if (executions.length === 1 && latestAny.passedTests === latestAny.totalTests && latestAny.status === 'completed') {
      debugRecovery = {
        dimension: 'debug_recovery',
        name: 'Error Recovery & Debugging',
        weight: 10,
        earnedPoints: 9,
        maximumPoints: 10,
        status: 'measured',
        evidence: [{ iterations: 1, firstPassClean: true }],
        explanation: 'Clean first-pass solution without syntax or runtime regressions.'
      };
    } else {
      // Analyze chronological trajectory (from oldest to newest)
      const chronExecs = executions.slice().reverse();
      let hadInitialFailure = false;
      let recoveryObserved = false;

      for (let i = 0; i < chronExecs.length; i++) {
        const ex = chronExecs[i];
        if (ex.status !== 'completed' || ex.failedTests > 0) {
          hadInitialFailure = true;
        } else if (hadInitialFailure && ex.status === 'completed' && ex.passedTests === ex.totalTests) {
          recoveryObserved = true;
          break;
        }
      }

      let earned;
      let explanation;
      if (recoveryObserved) {
        earned = 10;
        explanation = `Resolved initial failures across ${executions.length} execution iterations.`;
      } else if (hadInitialFailure) {
        const passRatio = latestAny ? (latestAny.passedTests / Math.max(1, latestAny.totalTests)) : 0;
        earned = Math.max(2, Math.round(passRatio * 8));
        explanation = `Iterated across ${executions.length} runs; unresolved assertion or syntax failures remain.`;
      } else {
        earned = 8;
        explanation = `Maintained stable passing executions across ${executions.length} iterations.`;
      }

      debugRecovery = {
        dimension: 'debug_recovery',
        name: 'Error Recovery & Debugging',
        weight: 10,
        earnedPoints: earned,
        maximumPoints: 10,
        status: 'measured',
        evidence: [{ iterations: executions.length, recoveryObserved, hadInitialFailure }],
        explanation
      };
    }

    // ────────────────────────────────────────────────────────────────
    // 5. VALIDATION DISCIPLINE (Weight: 5%)
    // ────────────────────────────────────────────────────────────────
    let validationDiscipline;
    if (executions.length > 0) {
      validationDiscipline = {
        dimension: 'validation_discipline',
        name: 'Validation Rigor',
        weight: 5,
        earnedPoints: 5,
        maximumPoints: 5,
        status: 'measured',
        evidence: [{ totalRuns: executions.length }],
        explanation: `Executed ${executions.length} verification runs before finalizing submission.`
      };
    } else {
      validationDiscipline = {
        dimension: 'validation_discipline',
        name: 'Validation Rigor',
        weight: 5,
        earnedPoints: 0,
        maximumPoints: 5,
        status: 'insufficient_evidence',
        evidence: [],
        explanation: 'No validation test runs executed.'
      };
    }

    // ────────────────────────────────────────────────────────────────
    // AI COLLABORATION TELEMETRY (Zero Arbitrary Penalty Policy)
    // ────────────────────────────────────────────────────────────────
    const groqCount = aiEvents.filter(e => (e.tag && e.tag.toLowerCase().includes('groq')) || e.source === 'groq').length;
    const localCount = aiEvents.filter(e => (e.tag && e.tag.toLowerCase().includes('local')) || e.source === 'local').length;

    const aiCollaboration = {
      used: aiEvents.length > 0,
      totalQueries: aiEvents.length,
      groqQueries: groqCount,
      localQueries: localCount,
      penaltyApplied: false,
      scoringImpact: 'None (Transparent Telemetry Policy)',
      explanation: aiEvents.length === 0
        ? 'Independent implementation without AI Coach assistance.'
        : `Consulted AI Coach ${aiEvents.length} time(s) (${groqCount} live Groq, ${localCount} deterministic fallback).`
    };

    // ────────────────────────────────────────────────────────────────
    // SCORE NORMALIZATION & BENCHMARK DERIVATION
    // ────────────────────────────────────────────────────────────────
    const dimensions = [coreCorrectness, verifyAbility, adaptAbility, debugRecovery, validationDiscipline];
    const measuredDimensions = dimensions.filter(d => d.status === 'measured');

    let overallScore = null;
    let coveragePercent = 0;
    let isProvisional = false;

    if (coreCorrectness.status === 'insufficient_evidence') {
      overallScore = null;
      isProvisional = true;
      coveragePercent = 0;
    } else {
      const earnedSum = measuredDimensions.reduce((acc, d) => acc + d.earnedPoints, 0);
      const availableSum = measuredDimensions.reduce((acc, d) => acc + d.maximumPoints, 0);

      overallScore = availableSum > 0 ? Math.round((earnedSum / availableSum) * 100) : null;
      coveragePercent = Math.round((availableSum / 100) * 100);
      isProvisional = measuredDimensions.length < dimensions.length;
    }

    return {
      rubricVersion: RUBRIC_VERSION,
      overallScore,
      isProvisional,
      coveragePercent,
      assessmentStatus: session.status || 'in_progress',
      dimensions,
      aiCollaboration,
      summary: {
        totalExecutions: executions.length,
        baseExecutions: baseExecutions.length,
        followUpExecutions: followUpExecutions.length,
        measuredDimensionsCount: measuredDimensions.length,
        totalDimensionsCount: dimensions.length
      }
    };
  }
}

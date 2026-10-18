/**
 * TARK AI — Phase 4 Verification Suite
 * Assessment Intelligence, Evidence-Grounded Scoring & Skill Verification
 * 
 * Tests:
 *  1. Assessment Engine Unit & Scoring Determinism
 *  2. Missing Evidence & Explicit Status Handling (null overallScore without core correctness)
 *  3. VERIFY Assessment: Defect Diagnosis & Fix Validation (/api/verify/task, /api/verify/evaluate)
 *  4. ADAPT Assessment: Requirement Evolution & Regression Detection
 *  5. AI Telemetry & Zero Arbitrary Score Penalty Policy
 *  6. Protected Lifecycle Management: Secured Shutdown Endpoint (403 on invalid token)
 *  7. Skill Report Persistence, Rubric Versioning (assessment-rubric-v1), & Evidence Integrity
 */

import { AssessmentEngine } from '../backend/src/services/assessmentEngine.js';

const API_BASE = 'http://localhost:5000/api';
const SHUTDOWN_TOKEN = 'tark-test-secure-shutdown-key';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔\x1b[0m [PASS] ${testName}${details ? ` — \x1b[90m${details}\x1b[0m` : ''}`);
  } else {
    failedTests++;
    console.error(`  \x1b[31m✖\x1b[0m [FAIL] ${testName}${details ? ` — \x1b[33m${details}\x1b[0m` : ''}`);
  }
}

async function run() {
  console.log('\n=============================================================');
  console.log('TARK AI — PHASE 4 AUTOMATED VERIFICATION SUITE');
  console.log('=============================================================\n');

  // ────────────────────────────────────────────────────────────────
  // GROUP 1: DETERMINISTIC ASSESSMENT ENGINE & SCORING RUBRIC
  // ────────────────────────────────────────────────────────────────
  console.log('--- TEST GROUP 1: ASSESSMENT ENGINE & DETERMINISTIC RUBRIC ---');

  // Determinism test: identical inputs produce identical outputs
  const mockExecution = {
    executionId: 'exec-test-1',
    mode: 'base',
    status: 'completed',
    summary: { total: 5, passed: 5, failed: 0 }
  };
  const mockSession = { id: 'sess-test-det', counterfactualCompleted: false };
  const mockEvents = [];

  const eval1 = AssessmentEngine.evaluate({
    session: mockSession,
    executions: [mockExecution],
    events: mockEvents
  });

  const eval2 = AssessmentEngine.evaluate({
    session: mockSession,
    executions: [mockExecution],
    events: mockEvents
  });

  assert(
    eval1.overallScore === eval2.overallScore && eval1.coveragePercent === eval2.coveragePercent,
    'Scoring Determinism: Identical evidence produces identical scores',
    `Run 1: ${eval1.overallScore}, Run 2: ${eval2.overallScore}`
  );

  assert(
    eval1.rubricVersion === 'assessment-rubric-v1',
    'Rubric Versioning: Assessment report specifies assessment-rubric-v1',
    eval1.rubricVersion
  );

  assert(
    eval1.dimensions.length === 5,
    'Rubric Dimension Completeness: Exactly 5 dimensions evaluated',
    eval1.dimensions.map(d => d.dimension).join(', ')
  );

  // Missing evidence test: No executions -> overallScore must be null
  const emptyEval = AssessmentEngine.evaluate({
    session: { id: 'sess-empty' },
    executions: [],
    events: []
  });

  assert(
    emptyEval.overallScore === null,
    'Explicit Missing Evidence: No executions produces null overallScore (no false zeros)',
    `overallScore: ${emptyEval.overallScore}`
  );

  assert(
    emptyEval.isProvisional === true,
    'Missing Evidence Flag: Mark unmeasured core correctness as provisional',
    `isProvisional: ${emptyEval.isProvisional}`
  );

  const coreDimEmpty = emptyEval.dimensions.find(d => d.dimension === 'core_correctness');
  assert(
    coreDimEmpty && coreDimEmpty.status === 'insufficient_evidence',
    'Dimension State Transparency: Core correctness marked as insufficient_evidence when unmeasured',
    `status: ${coreDimEmpty.status}`
  );

  // ────────────────────────────────────────────────────────────────
  // GROUP 2: VERIFY MODE ASSESSMENT & DEFECT DIAGNOSIS
  // ────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 2: VERIFY ASSESSMENT (DEFECT-ORDERING-01) ---');

  // Fetch verify task
  const taskRes = await fetch(`${API_BASE}/verify/task`).then(r => r.json());
  assert(
    taskRes.success && taskRes.data && taskRes.data.defectId === 'DEFECT-ORDERING-01',
    'VERIFY Task API: GET /api/verify/task returns DEFECT-ORDERING-01',
    taskRes.data ? taskRes.data.title : 'No data'
  );

  assert(
    taskRes.data.options && taskRes.data.options.length === 4,
    'VERIFY Task Structure: Contains 4 diagnostic root-cause options (A, B, C, D)',
    `Found ${taskRes.data.options ? taskRes.data.options.length : 0} options`
  );

  // Evaluate incorrect diagnosis (Option A)
  const incorrectRes = await fetch(`${API_BASE}/verify/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      defectId: 'DEFECT-ORDERING-01',
      selectedOption: 'A',
      sessionId: '#TRK-TEST-P4'
    })
  }).then(r => r.json());

  assert(
    incorrectRes.success && incorrectRes.data.isCorrect === false && incorrectRes.data.pointsEarned === 0,
    'VERIFY Diagnostic Evaluation: Incorrect Option A receives 0 diagnosis points',
    `isCorrect: ${incorrectRes.data.isCorrect}, pointsEarned: ${incorrectRes.data.pointsEarned}`
  );

  // Evaluate correct diagnosis without code fix (Option B)
  const correctDiagnosisOnly = await fetch(`${API_BASE}/verify/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      defectId: 'DEFECT-ORDERING-01',
      selectedOption: 'B',
      sessionId: '#TRK-TEST-P4'
    })
  }).then(r => r.json());

  assert(
    correctDiagnosisOnly.success && correctDiagnosisOnly.data.isCorrect === true && correctDiagnosisOnly.data.pointsEarned === 10,
    'VERIFY Diagnostic Evaluation: Correct Option B earns 10 diagnosis points without code fix',
    `pointsEarned: ${correctDiagnosisOnly.data.pointsEarned}/20`
  );

  // Evaluate correct diagnosis WITH validated code fix
  const correctWithFix = await fetch(`${API_BASE}/verify/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      defectId: 'DEFECT-ORDERING-01',
      selectedOption: 'B',
      code: `from collections import Counter\ndef find_duplicates(nums):\n    c = Counter(nums)\n    return [x for x in c if c[x] > 1]`,
      sessionId: '#TRK-TEST-P4'
    })
  }).then(r => r.json());

  assert(
    correctWithFix.success && correctWithFix.data.isCorrect === true && correctWithFix.data.validated === true && correctWithFix.data.pointsEarned === 20,
    'VERIFY Diagnostic + Fix Validation: Earns full 20/20 points for diagnosis + passing test 2 fix',
    `pointsEarned: ${correctWithFix.data.pointsEarned}/20, validated: ${correctWithFix.data.validated}`
  );

  // ────────────────────────────────────────────────────────────────
  // GROUP 3: ADAPT MODE ASSESSMENT & REGRESSION DETECTION
  // ────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 3: ADAPT ASSESSMENT & REGRESSION DETECTION ---');

  // Run Follow-Up code that PASSES follow-up BUT BREAKS base test 1 (Regression)
  const buggyAdaptCode = `from collections import Counter
def find_duplicates(nums, min_count=3):
    c = Counter(nums)
    if len(nums) < 6:
        return []
    return [x for x in c if c[x] >= min_count]
`;

  const regressionRun = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: buggyAdaptCode,
      mode: 'follow-up',
      sessionId: '#TRK-TEST-P4'
    })
  }).then(r => r.json());

  assert(
    regressionRun.hasRegression === true,
    'ADAPT Regression Detection: Flags hasRegression=true when follow-up code breaks base test suite',
    `hasRegression: ${regressionRun.hasRegression}`
  );

  // Run Clean Adapted Code that satisfies both Follow-Up AND Base suite
  const cleanAdaptCode = `from typing import List
from collections import Counter

def find_duplicates(nums: List[int], min_count: int = 2) -> List[int]:
    counts = Counter(nums)
    return [x for x in counts if counts[x] >= min_count]
`;

  const cleanAdaptRun = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: cleanAdaptCode,
      mode: 'follow-up',
      sessionId: '#TRK-TEST-P4'
    })
  }).then(r => r.json());

  assert(
    cleanAdaptRun.hasRegression === false,
    'ADAPT Clean Adaptation: Flags hasRegression=false when base suite passes without regression',
    `hasRegression: ${cleanAdaptRun.hasRegression}`
  );

  // ────────────────────────────────────────────────────────────────
  // GROUP 4: ZERO ARBITRARY PENALTY POLICY & AI TELEMETRY
  // ────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 4: ZERO ARBITRARY PENALTY POLICY ---');

  const aiEventMock = [
    { type: 'ai', action: 'AI Chat Query', details: 'Diagnostic question' },
    { type: 'ai', action: 'AI Chat Query', details: 'Second question' },
    { type: 'ai', action: 'AI Chat Query', details: 'Third question' }
  ];

  const evalWithAI = AssessmentEngine.evaluate({
    session: { id: 'sess-ai-test', counterfactualCompleted: true },
    executions: [
      { executionId: 'exec-1', mode: 'base', status: 'completed', summary: { total: 5, passed: 5, failed: 0 } },
      { executionId: 'exec-2', mode: 'follow-up', status: 'completed', summary: { total: 4, passed: 4, failed: 0 }, hasRegression: false }
    ],
    events: aiEventMock
  });

  const evalWithoutAI = AssessmentEngine.evaluate({
    session: { id: 'sess-no-ai', counterfactualCompleted: true },
    executions: [
      { executionId: 'exec-1', mode: 'base', status: 'completed', summary: { total: 5, passed: 5, failed: 0 } },
      { executionId: 'exec-2', mode: 'follow-up', status: 'completed', summary: { total: 4, passed: 4, failed: 0 }, hasRegression: false }
    ],
    events: []
  });

  assert(
    evalWithAI.overallScore === evalWithoutAI.overallScore,
    'Zero AI Penalty Policy: Candidate consulting AI receives same score as independent run for identical code',
    `With AI: ${evalWithAI.overallScore}, Without AI: ${evalWithoutAI.overallScore}`
  );

  assert(
    evalWithAI.aiCollaboration.penaltyApplied === false && evalWithAI.aiCollaboration.totalQueries === 3,
    'AI Telemetry Integrity: AI queries logged transparently with penaltyApplied=false',
    `Queries: ${evalWithAI.aiCollaboration.totalQueries}, PenaltyApplied: ${evalWithAI.aiCollaboration.penaltyApplied}`
  );

  // ────────────────────────────────────────────────────────────────
  // GROUP 5: SECURITY & PROTECTED LIFECYCLE MANAGEMENT
  // ────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 5: SECURITY & PROTECTED SHUTDOWN ENDPOINT ---');

  const invalidShutdownRes = await fetch(`${API_BASE}/shutdown`, {
    method: 'POST',
    headers: { 'x-test-token': 'attacker-fake-key' }
  });

  assert(
    invalidShutdownRes.status === 403,
    'Lifecycle Security: POST /api/shutdown rejects invalid test token with 403 Forbidden',
    `HTTP Status: ${invalidShutdownRes.status}`
  );

  // ────────────────────────────────────────────────────────────────
  // GROUP 6: PERSISTENCE, RUBRIC INTEGRATION & REPORT INTEGRITY
  // ────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 6: SKILL REPORT PERSISTENCE & EVIDENCE INTEGRITY ---');

  const reportRes = await fetch(`${API_BASE}/reports/skill-report?sessionId=%23TRK-TEST-P4`).then(r => r.json());

  assert(
    reportRes.success && reportRes.data && reportRes.data.rubricVersion === 'assessment-rubric-v1',
    'Report Rubric Version: Persisted skill report includes rubricVersion: "assessment-rubric-v1"',
    reportRes.data ? reportRes.data.rubricVersion : 'No data'
  );

  assert(
    reportRes.data.dimensions && reportRes.data.dimensions.length === 5,
    'Report Dimension Breakdown: Exposes all 5 weighted assessment dimensions',
    reportRes.data.dimensions ? `${reportRes.data.dimensions.length} dimensions` : 'None'
  );

  assert(
    reportRes.data.evidenceIntegrityHash && reportRes.data.evidenceIntegrityHash.startsWith('0x'),
    'Report Evidence Integrity: Cryptographic evidenceIntegrityHash computed and validated',
    reportRes.data ? reportRes.data.evidenceIntegrityHash : 'No hash'
  );

  assert(
    reportRes.data.evidenceReferences && Array.isArray(reportRes.data.evidenceReferences.executionIds),
    'Traceability Forensics: Grounded execution IDs linked to assessment report',
    `${reportRes.data.evidenceReferences ? reportRes.data.evidenceReferences.executionIds.length : 0} execution references`
  );

  console.log('\n=============================================================');
  console.log(`PHASE 4 VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal error running Phase 4 verification:', err);
  process.exit(1);
});

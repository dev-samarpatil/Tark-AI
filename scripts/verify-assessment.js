/**
 * End-to-End Verification Test Script for Tark AI Assessment Platform
 * 
 * Tests the complete candidate evaluation loop:
 * 1. Health check & session initialization
 * 2. Buggy Python code execution (Ordering Bug -> Test 2 failure)
 * 3. AI Coach failure-grounded diagnostic guidance
 * 4. Corrected Python code execution (Counter key insertion ordering -> 5/5 passed)
 * 5. Counterfactual Challenge execution (Frequency threshold >= 3 -> 4/4 passed)
 * 6. Decision Trail forensic event inspection
 * 7. Evidence-Linked Skill Report dynamic metric derivation
 */

const API_BASE = 'http://localhost:5000/api';

async function runVerification() {
  console.log('====================================================');
  console.log('TARK AI PLATFORM — END-TO-END VERIFICATION SUITE');
  console.log('====================================================\n');

  let passedAll = true;

  // Step 1: Health check
  console.log('1. Testing Health Endpoint (/api/health)...');
  const healthRes = await fetch(`${API_BASE}/health`).then(r => r.json());
  if (healthRes.status === 'ok') {
    console.log('   [PASS] Health check OK:', healthRes.service);
  } else {
    console.error('   [FAIL] Health check failed:', healthRes);
    passedAll = false;
  }

  // Step 2: Run Buggy Python Code
  console.log('\n2. Testing Buggy Python Code Execution (Ordering Bug)...');
  const buggyCode = `
from typing import List

def find_duplicates(nums: List[int]) -> List[int]:
    seen = set()
    duplicates = []
    for val in nums:
        if val in seen:
            if val not in duplicates:
                duplicates.append(val)
        else:
            seen.add(val)
    return duplicates
`;
  const buggyRun = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: buggyCode, isFollowUp: false })
  }).then(r => r.json());

  console.log(`   Execution Summary: ${buggyRun.summary.passed}/${buggyRun.summary.total} passed in ${buggyRun.summary.runtime}`);
  const failedTest = buggyRun.results.find(t => !t.passed);
  if (failedTest && failedTest.id === 2 && failedTest.actual === '[2, 4]') {
    console.log(`   [PASS] Accurately caught Test 2 Ordering Bug: expected ${failedTest.expected}, got ${failedTest.actual}`);
  } else {
    console.error('   [FAIL] Did not catch expected ordering failure:', failedTest);
    passedAll = false;
  }

  // Step 3: AI Diagnostic Guidance
  console.log('\n3. Testing Grounded AI Diagnostic Guidance (/api/ai/chat)...');
  const aiRes = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Why did Test 2 fail with actual [2, 4]?' })
  }).then(r => r.json());

  if (aiRes.data && aiRes.data.text.includes('Ordering Discrepancy') && aiRes.data.text.includes('Counter')) {
    console.log('   [PASS] AI returned deterministic failure-derived guidance:');
    console.log(`   "${aiRes.data.text.split('\n')[0]}"`);
  } else {
    console.error('   [FAIL] AI did not return expected guidance:', aiRes);
    passedAll = false;
  }

  // Step 4: Run Corrected Python Code
  console.log('\n4. Testing Corrected Python Code Execution...');
  const correctedCode = `
from typing import List
from collections import Counter

def find_duplicates(nums: List[int]) -> List[int]:
    counts = Counter(nums)
    return [x for x in counts if counts[x] >= 2]
`;
  const correctedRun = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: correctedCode, isFollowUp: false })
  }).then(r => r.json());

  if (correctedRun.summary.passed === 5 && correctedRun.summary.total === 5) {
    console.log(`   [PASS] All 5 base tests passed in ${correctedRun.summary.runtime}`);
  } else {
    console.error('   [FAIL] Corrected code failed some tests:', correctedRun.summary);
    passedAll = false;
  }

  // Step 5: Counterfactual Challenge Execution
  console.log('\n5. Testing Counterfactual Follow-Up Challenge (Frequency >= 3)...');
  const followUpCode = `
from typing import List
from collections import Counter

def find_duplicates(nums: List[int], min_count: int = 3) -> List[int]:
    counts = Counter(nums)
    return [x for x in counts if counts[x] >= min_count]
`;
  const followUpRun = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: followUpCode, isFollowUp: true })
  }).then(r => r.json());

  if (followUpRun.summary.passed === 4 && followUpRun.summary.total === 4) {
    console.log(`   [PASS] All 4 Counterfactual Adaptation tests passed in ${followUpRun.summary.runtime}`);
  } else {
    console.error('   [FAIL] Follow-up adaptation failed:', followUpRun.summary);
    passedAll = false;
  }

  // Step 6: Verify Decision Trail Events
  console.log('\n6. Testing Decision Trail Event Ledger (/api/reports/decision-trail)...');
  const trailRes = await fetch(`${API_BASE}/reports/decision-trail`).then(r => r.json());
  console.log(`   Total Logged Events: ${trailRes.data.length}`);
  const hasTestEvent = trailRes.data.some(e => e.type === 'test');
  const hasAiEvent = trailRes.data.some(e => e.type === 'ai');
  if (hasTestEvent && hasAiEvent) {
    console.log('   [PASS] Decision Trail contains both live test executions and AI queries.');
  } else {
    console.error('   [FAIL] Decision Trail missing event categories.');
    passedAll = false;
  }

  // Step 7: Verify Dynamic Skill Report
  console.log('\n7. Testing Dynamic Skill Report Metric Derivation (/api/reports/skill-report)...');
  const reportRes = await fetch(`${API_BASE}/reports/skill-report`).then(r => r.json());
  const scores = reportRes.data.scores;
  console.log('   Calculated Scores:', scores);
  console.log('   Evidence Summary:', reportRes.data.evidenceSummary);

  if (scores.overall >= 90 && scores.adaptability === 96 && scores.correctness === 100) {
    console.log('   [PASS] Dynamic Skill Report derived directly from real execution proof.');
  } else {
    console.error('   [FAIL] Unexpected report scoring:', scores);
    passedAll = false;
  }

  console.log('\n====================================================');
  if (passedAll) {
    console.log('VERIFICATION SUMMARY: ALL 7 END-TO-END SUITES PASSED! ✓');
  } else {
    console.log('VERIFICATION SUMMARY: FAILED CHECKS ENCOUNTERED ✗');
  }
  console.log('====================================================');
}

runVerification().catch(console.error);

/**
 * Comprehensive Verification Suite for Tark AI Phase 1
 * Validates AC-01 through AC-15 across all execution paths.
 */

const API_BASE = 'http://localhost:5000/api';

async function runPhase1Verification() {
  console.log('====================================================');
  console.log('TARK AI PHASE 1 — AUTOMATED VERIFICATION SUITE');
  console.log('====================================================\n');

  let passedAll = true;

  // TEST A: Health Check
  console.log('TEST A — HEALTH CHECK (GET /api/health)...');
  try {
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    if (health.status === 'ok') {
      console.log('   [PASS] Health endpoint responsive:', health.service);
    } else {
      console.error('   [FAIL] Health check unexpected response:', health);
      passedAll = false;
    }
  } catch (e) {
    console.error('   [FAIL] Health check failed to connect:', e.message);
    passedAll = false;
  }

  // TEST B: Correct Base Implementation
  console.log('\nTEST B — CORRECT BASE IMPLEMENTATION (collections.Counter)...');
  const correctCode = `
from typing import List
from collections import Counter

def find_duplicates(nums: List[int]) -> List[int]:
    counts = Counter(nums)
    return [x for x in counts if counts[x] >= 2]
`;
  const runB = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: correctCode, mode: 'base', isFollowUp: false })
  }).then(r => r.json());

  if (runB.status === 'completed' && runB.summary.passed === 5 && runB.summary.total === 5) {
    console.log(`   [PASS] All 5 base tests passed (${runB.summary.runtime})`);
  } else {
    console.error('   [FAIL] Expected 5/5 passed:', runB.summary);
    passedAll = false;
  }

  // TEST C: Incorrect Ordering Implementation
  console.log('\nTEST C — INCORRECT ORDERING IMPLEMENTATION (Appends on 2nd seen)...');
  const orderBugCode = `
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
  const runC = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: orderBugCode, mode: 'base', isFollowUp: false })
  }).then(r => r.json());

  const test2 = (runC.results || []).find(t => t.id === 2);
  if (runC.status === 'completed' && test2 && test2.passed === false && test2.actual === '[2, 4]') {
    console.log(`   [PASS] Test 2 correctly failed: expected ${test2.expected}, got ${test2.actual}`);
  } else {
    console.error('   [FAIL] Ordering failure not caught properly:', test2);
    passedAll = false;
  }

  // TEST D: Undefined Variable (Runtime Error inside function)
  console.log('\nTEST D — UNDEFINED VARIABLE (duplicate typo inside branch)...');
  const undefinedVarCode = `
def find_duplicates(nums):
    seen = set()
    duplicates = []
    for val in nums:
        if val in seen:
            if val not in duplicates:
                duplicate.append(val)
        else:
            seen.add(val)
    return duplicates
`;
  const runD = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: undefinedVarCode, mode: 'base', isFollowUp: false })
  }).then(r => r.json());

  const errTests = (runD.results || []).filter(t => t.status === 'error');
  const passTests = (runD.results || []).filter(t => t.status === 'passed');
  if (errTests.length > 0 && passTests.length > 0) {
    console.log(`   [PASS] Runner accurately isolated error: ${errTests.length} tests threw NameError, ${passTests.length} tests passed (empty array & no-duplicate cases)`);
  } else {
    console.error('   [FAIL] Undefined variable error not properly isolated:', runD);
    passedAll = false;
  }

  // TEST E: Syntax Error
  console.log('\nTEST E — SYNTAX ERROR (Unclosed parenthesis)...');
  const syntaxErrorCode = `
def find_duplicates(nums
    return []
`;
  const runE = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: syntaxErrorCode, mode: 'base' })
  }).then(r => r.json());

  if (runE.status === 'syntax_error' && runE.error && runE.error.includes('SyntaxError')) {
    console.log('   [PASS] Syntax error accurately captured without fabricating test assertions:');
    console.log(`          ${runE.error.split('\n')[0]}`);
  } else {
    console.error('   [FAIL] Syntax error misclassified:', runE);
    passedAll = false;
  }

  // TEST F: Timeout Handling (Infinite loop)
  console.log('\nTEST F — TIMEOUT HANDLING (while True: pass with 3000ms limit)...');
  const timeoutCode = `
def find_duplicates(nums):
    while True:
        pass
    return []
`;
  const runF = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: timeoutCode, mode: 'base' })
  }).then(r => r.json());

  if (runF.status === 'timeout' && runF.summary.runtime && parseInt(runF.summary.runtime) >= 2800) {
    console.log(`   [PASS] Timeout handled cleanly: status=${runF.status}, runtime=${runF.summary.runtime}`);
  } else {
    console.error('   [FAIL] Timeout not handled properly:', runF);
    passedAll = false;
  }

  // TEST G: Follow-Up Counterfactual Challenge (Frequency >= 3)
  console.log('\nTEST G — FOLLOW-UP CHALLENGE (Frequency threshold >= 3)...');
  const followUpCode = `
from typing import List
from collections import Counter

def find_duplicates(nums: List[int], min_count: int = 3) -> List[int]:
    counts = Counter(nums)
    return [x for x in counts if counts[x] >= min_count]
`;
  const runG = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: followUpCode, mode: 'follow-up', isFollowUp: true })
  }).then(r => r.json());

  if (runG.status === 'completed' && runG.summary.passed === 4 && runG.summary.total === 4) {
    console.log(`   [PASS] All 4 adaptation tests passed in ${runG.summary.runtime}`);
  } else {
    console.error('   [FAIL] Follow-up suite failed:', runG.summary);
    passedAll = false;
  }

  // TEST H: Live Code Synchronization
  console.log('\nTEST H — LIVE CODE SYNCHRONIZATION...');
  const buggyRun = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: orderBugCode, mode: 'base' })
  }).then(r => r.json());
  const fixedRun = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: correctCode, mode: 'base' })
  }).then(r => r.json());

  if (buggyRun.summary.passed === 4 && fixedRun.summary.passed === 5) {
    console.log('   [PASS] Modifying code dynamically changed execution outcome (4/5 -> 5/5)');
  } else {
    console.error('   [FAIL] Code synchronization did not alter results:', buggyRun.summary, fixedRun.summary);
    passedAll = false;
  }

  // TEST I: Mode Synchronization
  console.log('\nTEST I — MODE SYNCHRONIZATION...');
  const baseModeRun = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: correctCode, mode: 'base' })
  }).then(r => r.json());
  const followUpModeRun = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: followUpCode, mode: 'follow-up' })
  }).then(r => r.json());

  if (baseModeRun.summary.total === 5 && followUpModeRun.summary.total === 4) {
    console.log('   [PASS] Mode correctly determined test suites (Base: 5 tests, Follow-up: 4 tests)');
  } else {
    console.error('   [FAIL] Mode mismatch:', baseModeRun.summary, followUpModeRun.summary);
    passedAll = false;
  }

  // TEST J: Error Recovery
  console.log('\nTEST J — ERROR RECOVERY...');
  const failFirst = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: syntaxErrorCode, mode: 'base' })
  }).then(r => r.json());
  const recoverSecond = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: correctCode, mode: 'base' })
  }).then(r => r.json());

  if (failFirst.status === 'syntax_error' && recoverSecond.status === 'completed' && recoverSecond.summary.passed === 5) {
    console.log('   [PASS] System exited error state cleanly and returned 5/5 passed results');
  } else {
    console.error('   [FAIL] Error recovery check failed:', failFirst.status, recoverSecond.status);
    passedAll = false;
  }

  // TEST L: Decision Trail Session Event
  console.log('\nTEST L — DECISION TRAIL SESSION EVENT LOGGING...');
  const trail = await fetch(`${API_BASE}/reports/decision-trail`).then(r => r.json());
  const lastEvent = trail.data[trail.data.length - 1];
  if (lastEvent && lastEvent.type === 'test') {
    console.log(`   [PASS] Decision Trail recorded event: "${lastEvent.action}" (${lastEvent.tag})`);
  } else {
    console.error('   [FAIL] Decision trail missing last execution event:', lastEvent);
    passedAll = false;
  }

  console.log('\n====================================================');
  if (passedAll) {
    console.log('VERIFICATION SUMMARY: ALL TEST SCENARIOS PASSED! ✓');
  } else {
    console.log('VERIFICATION SUMMARY: TEST FAILURES DETECTED ✗');
  }
  console.log('====================================================');
}

runPhase1Verification().catch(console.error);

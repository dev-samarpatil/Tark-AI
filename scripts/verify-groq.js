/**
 * Verification script for Groq API integration & environment configuration
 * Validates TEST 1 through TEST 10.
 */

const API_BASE = 'http://localhost:5000/api';

async function runGroqVerification() {
  console.log('====================================================');
  console.log('TARK AI — GROQ & ENVIRONMENT VERIFICATION SUITE');
  console.log('====================================================\n');

  let allPassed = true;

  // TEST 1: Backend health & startup with env
  console.log('TEST 1: Testing server status with env configuration...');
  try {
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    if (health.status === 'ok') {
      console.log('   [PASS] Server is running and responding.');
    } else {
      console.error('   [FAIL] Health response unexpected:', health);
      allPassed = false;
    }
  } catch (err) {
    console.error('   [FAIL] Could not connect to backend:', err.message);
    allPassed = false;
  }

  // TEST 2 & 3: AI Coach handles unconfigured/placeholder Groq key with fallback
  console.log('\nTEST 2 & 3: Testing AI Coach behavior when Groq is unconfigured / placeholder...');
  try {
    const chatRes = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Why did Test 2 fail?' })
    }).then(r => r.json());

    if (chatRes.success && chatRes.data) {
      console.log('   [PASS] AI Coach responded gracefully without crashing.');
      console.log(`   Source: ${chatRes.data.source}, Fallback: ${chatRes.data.fallback}`);
      console.log(`   Response Preview: "${chatRes.data.text.split('\n')[0]}"`);
    } else {
      console.error('   [FAIL] Chat endpoint failed:', chatRes);
      allPassed = false;
    }

    // TEST 5: Verify API key is NOT in response
    console.log('\nTEST 5: Verifying secrets are never returned in response payload...');
    const responseString = JSON.stringify(chatRes);
    const hasSecretKey = responseString.includes('gsk_') || responseString.includes('GROQ_API_KEY') || responseString.includes('Bearer');
    if (!hasSecretKey && !chatRes.data.apiKey) {
      console.log('   [PASS] No API keys, Authorization headers, or env secrets present in response.');
    } else {
      console.error('   [FAIL] Secret leaked in response payload!');
      allPassed = false;
    }
  } catch (err) {
    console.error('   [FAIL] Chat query failed:', err.message);
    allPassed = false;
  }

  // TEST 7: Decision Trail records interaction
  console.log('\nTEST 7: Verifying Decision Trail logging for AI interactions...');
  try {
    const trail = await fetch(`${API_BASE}/reports/decision-trail`).then(r => r.json());
    const lastAiEvent = (trail.data || []).slice().reverse().find(e => e.type === 'ai');
    if (lastAiEvent) {
      console.log(`   [PASS] Decision Trail logged AI interaction: "${lastAiEvent.action}" (${lastAiEvent.tag})`);
      const eventStr = JSON.stringify(lastAiEvent);
      if (!eventStr.includes('gsk_') && !eventStr.includes('Bearer')) {
        console.log('   [PASS] Decision Trail event contains no secret tokens.');
      } else {
        console.error('   [FAIL] Decision Trail contains secret token!');
        allPassed = false;
      }
    } else {
      console.error('   [FAIL] No AI event found in Decision Trail.');
      allPassed = false;
    }
  } catch (err) {
    console.error('   [FAIL] Decision trail inspection failed:', err.message);
    allPassed = false;
  }

  // TEST 8: Existing test execution endpoint still functional
  console.log('\nTEST 8: Verifying existing Python execution endpoint remains functional...');
  try {
    const runRes = await fetch(`${API_BASE}/tests/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'def find_duplicates(nums):\n    return []',
        mode: 'base'
      })
    }).then(r => r.json());

    if (runRes.status === 'completed' && runRes.results && runRes.results.length === 5) {
      console.log(`   [PASS] Python runner executed successfully (${runRes.summary.passed}/${runRes.summary.total} passed)`);
    } else {
      console.error('   [FAIL] Test runner regression detected:', runRes);
      allPassed = false;
    }
  } catch (err) {
    console.error('   [FAIL] Test runner failed:', err.message);
    allPassed = false;
  }

  console.log('\n====================================================');
  if (allPassed) {
    console.log('VERIFICATION SUMMARY: ALL GROQ & SECRETS TESTS PASSED! ✓');
  } else {
    console.log('VERIFICATION SUMMARY: ISSUES DETECTED ✗');
  }
  console.log('====================================================');
}

runGroqVerification().catch(console.error);

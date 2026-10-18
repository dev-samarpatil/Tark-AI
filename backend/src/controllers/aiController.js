import { mockDatabase } from '../data/mockDatabase.js';
import { GroqService } from '../services/groqService.js';

/**
 * Deterministic diagnostic engine providing failure-grounded guidance
 * when live LLM is unconfigured or encounters provider errors.
 */
function generateDeterministicGuidance(latestExec, userQuestion = '', isFollowUp = false, hintLevel = 1) {
  if (!latestExec) {
    if (isFollowUp) {
      return `[Deterministic Local Analysis]\nNo tests have been executed for the Counterfactual Challenge yet.\nGoal: Return elements appearing at least 3 times (min_count >= 3) preserving original first-appearance order.\nRun your code with "Run Tests" to evaluate your implementation against the adaptation suite.`;
    }
    return `[Deterministic Local Analysis]\nNo tests have been executed for this code yet.\nGoal: Return elements that appear more than once, preserving the order of their FIRST appearance in the input array.\nClick "Run Tests" to run your code against the evaluation suite and generate actual execution assertions.`;
  }

  if (latestExec.status === 'syntax_error') {
    return `[Deterministic Local Analysis - Syntax Error]\nYour code encountered a Python Syntax Error:\n» ${latestExec.error || 'SyntaxError during parsing'}\nPlease check Python indentation, unclosed parentheses or quotes, missing colons, and valid syntax before re-running.`;
  }

  if (latestExec.status === 'runtime_error') {
    return `[Deterministic Local Analysis - Runtime Exception]\nYour code encountered a Runtime Exception during execution:\n» ${latestExec.error || 'Exception occurred'}\nVerify that all variables and functions are defined, imported modules exist, and operations are type-safe.`;
  }

  if (latestExec.status === 'timeout') {
    return `[Deterministic Local Analysis - Timeout]\nYour code exceeded the 3000ms execution limit.\nCheck for infinite while/for loops, missing loop increment steps, or unbounded recursions.`;
  }

  const failedTests = (latestExec.results || []).filter(t => !t.passed);
  if (failedTests.length === 0) {
    if (latestExec.isFollowUp || isFollowUp) {
      return `[Deterministic Local Analysis - All Passing]\nOutstanding: All 4 adaptation tests for the Counterfactual Challenge (frequency >= 3) are passing!\nYour implementation successfully adapts to the updated frequency requirement while preserving first-seen insertion order.`;
    }
    return `[Deterministic Local Analysis - All Passing]\nAll ${latestExec.summary ? latestExec.summary.total : 5} base test cases are passing! Your solution satisfies O(N) time and space constraints.\nNext Step: Switch to the Counterfactual Follow-up challenge to test your code's adaptability to changing requirements.`;
  }

  const orderTest = failedTests.find(t => t.id === 2 || (t.name && t.name.toLowerCase().includes('order')));
  const emptyTest = failedTests.find(t => t.id === 4 || (t.name && t.name.toLowerCase().includes('empty')));

  if (orderTest) {
    return `[Deterministic Local Analysis - Ordering Discrepancy]\nActual Test Failure: "${orderTest.name}" failed.\nInput: ${orderTest.input} → Expected: ${orderTest.expected}, but got: ${orderTest.actual}.\n\nDiagnostic Reason: Appending duplicates immediately upon encountering their second instance disrupts the original order of first appearance. For example, in [4, 2, 2, 4], the number 2 hits its second occurrence before 4 does, even though 4 first appeared at index 0.\n\nHint: Consider counting frequencies across the array first (e.g., using collections.Counter or an auxiliary dict), then extracting keys where frequency >= 2 to guarantee original appearance order.`;
  }

  if (emptyTest) {
    return `[Deterministic Local Analysis - Boundary Failure]\nActual Test Failure: "${emptyTest.name}" failed with: ${emptyTest.assertion || emptyTest.actual}.\nEnsure your function handles empty list inputs nums = [] and single-element inputs without triggering IndexError or unbounded operations.`;
  }

  const firstFail = failedTests[0];
  return `[Deterministic Local Analysis - Test Assertion Failure]\nTest "${firstFail.name}" failed:\nExpected ${firstFail.expected}, but received ${firstFail.actual}.\nAssertion detail: ${firstFail.assertion || 'Output mismatch'}.\nReview your accumulation or filtering condition against the expected test output.`;
}

export const getChatHistory = (req, res) => {
  res.json({
    success: true,
    data: mockDatabase.chatMessages,
    groqConfigured: GroqService.isConfigured(),
    model: GroqService.getModel()
  });
};

export const sendChatMessage = async (req, res) => {
  // 1. Input validation
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ success: false, error: 'Request body must be a JSON object.' });
  }

  const rawMsg = req.body.message !== undefined ? req.body.message : req.body.question;
  if (rawMsg === undefined || rawMsg === null || typeof rawMsg !== 'string') {
    return res.status(400).json({ success: false, error: 'Question or message must be a string.' });
  }

  const trimmedMsg = rawMsg.trim();
  if (!trimmedMsg) {
    return res.status(400).json({ success: false, error: 'Question or message cannot be empty.' });
  }

  if (trimmedMsg.length > 2000) {
    return res.status(400).json({ success: false, error: 'Question exceeds maximum length of 2000 characters.' });
  }

  if (req.body.mode && !['base', 'follow-up'].includes(req.body.mode)) {
    return res.status(400).json({ success: false, error: 'Invalid mode specified. Allowed: base, follow-up.' });
  }

  const hintLevel = req.body.hintLevel !== undefined ? Number(req.body.hintLevel) : 1;
  if (![1, 2, 3, 4].includes(hintLevel)) {
    return res.status(400).json({ success: false, error: 'Invalid hint level. Allowed: 1, 2, 3, 4.' });
  }

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Record candidate prompt
  mockDatabase.chatMessages.push({
    sender: 'candidate',
    text: trimmedMsg,
    timestamp
  });

  // 2. Resolve Assessment Context
  const mode = req.body.mode || (req.body.isFollowUp ? 'follow-up' : (mockDatabase.latestExecution?.isFollowUp ? 'follow-up' : 'base'));
  const isFollowUp = mode === 'follow-up' || Boolean(req.body.isFollowUp);
  const currentCode = req.body.code !== undefined ? String(req.body.code).slice(0, 15000) : mockDatabase.currentCode;
  const executionId = req.body.executionId || req.body.testResults?.executionId || mockDatabase.latestExecution?.executionId || null;

  let latestExec = null;
  if (req.body.testResults && typeof req.body.testResults === 'object') {
    latestExec = {
      status: req.body.testResults.status || 'completed',
      summary: req.body.testResults.summary,
      results: Array.isArray(req.body.testResults.results) ? req.body.testResults.results : [],
      error: req.body.testResults.error || null,
      isFollowUp,
      executionId
    };
  } else {
    latestExec = mockDatabase.latestExecution;
  }

  const problem = req.body.problemStatement
    ? { description: String(req.body.problemStatement).slice(0, 5000), followUpDescription: String(req.body.problemStatement).slice(0, 5000) }
    : mockDatabase.candidate.problem;

  let guidanceText = '';
  let source = 'local';
  let fallbackUsed = false;

  // 3. Query Groq or use Deterministic Fallback
  if (GroqService.isConfigured()) {
    try {
      const groqRes = await GroqService.queryAI({
        userMessage: trimmedMsg,
        currentCode,
        problem,
        latestExecution: latestExec,
        history: mockDatabase.chatMessages,
        isFollowUp,
        hintLevel
      });

      if (groqRes.success && groqRes.text) {
        guidanceText = groqRes.text;
        source = 'groq';
        fallbackUsed = false;
      } else {
        console.warn(`[Tark AI] Groq query unfulfilled (${groqRes.error}). Engaging deterministic fallback.`);
        guidanceText = generateDeterministicGuidance(latestExec, trimmedMsg, isFollowUp, hintLevel);
        source = 'local';
        fallbackUsed = true;
      }
    } catch (err) {
      console.warn(`[Tark AI] Unexpected error during Groq query: ${err.message}. Engaging fallback.`);
      guidanceText = generateDeterministicGuidance(latestExec, trimmedMsg, isFollowUp, hintLevel);
      source = 'local';
      fallbackUsed = true;
    }
  } else {
    // Deterministic local analysis when Groq is unconfigured
    guidanceText = generateDeterministicGuidance(latestExec, trimmedMsg, isFollowUp, hintLevel);
    source = 'local';
    fallbackUsed = false;
  }

  // 4. Construct Normalized Response
  const aiResponse = {
    sender: 'ai',
    text: guidanceText,
    message: guidanceText,
    reply: guidanceText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    source,
    mode,
    executionId,
    fallback: fallbackUsed,
    fallbackUsed,
    error: null
  };

  mockDatabase.chatMessages.push(aiResponse);

  // 5. Record event in Decision Trail
  mockDatabase.addEvent({
    action: source === 'groq' ? 'AI Guidance: Groq Live' : (fallbackUsed ? 'AI Guidance: Local Fallback' : 'AI Guidance: Local Diagnostic'),
    details: `Candidate asked: "${trimmedMsg.slice(0, 60)}${trimmedMsg.length > 60 ? '...' : ''}". Engine: ${source === 'groq' ? 'Groq Live' : 'Deterministic Local'}`,
    type: 'ai',
    tag: source === 'groq' ? 'Groq Live' : 'Local AI',
    metadata: {
      query: trimmedMsg,
      source,
      fallbackUsed,
      mode,
      executionId,
      model: source === 'groq' ? GroqService.getModel() : 'deterministic-v1'
    }
  });

  // Return backward-compatible response
  res.json({
    success: true,
    message: guidanceText,
    reply: guidanceText,
    data: aiResponse,
    history: mockDatabase.chatMessages,
    source,
    mode,
    executionId,
    fallbackUsed,
    error: null
  });
};

import { mockDatabase } from '../data/mockDatabase.js';
import { GroqService } from '../services/groqService.js';

/**
 * Deterministic diagnostic engine providing failure-grounded guidance
 * when live LLM is unconfigured or encounters provider errors.
 */
function generateDeterministicGuidance(latestExec) {
  if (!latestExec) {
    return `No tests have been executed for this code yet. Run your code using the "Run Tests" button to generate actual test assertions, runtime metrics, and diff analysis.`;
  }

  if (latestExec.status === 'syntax_error') {
    return `Your code encountered a Python Syntax Error:\n» ${latestExec.error}\nPlease check Python indentation, parentheses, colons, and valid syntax before re-running.`;
  }

  if (latestExec.status === 'runtime_error') {
    return `Your code encountered a Runtime Exception:\n» ${latestExec.error}\nVerify variable names, imported modules, and valid operations.`;
  }

  if (latestExec.status === 'timeout') {
    return `Your code exceeded the 3000ms execution limit. Check for infinite while/for loops or unbounded recursions.`;
  }

  const failedTests = (latestExec.results || []).filter(t => !t.passed);
  if (failedTests.length === 0) {
    if (latestExec.isFollowUp) {
      return `Outstanding: All adaptation tests for the Counterfactual Challenge (frequency >= 3) are passing! Your implementation demonstrates strong requirement adaptability and preserved ordering.`;
    }
    return `All ${latestExec.summary ? latestExec.summary.total : 5} base test cases are passing! Your solution satisfies O(N) time and space requirements.\nNext Step: Proceed to the Counterfactual Follow-up challenge to test your code's adaptability to changing requirements.`;
  }

  const orderTest = failedTests.find(t => t.id === 2 || (t.name && t.name.toLowerCase().includes('order')));
  const emptyTest = failedTests.find(t => t.id === 4 || (t.name && t.name.toLowerCase().includes('empty')));

  if (orderTest) {
    return `Actual Test Failure: "${orderTest.name}" failed.\nInput: ${orderTest.input} → Expected: ${orderTest.expected}, but got: ${orderTest.actual}.\n\nDiagnostic Reason: Appending duplicates immediately upon encountering their second instance disrupts the original order of first appearance. For example, in [4, 2, 2, 4], the number 2 hits its second occurrence before 4 does, even though 4 first appeared at index 0.\n\nHint: Consider counting frequencies across the array first (e.g., using collections.Counter or an auxiliary dict), then extracting keys where frequency >= 2 to guarantee original appearance order.`;
  }

  if (emptyTest) {
    return `Actual Test Failure: "${emptyTest.name}" failed with: ${emptyTest.assertion || emptyTest.actual}.\nEnsure your function handles empty list inputs nums = [] without triggering IndexError.`;
  }

  const firstFail = failedTests[0];
  return `Test "${firstFail.name}" failed:\nExpected ${firstFail.expected}, but received ${firstFail.actual}.\nAssertion detail: ${firstFail.assertion || 'Output mismatch'}.\nVerify your element aggregation logic against the input array constraints.`;
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
  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
  }

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const trimmedMsg = message.trim();

  // Record candidate prompt
  mockDatabase.chatMessages.push({
    sender: 'candidate',
    text: trimmedMsg,
    timestamp
  });

  const latestExec = mockDatabase.latestExecution;
  const isFollowUp = latestExec ? Boolean(latestExec.isFollowUp) : false;

  let guidanceText = '';
  let source = 'local';
  let fallback = true;

  // Attempt live Groq LLM query if configured
  if (GroqService.isConfigured()) {
    try {
      const groqRes = await GroqService.queryAI({
        userMessage: trimmedMsg,
        currentCode: mockDatabase.currentCode,
        problem: mockDatabase.candidate.problem,
        latestExecution: latestExec,
        history: mockDatabase.chatMessages,
        isFollowUp
      });

      if (groqRes.success && groqRes.text) {
        guidanceText = `[AI Coach - Groq Live Guidance]\n${groqRes.text}`;
        source = 'groq';
        fallback = false;
      } else {
        console.warn(`[Tark AI] Groq query unfulfilled (${groqRes.error}). Engaging deterministic fallback.`);
        guidanceText = `[Deterministic Diagnostic Engine - Local Fallback]\n${generateDeterministicGuidance(latestExec)}`;
        source = 'local';
        fallback = true;
      }
    } catch (err) {
      console.warn(`[Tark AI] Unexpected error during Groq query: ${err.message}. Engaging fallback.`);
      guidanceText = `[Deterministic Diagnostic Engine - Local Fallback]\n${generateDeterministicGuidance(latestExec)}`;
      source = 'local';
      fallback = true;
    }
  } else {
    // Deterministic diagnostic fallback
    guidanceText = `[Deterministic Diagnostic Engine - Local Test Analysis]\n${generateDeterministicGuidance(latestExec)}`;
    source = 'local';
    fallback = false;
  }

  const aiResponse = {
    sender: 'ai',
    text: guidanceText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    source,
    fallback
  };

  mockDatabase.chatMessages.push(aiResponse);

  // Record event in Decision Trail
  mockDatabase.addEvent({
    action: source === 'groq' ? 'AI Guidance: Groq Live' : 'AI Guidance: Local Fallback',
    details: `Candidate asked: "${trimmedMsg.slice(0, 60)}${trimmedMsg.length > 60 ? '...' : ''}". Engine: ${source === 'groq' ? 'Groq Live' : 'Deterministic Fallback'}`,
    type: 'ai',
    tag: source === 'groq' ? 'Groq Live' : 'Local AI',
    metadata: {
      query: trimmedMsg,
      source,
      fallback,
      model: source === 'groq' ? GroqService.getModel() : 'deterministic-v1'
    }
  });

  res.json({
    success: true,
    data: aiResponse,
    history: mockDatabase.chatMessages
  });
};

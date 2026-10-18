import { mockDatabase } from '../data/mockDatabase.js';

export const getChatHistory = (req, res) => {
  res.json({
    success: true,
    data: mockDatabase.chatMessages
  });
};

export const sendChatMessage = (req, res) => {
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

  // Generate deterministic guidance derived from actual test execution data
  const latestExec = mockDatabase.latestExecution;
  let guidanceText = '';

  if (!latestExec) {
    guidanceText = `[Deterministic Diagnostic Engine - Local Test Analysis]\n` +
      `No tests have been executed for this session yet. Run your code using the "Run Tests" button to generate actual test assertions, runtime metrics, and diff analysis.`;
  } else if (!latestExec.success && latestExec.error) {
    guidanceText = `[Deterministic Diagnostic Engine - Syntax & Runtime Analyzer]\n` +
      `Your code encountered an execution error:\n` +
      `» ${latestExec.error}\n` +
      `Please check Python indentation, imported modules, and valid syntax before re-running.`;
  } else {
    const failedTests = (latestExec.results || []).filter(t => !t.passed);

    if (failedTests.length === 0) {
      if (latestExec.isFollowUp) {
        guidanceText = `[Deterministic Diagnostic Engine - Verification Success]\n` +
          `Outstanding: All adaptation tests for the Counterfactual Challenge (frequency >= 3) are passing! Your implementation demonstrates strong requirement adaptability and preserved ordering.`;
      } else {
        guidanceText = `[Deterministic Diagnostic Engine - Verification Success]\n` +
          `All ${latestExec.summary.total} base test cases are passing! Your solution satisfies $O(N)$ time and space requirements.\n` +
          `Next Step: Proceed to the Counterfactual Follow-up challenge to test your code's adaptability to changing requirements.`;
      }
    } else {
      const orderTest = failedTests.find(t => t.id === 2 || t.name.toLowerCase().includes('order'));
      const emptyTest = failedTests.find(t => t.id === 4 || t.name.toLowerCase().includes('empty'));

      if (orderTest) {
        guidanceText = `[Deterministic Diagnostic Engine - Ordering Discrepancy]\n` +
          `Actual Test Failure: "${orderTest.name}" failed.\n` +
          `Input: ${orderTest.input} → Expected: ${orderTest.expected}, but got: ${orderTest.actual}.\n\n` +
          `Diagnostic Reason: Appending duplicates immediately upon encountering their second instance disrupts the original order of first appearance. For example, in [4, 2, 2, 4], the number 2 hits its second occurrence before 4 does, even though 4 first appeared at index 0.\n\n` +
          `Hint: Consider counting frequencies across the array first (e.g., using collections.Counter or an auxiliary dict), then extracting keys where frequency >= 2 to guarantee original appearance order.`;
      } else if (emptyTest) {
        guidanceText = `[Deterministic Diagnostic Engine - Boundary Analysis]\n` +
          `Actual Test Failure: "${emptyTest.name}" failed with: ${emptyTest.assertion || emptyTest.actual}.\n` +
          `Ensure your function handles empty list inputs nums = [] without triggering IndexError.`;
      } else {
        const firstFail = failedTests[0];
        guidanceText = `[Deterministic Diagnostic Engine - Test Assertion Failure]\n` +
          `Test "${firstFail.name}" failed:\n` +
          `Expected ${firstFail.expected}, but received ${firstFail.actual}.\n` +
          `Assertion detail: ${firstFail.assertion || 'Output mismatch'}.\n` +
          `Verify your element aggregation logic against the input array constraints.`;
      }
    }
  }

  const aiResponse = {
    sender: 'ai',
    text: guidanceText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };

  mockDatabase.chatMessages.push(aiResponse);

  // Record event in Decision Trail
  mockDatabase.addEvent({
    action: 'AI Guidance Requested',
    details: `Candidate asked: "${trimmedMsg.slice(0, 60)}${trimmedMsg.length > 60 ? '...' : ''}". Diagnostic engine provided failure-grounded hints.`,
    type: 'ai',
    tag: 'Prompt',
    metadata: {
      query: trimmedMsg,
      failedTestsCount: latestExec ? (latestExec.results || []).filter(t => !t.passed).length : 0
    }
  });

  res.json({
    success: true,
    data: aiResponse,
    history: mockDatabase.chatMessages
  });
};

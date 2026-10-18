/**
 * Groq AI Provider Service
 * 
 * Secure backend service connecting to Groq's official API endpoint.
 * Handles authentication, context building, model querying, timeouts, and error handling.
 * Never exposes the GROQ_API_KEY to frontend or responses.
 */

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const REQUEST_TIMEOUT_MS = 10000;

export class GroqService {
  /**
   * Check if Groq API credentials are configured.
   */
  static isConfigured() {
    const key = process.env.GROQ_API_KEY;
    return Boolean(key && typeof key === 'string' && key.trim() !== '' && key !== 'YOUR_GROQ_API_KEY_HERE');
  }

  /**
   * Get the configured model identifier.
   */
  static getModel() {
    return process.env.GROQ_MODEL || DEFAULT_MODEL;
  }

  /**
   * Send a contextualized chat query to Groq.
   * 
   * @param {Object} options
   * @param {string} options.userMessage - Candidate's question
   * @param {string} options.currentCode - Candidate's current code
   * @param {Object} options.problem - Problem statement and constraints
   * @param {Object} options.latestExecution - Latest test execution data
   * @param {Array} options.history - Prior chat message history
   * @param {boolean} options.isFollowUp - Whether follow-up challenge is active
   */
  static async queryAI({ userMessage, currentCode, problem, latestExecution, history = [], isFollowUp = false }) {
    if (!this.isConfigured()) {
      return {
        available: false,
        success: false,
        reason: 'GROQ_API_KEY is not configured or contains default placeholder.'
      };
    }

    const apiKey = process.env.GROQ_API_KEY.trim();
    const model = this.getModel();

    // Construct assessment context for the model
    let executionContext = 'No tests executed yet for this code.';
    if (latestExecution) {
      if (latestExecution.status === 'syntax_error') {
        executionContext = `Execution Status: Syntax Error\nDetails: ${latestExecution.error}`;
      } else if (latestExecution.status === 'runtime_error') {
        executionContext = `Execution Status: Runtime Exception\nDetails: ${latestExecution.error}`;
      } else if (latestExecution.status === 'timeout') {
        executionContext = `Execution Status: Timeout (>3000ms limit exceeded)`;
      } else if (latestExecution.status === 'completed' && latestExecution.summary) {
        const { passed, total, runtime } = latestExecution.summary;
        const failedTests = (latestExecution.results || []).filter(t => !t.passed);
        let failureDetails = 'None (All tests passed)';
        if (failedTests.length > 0) {
          failureDetails = failedTests.map(t =>
            `- Test "${t.name}" (input: ${t.input}): expected ${t.expected}, got ${t.actual}${t.assertion ? ` [${t.assertion}]` : ''}`
          ).join('\n');
        }
        executionContext = `Tests: ${passed}/${total} passed (runtime: ${runtime})\nFailed Tests:\n${failureDetails}`;
      }
    }

    const challengeModeTitle = isFollowUp ? 'Counterfactual Follow-Up Challenge (Frequency >= 3)' : 'Base Challenge (Find Duplicates >= 2)';
    const challengeDescription = isFollowUp
      ? (problem ? problem.followUpDescription : 'Return elements appearing at least 3 times preserving first appearance order.')
      : (problem ? problem.description : 'Return elements appearing more than once preserving first appearance order.');

    const systemPrompt = `You are the Tark AI Coach, an expert diagnostic mentor in a technical assessment platform.
Your objective is to help the candidate understand algorithmic design, diagnose test assertion failures, analyze Python concepts, and understand complexity constraints without writing the complete solution for them.

Active Challenge: ${challengeModeTitle}
Requirements: ${challengeDescription}
Constraints: Time O(N), Space O(N)

Candidate's Current Python Code:
\`\`\`python
${currentCode || '# No code submitted'}
\`\`\`

Latest Test Runner Execution Proof:
${executionContext}

Core Rules:
1. Ground your diagnosis in the ACTUAL test execution proof above. Never invent test failures.
2. Be a mentor: explain WHY a test failed (e.g. order preservation, off-by-one, boundary checks) or what concept needs attention.
3. Guide the candidate with architectural questions, structural tips (e.g. key insertion order in collections.Counter or dictionaries), and debugging strategies.
4. DO NOT write or provide the full copy-paste final function solution.
5. Clarify that you provide diagnostic guidance and explanations; the Python runner remains the authoritative evaluator.
6. Keep answers concise, direct, and readable within the cockpit chat interface.`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Append up to 6 recent relevant chat turns for conversation continuity
    const recentHistory = history.slice(-6);
    for (const msg of recentHistory) {
      if (msg.sender === 'candidate') {
        messages.push({ role: 'user', content: msg.text });
      } else if (msg.sender === 'ai' && msg.text) {
        // Strip source prefix for clean model history
        const cleanText = msg.text.replace(/^\[.*?\]\n?/, '');
        messages.push({ role: 'assistant', content: cleanText });
      }
    }

    // Append current candidate question
    messages.push({ role: 'user', content: userMessage });

    try {
      const response = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          max_tokens: 800
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.warn(`[Groq AI] Provider error HTTP ${response.status}: ${errorBody.slice(0, 100)}`);
        return {
          available: true,
          success: false,
          error: `Provider HTTP ${response.status}`
        };
      }

      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const text = data.choices[0].message.content.trim();
        return {
          available: true,
          success: true,
          text,
          model: data.model || model
        };
      } else {
        return {
          available: true,
          success: false,
          error: 'Empty response returned from model.'
        };
      }
    } catch (err) {
      const isTimeout = err.name === 'TimeoutError' || err.message.includes('timeout');
      console.warn(`[Groq AI] Request failed (${isTimeout ? 'Timeout' : 'Network/Fetch'}): ${err.message}`);
      return {
        available: true,
        success: false,
        error: isTimeout ? 'Request timed out' : 'Network communication error'
      };
    }
  }
}

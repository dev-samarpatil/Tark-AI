import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HARNESS_PATH = path.resolve(__dirname, 'testHarness.py');

/**
 * Isolated Python Runner Service
 * 
 * Executes candidate Python code against deterministic test suites in a child process
 * using testHarness.py via stdin JSON streaming.
 * 
 * NOTE ON SECURITY & ISOLATION LIMITATION:
 * This runner executes code in a separate Python child process with a strict 3000ms timeout
 * and stripped environment variables. While child process separation prevents blocking or
 * crashing the Node.js/Express event loop, it does NOT provide production-grade OS virtualization,
 * seccomp, or container sandbox isolation.
 */

export const BASE_TESTS = [
  { id: 1, name: 'Standard Multiset', input: [4, 2, 4, 1, 2], expected: [4, 2] },
  { id: 2, name: 'Ordering Preservation', input: [4, 2, 2, 4], expected: [4, 2] },
  { id: 3, name: 'No Duplicates', input: [1, 2, 3], expected: [] },
  { id: 4, name: 'Empty and Single-Value Arrays', input: [], expected: [] },
  { id: 5, name: 'Negative Values & Duplicates', input: [-1, -2, -1, 0, -2], expected: [-1, -2] }
];

export const FOLLOW_UP_TESTS = [
  { id: 1, name: 'Follow-up: Threshold (Frequency >= 3)', input: [4, 2, 4, 1, 2, 4], expected: [4], minCount: 3 },
  { id: 2, name: 'Follow-up: Multiple High-Frequency Items', input: [3, 1, 3, 2, 1, 3, 1], expected: [3, 1], minCount: 3 },
  { id: 3, name: 'Follow-up: No Element Reaches Threshold', input: [1, 1, 2, 2, 3], expected: [], minCount: 3 },
  { id: 4, name: 'Follow-up: Empty Array', input: [], expected: [], minCount: 3 }
];

export class PythonRunner {
  static execute(code, options = {}) {
    return new Promise((resolve) => {
      // Normalize options for backward compatibility
      let mode = 'base';
      let executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      if (typeof options === 'boolean') {
        mode = options ? 'follow-up' : 'base';
      } else if (typeof options === 'object' && options !== null) {
        if (options.mode) mode = options.mode;
        else if (options.isFollowUp) mode = 'follow-up';
        if (options.executionId) executionId = options.executionId;
      }

      const isFollowUp = (mode === 'follow-up');
      const tests = isFollowUp ? FOLLOW_UP_TESTS : BASE_TESTS;
      const startTime = Date.now();

      // Launch Python child process with isolated environment (no sensitive env vars passed)
      const pyProc = spawn('python', ['-u', HARNESS_PATH], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          PYTHONIOENCODING: 'utf-8',
          PYTHONUNBUFFERED: '1',
          PATH: process.env.PATH,
          SYSTEMROOT: process.env.SYSTEMROOT || ''
        }
      });

      let stdoutData = '';
      let stderrData = '';
      let hasTimedOut = false;

      // Strict 3-second timeout
      const timer = setTimeout(() => {
        hasTimedOut = true;
        pyProc.kill('SIGKILL');
      }, 3000);

      pyProc.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      pyProc.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      pyProc.on('close', (exitCode) => {
        clearTimeout(timer);
        const totalDuration = Date.now() - startTime;

        if (hasTimedOut) {
          return resolve({
            executionId,
            success: false,
            status: 'timeout',
            mode,
            isFollowUp,
            error: 'Execution Timed Out (exceeded 3000ms limit). Possible infinite loop in candidate code.',
            results: [],
            summary: {
              total: tests.length,
              passed: 0,
              failed: tests.length,
              runtime: `${totalDuration}ms`
            }
          });
        }

        if (exitCode !== 0 && !stdoutData.trim()) {
          const cleanError = stderrData.trim() || `Python process exited with code ${exitCode}`;
          return resolve({
            executionId,
            success: false,
            status: 'runner_error',
            mode,
            isFollowUp,
            error: cleanError,
            results: [],
            summary: {
              total: tests.length,
              passed: 0,
              failed: tests.length,
              runtime: `${totalDuration}ms`
            }
          });
        }

        try {
          const parsed = JSON.parse(stdoutData.trim());
          const results = parsed.results || [];
          const passedCount = results.filter(r => r.passed).length;
          const failedCount = tests.length - passedCount;
          const isCompleted = parsed.status === 'completed';

          return resolve({
            executionId,
            success: isCompleted && passedCount === tests.length,
            status: parsed.status, // 'completed' | 'syntax_error' | 'runtime_error' | 'runner_error'
            mode,
            isFollowUp,
            error: parsed.error || null,
            line: parsed.line || null,
            offset: parsed.offset || null,
            results,
            summary: {
              total: tests.length,
              passed: passedCount,
              failed: isCompleted ? failedCount : tests.length,
              runtime: `${totalDuration}ms`
            }
          });
        } catch (err) {
          return resolve({
            executionId,
            success: false,
            status: 'runner_error',
            mode,
            isFollowUp,
            error: `Failed to parse Python test runner output: ${stderrData || stdoutData}`,
            results: [],
            summary: {
              total: tests.length,
              passed: 0,
              failed: tests.length,
              runtime: `${totalDuration}ms`
            }
          });
        }
      });

      // Stream payload to Python testHarness via stdin
      const payload = JSON.stringify({ code, mode, tests });
      pyProc.stdin.write(payload);
      pyProc.stdin.end();
    });
  }
}

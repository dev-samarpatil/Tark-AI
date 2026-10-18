import { spawn } from 'child_process';

/**
 * Isolated Python Runner Service
 * 
 * Executes candidate Python code against deterministic test suites in a child process.
 * 
 * NOTE ON SECURITY & ISOLATION LIMITATION:
 * This runner executes code in a separate Python child process with a strict 3000ms timeout.
 * While child process separation prevents blocking or crashing the Node.js/Express event loop,
 * it does NOT provide production-grade OS virtualization, seccomp, or container isolation.
 */

const BASE_TESTS = [
  { id: 1, name: 'Standard Multiset', input: [4, 2, 4, 1, 2], expected: [4, 2] },
  { id: 2, name: 'Ordering Preservation', input: [4, 2, 2, 4], expected: [4, 2], hint: 'Preserve first appearance index' },
  { id: 3, name: 'No Duplicates', input: [1, 2, 3], expected: [] },
  { id: 4, name: 'Empty and Single-Value Arrays', input: [], expected: [] },
  { id: 5, name: 'Negative Values & Duplicates', input: [-1, -2, -1, 0, -2], expected: [-1, -2] }
];

const FOLLOW_UP_TESTS = [
  { id: 1, name: 'Follow-up: Threshold (Frequency >= 3)', input: [4, 2, 4, 1, 2, 4], expected: [4], minCount: 3 },
  { id: 2, name: 'Follow-up: Multiple High-Frequency Items', input: [3, 1, 3, 2, 1, 3, 1], expected: [3, 1], minCount: 3 },
  { id: 3, name: 'Follow-up: No Element Reaches Threshold', input: [1, 1, 2, 2, 3], expected: [], minCount: 3 },
  { id: 4, name: 'Follow-up: Empty Array', input: [], expected: [], minCount: 3 }
];

export class PythonRunner {
  static execute(code, isFollowUp = false) {
    return new Promise((resolve) => {
      const tests = isFollowUp ? FOLLOW_UP_TESTS : BASE_TESTS;
      const testCasesJson = JSON.stringify(tests);
      const isFollowUpFlag = isFollowUp ? 'True' : 'False';

      // Python harness that imports candidate code and runs each test case with timing
      const pythonHarness = `
import sys
import json
import time
import inspect
from typing import List

# Candidate Code
${code}

def run_suite():
    tests = json.loads('''${testCasesJson}''')
    results = []
    
    if 'find_duplicates' not in globals():
        print(json.dumps({
            "success": False,
            "error": "Function 'find_duplicates' is not defined. Please implement 'def find_duplicates(nums):'."
        }))
        return

    fn = globals()['find_duplicates']
    sig = inspect.signature(fn)
    accepts_min_count = len(sig.parameters) >= 2 or any(p.default != inspect.Parameter.empty for p in list(sig.parameters.values())[1:])

    for t in tests:
        test_id = t["id"]
        test_name = t["name"]
        inp = t["input"]
        expected = t["expected"]
        min_count = t.get("minCount", 2)
        
        start_time = time.perf_counter()
        passed = False
        actual = None
        assertion = None
        
        try:
            # If follow-up test and function accepts 2nd param or defaults
            if ${isFollowUpFlag} and len(sig.parameters) >= 2:
                actual = fn(list(inp), min_count)
            else:
                actual = fn(list(inp))
                
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            
            # Normalize list comparison
            if isinstance(actual, (list, tuple)) and list(actual) == expected:
                passed = True
            else:
                passed = False
                if not isinstance(actual, (list, tuple)):
                    assertion = f"Expected list but got {type(actual).__name__}: {repr(actual)}"
                else:
                    assertion = f"Returned {repr(list(actual))} instead of expected {repr(expected)}."
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            passed = False
            actual = f"Exception: {type(e).__name__}"
            assertion = f"{type(e).__name__}: {str(e)}"
            
        results.append({
            "id": test_id,
            "name": test_name,
            "input": repr(inp),
            "expected": repr(expected),
            "actual": repr(actual) if actual is not None else "None",
            "passed": passed,
            "duration": f"{elapsed_ms}ms",
            "assertion": assertion
        })

    print(json.dumps({
        "success": True,
        "results": results
    }))

if __name__ == "__main__":
    run_suite()
`;

      const startTime = Date.now();
      let stdoutData = '';
      let stderrData = '';
      let hasTimedOut = false;

      // Spawn child process
      const pyProc = spawn('python', ['-u', '-c', pythonHarness], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

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
            success: false,
            error: 'Execution Timed Out (exceeded 3000ms limit). Possible infinite loop in candidate code.',
            results: tests.map(t => ({
              id: t.id,
              name: t.name,
              input: JSON.stringify(t.input),
              expected: JSON.stringify(t.expected),
              actual: 'TIMEOUT',
              passed: false,
              duration: '>3000ms',
              assertion: 'Time Limit Exceeded: Process terminated after 3000ms.'
            })),
            summary: { total: tests.length, passed: 0, failed: tests.length, runtime: `${totalDuration}ms` },
            isFollowUp
          });
        }

        if (exitCode !== 0 && !stdoutData.trim()) {
          // Top-level syntax error, import error, etc.
          const cleanError = stderrData.trim() || `Python process exited with code ${exitCode}`;
          return resolve({
            success: false,
            error: cleanError,
            results: tests.map(t => ({
              id: t.id,
              name: t.name,
              input: JSON.stringify(t.input),
              expected: JSON.stringify(t.expected),
              actual: 'Syntax/Runtime Error',
              passed: false,
              duration: `${totalDuration}ms`,
              assertion: cleanError
            })),
            summary: { total: tests.length, passed: 0, failed: tests.length, runtime: `${totalDuration}ms` },
            isFollowUp
          });
        }

        try {
          const parsed = JSON.parse(stdoutData.trim());
          if (!parsed.success) {
            return resolve({
              success: false,
              error: parsed.error,
              results: tests.map(t => ({
                id: t.id,
                name: t.name,
                input: JSON.stringify(t.input),
                expected: JSON.stringify(t.expected),
                actual: 'Execution Error',
                passed: false,
                duration: `${totalDuration}ms`,
                assertion: parsed.error
              })),
              summary: { total: tests.length, passed: 0, failed: tests.length, runtime: `${totalDuration}ms` },
              isFollowUp
            });
          }

          const results = parsed.results;
          const passedCount = results.filter(r => r.passed).length;
          return resolve({
            success: true,
            results,
            summary: {
              total: results.length,
              passed: passedCount,
              failed: results.length - passedCount,
              runtime: `${totalDuration}ms`
            },
            isFollowUp
          });
        } catch (err) {
          return resolve({
            success: false,
            error: `Failed to parse Python test runner output: ${stderrData || stdoutData}`,
            results: [],
            summary: { total: tests.length, passed: 0, failed: tests.length, runtime: `${totalDuration}ms` },
            isFollowUp
          });
        }
      });
    });
  }
}

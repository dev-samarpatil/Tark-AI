import './style.css';

const API_BASE = 'http://localhost:5000/api';

// ── Application State ──────────────────────────────────────────────
const state = {
  currentView: 'workspace', // 'workspace' | 'decision-trail' | 'skill-report'
  isFollowUp: false,
  isRunningTests: false,
  isSendingChat: false,
  activeExecutionId: null,
  executionError: null, // { status, message, line, offset }
  candidate: {
    name: 'Aarav Sharma',
    sessionId: '#TRK-8821',
    role: 'Senior Python Engineer',
    timeRemaining: '24:18',
    status: 'In Progress'
  },
  code: `# Task: Return duplicates in the order of their FIRST appearance
from typing import List

def find_duplicates(nums: List[int]) -> List[int]:
    seen = set()
    duplicates = []
    
    # Notice: Appending directly upon encountering 2nd instance
    for val in nums:
        if val in seen:
            if val not in duplicates:
                duplicates.append(val)
        else:
            seen.add(val)
            
    return duplicates

if __name__ == "__main__":
    sample = [4, 2, 2, 4]
    print(find_duplicates(sample))
`,
  tests: [
    { id: 1, name: 'Standard Multiset', input: '[4, 2, 4, 1, 2]', expected: '[4, 2]', actual: '[4, 2]', status: 'passed', passed: true, duration: '12ms' },
    { id: 2, name: 'Ordering Preservation', input: '[4, 2, 2, 4]', expected: '[4, 2]', actual: '[2, 4]', status: 'failed', passed: false, duration: '14ms', assertion: 'Returned [2, 4] instead of expected [4, 2].' },
    { id: 3, name: 'No Duplicates', input: '[1, 2, 3]', expected: '[]', actual: '[]', status: 'passed', passed: true, duration: '8ms' },
    { id: 4, name: 'Empty and Single-Value Arrays', input: '[]', expected: '[]', actual: '[]', status: 'passed', passed: true, duration: '5ms' },
    { id: 5, name: 'Negative Values & Duplicates', input: '[-1, -2, -1, 0, -2]', expected: '[-1, -2]', actual: '[-1, -2]', status: 'passed', passed: true, duration: '9ms' }
  ],
  latestSummary: { total: 5, passed: 4, failed: 1, runtime: '48ms' },
  chatMessages: [
    { 
      sender: 'candidate', 
      text: 'Why did Test 2 fail with actual [2, 4] when the input array was [4, 2, 2, 4]?',
      timestamp: '14:02:10'
    },
    { 
      sender: 'ai', 
      text: '[Deterministic Diagnostic Engine - Ordering Discrepancy]\nActual Test Failure: "Ordering Preservation" failed.\nInput: [4, 2, 2, 4] → Expected: [4, 2], but got: [2, 4].\n\nDiagnostic Reason: Appending duplicates immediately upon encountering their second instance disrupts the original order of first appearance. For example, in [4, 2, 2, 4], the number 2 hits its second occurrence before 4 does, even though 4 first appeared at index 0.\n\nHint: Consider counting frequencies across the array first (e.g., using collections.Counter or an auxiliary dict), then extracting keys where frequency >= 2 to guarantee original appearance order.',
      timestamp: '14:02:12'
    }
  ],
  decisionTrail: [],
  skillReport: null
};

// ── API Client Utilities ───────────────────────────────────────────
async function fetchSessionData() {
  try {
    const [sessRes, chatRes, trailRes, reportRes] = await Promise.all([
      fetch(`${API_BASE}/session`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/ai/chat`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/reports/decision-trail`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/reports/skill-report`).then(r => r.json()).catch(() => null)
    ]);

    if (sessRes && sessRes.data) state.candidate = { ...state.candidate, ...sessRes.data };
    if (chatRes && chatRes.data) state.chatMessages = chatRes.data;
    if (trailRes && trailRes.data) state.decisionTrail = trailRes.data;
    if (reportRes && reportRes.data) state.skillReport = reportRes.data;
  } catch (err) {
    console.warn('[Tark API] Error initializing session:', err);
  }
}

async function runTestsAPI() {
  if (state.isRunningTests) return;

  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  state.activeExecutionId = executionId;
  state.isRunningTests = true;
  state.executionError = null;
  renderApp();

  try {
    const res = await fetch(`${API_BASE}/tests/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: state.code,
        mode: state.isFollowUp ? 'follow-up' : 'base',
        isFollowUp: state.isFollowUp,
        executionId
      })
    });
    const data = await res.json();

    // Check if this response matches the most recent execution attempt
    if (state.activeExecutionId !== data.executionId && data.executionId) {
      console.log('[Tark API] Discarding stale execution response:', data.executionId);
      return;
    }

    if (data.status === 'syntax_error' || data.status === 'runtime_error' || data.status === 'timeout' || data.status === 'runner_error') {
      state.executionError = {
        status: data.status,
        message: data.error || 'Execution failed',
        line: data.line,
        offset: data.offset
      };
      state.tests = data.results || [];
      state.latestSummary = data.summary || {
        total: state.isFollowUp ? 4 : 5,
        passed: 0,
        failed: state.isFollowUp ? 4 : 5,
        runtime: data.summary ? data.summary.runtime : '0ms'
      };
    } else {
      state.executionError = null;
      if (data.results && data.results.length > 0) {
        state.tests = data.results;
        state.latestSummary = data.summary || {
          total: data.results.length,
          passed: data.results.filter(r => r.passed).length,
          failed: data.results.filter(r => !r.passed).length,
          runtime: '45ms'
        };
      }
    }

    // Refresh Decision Trail and Skill Report in background
    const [trailRes, reportRes] = await Promise.all([
      fetch(`${API_BASE}/reports/decision-trail`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/reports/skill-report`).then(r => r.json()).catch(() => null)
    ]);
    if (trailRes && trailRes.data) state.decisionTrail = trailRes.data;
    if (reportRes && reportRes.data) state.skillReport = reportRes.data;

  } catch (err) {
    console.error('Failed to run tests:', err);
    state.executionError = {
      status: 'runner_error',
      message: 'Network / server communication error connecting to http://localhost:5000/api/tests/run'
    };
  } finally {
    state.isRunningTests = false;
    renderApp();
  }
}

async function sendChatMessageAPI(text) {
  if (!text || !text.trim() || state.isSendingChat) return;
  state.isSendingChat = true;

  // Optimistic candidate message
  const candidateMsg = {
    sender: 'candidate',
    text: text.trim(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
  state.chatMessages.push(candidateMsg);
  renderApp();

  try {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text.trim() })
    });
    const data = await res.json();
    if (data.success && data.data) {
      state.chatMessages.push(data.data);
    }
    // Refresh trail
    const trailRes = await fetch(`${API_BASE}/reports/decision-trail`).then(r => r.json()).catch(() => null);
    if (trailRes && trailRes.data) state.decisionTrail = trailRes.data;
  } catch (err) {
    console.error('Failed to send AI chat:', err);
  } finally {
    state.isSendingChat = false;
    renderApp();
  }
}

// ── Component: Sidebar ─────────────────────────────────────────────
function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="logo-icon">
            <span class="material-symbols-outlined">terminal</span>
          </div>
          <h1>TARK <span class="accent">AI</span></h1>
        </div>
        <span class="sidebar-badge">COCKPIT</span>
      </div>

      <div class="sidebar-body">
        <div class="session-card">
          <div class="text-label-sm label">Active Evaluation</div>
          <div class="name">${state.candidate.name}</div>
          <div class="session-id">
            <span class="dot"></span>
            <span>Session ${state.candidate.sessionId}</span>
          </div>
        </div>

        <div class="text-label-sm nav-section-label">Navigation</div>
        <div class="nav-items">
          <button class="nav-item ${state.currentView === 'workspace' ? 'active' : ''}" data-view="workspace">
            <span class="material-symbols-outlined">terminal</span>
            <span>Code Workspace</span>
          </button>
          <button class="nav-item ${state.currentView === 'decision-trail' ? 'active' : ''}" data-view="decision-trail">
            <span class="material-symbols-outlined">alt_route</span>
            <span>Decision Trail</span>
          </button>
          <button class="nav-item ${state.currentView === 'skill-report' ? 'active' : ''}" data-view="skill-report">
            <span class="material-symbols-outlined">insights</span>
            <span>Skill Report</span>
          </button>
        </div>

        <div class="text-label-sm nav-section-label mt">Challenge Mode</div>
        <div style="padding: 0 4px;">
          <button id="toggleFollowUpBtn" class="btn ${state.isFollowUp ? 'btn-ai' : 'btn-secondary'}" style="width: 100%; justify-content: flex-start; padding: 8px 10px; font-size: 11px;">
            <span class="material-symbols-outlined icon-sm">${state.isFollowUp ? 'published_with_changes' : 'splitscreen'}</span>
            <span>${state.isFollowUp ? 'Mode: Follow-Up (K>=3)' : 'Mode: Base (K>=2)'}</span>
          </button>
        </div>
      </div>

      <div class="sidebar-footer">
        <div class="telemetry-status">
          <div class="left">
            <span class="dot" style="background: var(--emerald);"></span>
            <span>Python 3.14 Child Process</span>
          </div>
          <span class="latency" style="color: var(--emerald);">Live</span>
        </div>
      </div>
    </aside>
  `;
}

// ── Component: Top Header ──────────────────────────────────────────
function renderHeader() {
  const viewTitles = {
    workspace: 'live-execution',
    'decision-trail': 'decision-trail',
    'skill-report': 'skill-report'
  };

  return `
    <header class="header">
      <div class="header-left">
        <div class="breadcrumb">
          <span class="seg">assessment</span>
          <span class="sep">/</span>
          <span class="active">${viewTitles[state.currentView]}</span>
          <span class="sep">/</span>
          <span class="current">${state.candidate.name}</span>
        </div>
        <div class="demo-badge">
          <span class="ping"></span>
          <span>Live Session Sync</span>
        </div>
      </div>

      <div class="header-right">
        <div class="search-box">
          <span class="material-symbols-outlined">search</span>
          <input type="text" placeholder="Search actions or tests" />
          <span class="shortcut">⌘K</span>
        </div>

        <button class="notification-btn" aria-label="Notifications" title="Active Session Sync">
          <span class="material-symbols-outlined">notifications</span>
          <span class="badge"></span>
        </button>

        <img class="profile-avatar" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" alt="Profile" />
      </div>
    </header>
  `;
}

// ── View: Workspace (Cockpit) ──────────────────────────────────────
function renderWorkspaceView() {
  const totalTests = state.latestSummary ? state.latestSummary.total : (state.isFollowUp ? 4 : 5);
  const passedTests = state.latestSummary ? state.latestSummary.passed : 0;
  const passPercent = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
  const lineCount = (state.code.match(/\n/g) || []).length + 1;
  const gutterLines = Array.from({ length: Math.max(lineCount, 18) }, (_, i) => String(i + 1).padStart(2, '0'));

  return `
    <div class="page-enter">
      <!-- Session Sub-bar -->
      <div style="height: 56px; background: #06100d; border-bottom: 1px solid rgba(59,74,65,0.4); display: flex; align-items: center; justify-content: space-between; padding: 0 24px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: var(--emerald); box-shadow: 0 0 8px var(--emerald-glow);"></span>
            <span class="text-headline-md" style="font-size: 16px;">
              ${state.isFollowUp ? 'Counterfactual Challenge: Deduplication with Frequency >= 3' : 'Find Duplicates in a List'}
            </span>
          </div>
          <span class="badge badge-neutral" style="gap: 6px;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #387eb8;"></span>
            Python 3.14
          </span>
          <span class="badge badge-warn">
            <span class="material-symbols-outlined icon-xs">timer</span>
            ${state.candidate.timeRemaining} remaining
          </span>
          ${state.isFollowUp ? '<span class="badge badge-ai">Adaptation Challenge Active</span>' : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <button id="loadSolutionTemplateBtn" class="btn btn-outline" title="Load sample candidate solution template">
            <span class="material-symbols-outlined icon-xs">auto_fix_high</span>
            <span>Load Template</span>
          </button>
          <button id="runTestsBtn" class="btn btn-secondary" ${state.isRunningTests ? 'disabled' : ''}>
            <span class="material-symbols-outlined" style="color: var(--emerald);">${state.isRunningTests ? 'sync' : 'play_arrow'}</span>
            <span>${state.isRunningTests ? 'Executing Python...' : 'Run Tests'}</span>
          </button>
          <button id="submitAssessmentBtn" class="btn btn-primary">
            <span class="material-symbols-outlined">check_circle</span>
            <span>Submit Assessment</span>
          </button>
        </div>
      </div>

      <!-- Main Workspace 3-Column Layout -->
      <div style="display: grid; grid-template-columns: 290px 1fr 340px; gap: 12px; padding: 12px; min-height: calc(100vh - 120px);">
        <!-- Column 1: Problem & Constraints -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div class="card card-low" style="padding: 12px;">
            <div class="text-label-sm" style="color: var(--text-muted); margin-bottom: 8px;">Evaluation Challenge Mode</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
              <button id="modeBaseBtn" class="btn ${!state.isFollowUp ? 'btn-primary' : 'btn-outline'}" style="font-size: 11px; justify-content: center; padding: 6px 4px;">
                Base (K>=2)
              </button>
              <button id="modeFollowUpBtn" class="btn ${state.isFollowUp ? 'btn-ai' : 'btn-outline'}" style="font-size: 11px; justify-content: center; padding: 6px 4px;">
                Follow-Up (K>=3)
              </button>
            </div>
          </div>

          <div class="card card-low" style="flex: 1; display: flex; flex-direction: column; gap: 14px; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="text-label-md" style="color: var(--emerald);">Problem Prompt</span>
              <span class="badge badge-neutral">#TRK-P42</span>
            </div>

            ${!state.isFollowUp ? `
              <p class="text-body-sm" style="line-height: 1.6;">
                Return each integer that appears <span style="color: var(--emerald); font-weight: 500;">more than once</span>, exactly once, preserving the order of its <span style="color: var(--blue-light); font-weight: 500;">first appearance</span> in the input array.
              </p>
              <div>
                <div class="text-label-sm" style="color: var(--text-muted); margin-bottom: 6px;">Sample In / Out</div>
                <div class="test-diff" style="margin-bottom: 6px;">
                  <div style="color: var(--text-muted);">In:  <span style="color: var(--text-high);">[4, 2, 4, 1, 2]</span></div>
                  <div style="color: var(--emerald);">Out: <span>[4, 2]</span></div>
                </div>
                <div class="test-diff">
                  <div style="color: var(--text-muted);">In:  <span style="color: var(--text-high);">[4, 2, 2, 4]</span></div>
                  <div style="color: var(--emerald);">Out: <span>[4, 2]</span> <em style="font-size: 10px; color: var(--blue-light);">(first seen: 4 at idx 0)</em></div>
                </div>
              </div>
            ` : `
              <div style="background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); border-radius: 6px; padding: 8px;">
                <span class="badge badge-ai" style="margin-bottom: 4px;">Counterfactual Follow-up</span>
                <p class="text-body-sm" style="line-height: 1.6; color: var(--text-high);">
                  Requirement Evolution: Return only elements that appear <span style="color: var(--blue-light); font-weight: 600;">at least 3 times</span> (frequency >= 3), preserving the order of their first appearance.
                </p>
              </div>
              <div>
                <div class="text-label-sm" style="color: var(--text-muted); margin-bottom: 6px;">Follow-up Samples</div>
                <div class="test-diff" style="margin-bottom: 6px;">
                  <div style="color: var(--text-muted);">In:  <span style="color: var(--text-high);">[4, 2, 4, 1, 2, 4]</span></div>
                  <div style="color: var(--emerald);">Out: <span>[4]</span> <em style="font-size: 10px; color: var(--text-mid);">(4 appears 3x, 2 appears 2x)</em></div>
                </div>
                <div class="test-diff">
                  <div style="color: var(--text-muted);">In:  <span style="color: var(--text-high);">[1, 1, 2, 2, 3]</span></div>
                  <div style="color: var(--emerald);">Out: <span>[]</span></div>
                </div>
              </div>
            `}

            <div>
              <div class="text-label-sm" style="color: var(--text-muted); margin-bottom: 6px;">Constraints</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <div style="background: var(--surface-2); padding: 6px 8px; border-radius: 6px;">
                  <div class="text-label-sm" style="color: var(--text-muted);">Time Spec</div>
                  <div class="text-code-md" style="color: var(--text-high); font-weight: 600;">O(N)</div>
                </div>
                <div style="background: var(--surface-2); padding: 6px 8px; border-radius: 6px;">
                  <div class="text-label-sm" style="color: var(--text-muted);">Memory Spec</div>
                  <div class="text-code-md" style="color: var(--text-high); font-weight: 600;">O(N)</div>
                </div>
              </div>
              <p class="text-code-sm" style="color: var(--text-muted); margin-top: 6px; font-size: 11px;">
                1 ≤ nums.length ≤ 10⁵<br/>
                Execution timeout: 3000ms max
              </p>
            </div>

            <div style="margin-top: auto; padding: 10px; background: var(--surface-2); border-radius: 8px; border-left: 3px solid var(--emerald);">
              <div class="text-label-sm" style="color: var(--emerald); font-weight: 600;">Child Process Runner Active</div>
              <div class="text-body-sm" style="font-size: 11px; color: var(--text-mid); margin-top: 2px;">
                Isolated Python 3 child process via testHarness with stdin streaming.
              </div>
            </div>
          </div>
        </div>

        <!-- Column 2: Code Editor & Test Results -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <!-- Editor -->
          <div class="code-editor" style="flex: 1; min-height: 400px;">
            <div class="code-tab-bar">
              <div class="code-tab">
                <span class="material-symbols-outlined icon-xs">code</span>
                <span>solution.py</span>
                <span class="dot"></span>
              </div>
              <div style="display: flex; gap: 12px; color: var(--text-muted);" class="text-code-sm">
                <span>Lines: ${lineCount}</span>
                <span>Python 3.14</span>
                <span>UTF-8</span>
              </div>
            </div>

            <div class="code-body">
              <div class="code-gutter">
                ${gutterLines.map(ln => `<span>${ln}</span>`).join('')}
              </div>
              <textarea id="codeEditor" class="code-textarea" spellcheck="false" autocomplete="off" autocapitalize="off">${state.code}</textarea>
            </div>
          </div>

          <!-- Test Results / Execution Status -->
          <div class="card card-low" style="padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="text-headline-md" style="font-size: 15px;">Live Execution &amp; Test Results</span>
                ${state.executionError ? `
                  <span class="badge badge-fail" style="text-transform: uppercase;">
                    ${state.executionError.status.replace('_', ' ')}
                  </span>
                ` : `
                  <span class="badge ${passedTests === totalTests ? 'badge-pass' : 'badge-fail'}">
                    ${passedTests}/${totalTests} passed (${passPercent}%)
                  </span>
                `}
                ${state.isFollowUp ? '<span class="badge badge-ai">Adaptation Tests</span>' : ''}
              </div>
              <span class="text-code-sm" style="color: var(--text-muted);">
                Runtime: ${state.latestSummary ? state.latestSummary.runtime : '0ms'}
              </span>
            </div>

            ${state.executionError ? `
              <!-- Global Execution Error Banner (Syntax Error / Runtime Exception / Timeout) -->
              <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px; padding: 14px; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; color: var(--red-light); font-weight: 600; margin-bottom: 6px;">
                  <span class="material-symbols-outlined icon-sm">error</span>
                  <span>${state.executionError.status === 'syntax_error' ? 'Python Syntax Error' : (state.executionError.status === 'timeout' ? 'Execution Timeout Exceeded' : 'Top-Level Execution Error')}</span>
                </div>
                <div style="background: #06100d; border-radius: 6px; padding: 10px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #fca5a5; white-space: pre-wrap; line-height: 1.5; overflow-x: auto;">
${state.executionError.message}
                </div>
                <div class="text-body-sm" style="color: var(--text-mid); font-size: 11px; margin-top: 8px;">
                  Notice: Code failed before test suite execution. Fix the error above and click <strong>Run Tests</strong>.
                </div>
              </div>
            ` : `
              <div class="segmented-progress" style="margin-bottom: 12px; display: grid; grid-template-columns: repeat(${totalTests}, 1fr); gap: 4px;">
                ${state.tests.map(t => `<div class="seg ${t.passed ? 'pass' : 'fail'}" style="height: 4px; border-radius: 2px;"></div>`).join('')}
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto;">
                ${state.tests.map(t => t.passed ? `
                  <div class="test-item pass">
                    <div class="test-item-left">
                      <span class="material-symbols-outlined icon-sm" style="color: var(--emerald);">check_circle</span>
                      <span class="name">Test ${t.id}: ${t.name}</span>
                      <span class="detail">${t.input} → ${t.expected}</span>
                    </div>
                    <span class="status">Passed (${t.duration || '0ms'})</span>
                  </div>
                ` : `
                  <div class="test-item-expanded" style="background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                      <div class="test-item-left">
                        <span class="material-symbols-outlined icon-sm" style="color: var(--red-light);">${t.status === 'error' ? 'warning' : 'cancel'}</span>
                        <span class="name" style="color: var(--red-light); font-weight: 600;">Test ${t.id}: ${t.name}</span>
                        ${t.status === 'error' ? '<span class="badge badge-warn" style="font-size: 9px;">Runtime Error</span>' : ''}
                      </div>
                      <span class="badge badge-fail">Failed (${t.duration || '0ms'})</span>
                    </div>
                    <div class="test-diff" style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">
                      <div style="color: var(--text-muted);">Input:    <span style="color: var(--text-high);">${t.input}</span></div>
                      <div style="color: var(--emerald);">Expected: <span style="background: rgba(0,217,145,0.1); padding: 0 4px; border-radius: 3px;">${t.expected}</span></div>
                      <div style="color: var(--red-light);">Actual:   <span style="background: rgba(239,68,68,0.15); padding: 0 4px; border-radius: 3px;">${t.actual}</span></div>
                      ${t.assertion ? `<div style="color: var(--red-light); font-size: 11px; margin-top: 4px;">Detail: ${t.assertion}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Column 3: AI Coach & Interactive Ledger -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div class="card card-low" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="width: 28px; height: 28px; border-radius: 6px; background: var(--blue-bg); display: flex; align-items: center; justify-content: center; color: var(--blue-light);">
                    <span class="material-symbols-outlined icon-sm">smart_toy</span>
                  </div>
                  <div>
                    <div class="text-headline-md" style="font-size: 14px;">AI Coach</div>
                    <div class="text-label-sm" style="color: var(--blue-light); text-transform: none;">Deterministic Diagnostic Engine</div>
                  </div>
                </div>
                <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--blue-light); animation: ping 1.5s infinite;"></span>
              </div>

              <p class="text-body-sm" style="color: var(--text-muted); margin-bottom: 10px; font-size: 11px;">
                Guidance derived from actual Python test failure assertions. All interactions are logged in your Decision Trail.
              </p>

              <!-- Quick query chips -->
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
                <button class="chip" onclick="window.sendChatPrompt('Why did Test 2 fail?')">Why did Test 2 fail?</button>
                <button class="chip" onclick="window.sendChatPrompt('Edge-case checklist')">Edge-case checklist</button>
                <button class="chip" onclick="window.sendChatPrompt('Preserving O(N) space')">Preserving O(N) space</button>
                <button class="chip" onclick="window.sendChatPrompt('How to solve the Follow-up challenge?')">Explain Follow-up</button>
              </div>

              <!-- Message thread -->
              <div id="chatThread" style="display: flex; flex-direction: column; gap: 10px; max-height: 380px; overflow-y: auto;">
                ${state.chatMessages.map(msg => msg.sender === 'candidate' ? `
                  <div style="background: var(--surface-2); padding: 10px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                      <span class="text-label-sm" style="color: var(--text-muted);">Candidate</span>
                      <span class="text-code-sm" style="font-size: 10px; color: var(--text-muted);">${msg.timestamp || ''}</span>
                    </div>
                    <div class="text-body-sm" style="color: var(--text-high);">${msg.text}</div>
                  </div>
                ` : `
                  <div style="background: var(--surface-1); border: 1px solid rgba(59,130,246,0.3); padding: 10px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <div style="display: flex; align-items: center; gap: 4px; color: var(--blue-light);" class="text-code-sm">
                        <span class="material-symbols-outlined icon-xs">auto_awesome</span>
                        <span style="font-weight: 600;">AI Diagnostic Engine</span>
                      </div>
                      <span class="text-code-sm" style="font-size: 10px; color: var(--text-muted);">${msg.timestamp || ''}</span>
                    </div>
                    <div class="text-body-sm" style="color: var(--text-mid); line-height: 1.5; white-space: pre-wrap;">${msg.text}</div>
                  </div>
                `).join('')}
                ${state.isSendingChat ? `
                  <div style="background: var(--surface-1); padding: 8px; border-radius: 6px; color: var(--blue-light); font-size: 11px; display: flex; align-items: center; gap: 6px;">
                    <span class="material-symbols-outlined icon-xs animate-spin">sync</span>
                    <span>Analyzing code assertions...</span>
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Chat input -->
            <div style="margin-top: 12px;">
              <form id="chatForm" style="position: relative;">
                <input id="chatInput" class="input-field" type="text" placeholder="Ask AI Coach for architectural hint..." style="padding-right: 36px; width: 100%;" />
                <button type="submit" aria-label="Send" style="position: absolute; right: 8px; top: 8px; color: var(--emerald);">
                  <span class="material-symbols-outlined icon-sm">send</span>
                </button>
              </form>
              <div class="text-code-sm" style="color: var(--text-muted); text-align: center; margin-top: 6px; font-size: 10px;">
                Diagnostic queries stream directly into your evaluation Decision Trail.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── View: AI Decision Trail ────────────────────────────────────────
function renderDecisionTrailView() {
  const events = state.decisionTrail && state.decisionTrail.length > 0 ? state.decisionTrail : [
    { timestamp: '14:00', action: 'Session Initialized', details: 'Candidate started coding session.', type: 'system', tag: 'Scaffold' }
  ];
  const aiPrompts = events.filter(e => e.type === 'ai').length;
  const testRuns = events.filter(e => e.type === 'test').length;
  const autonomy = Math.max(55, 100 - (aiPrompts * 12));

  return `
    <div class="page-enter" style="padding: 24px;">
      <!-- Title & Actions -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span class="badge badge-ai" style="padding: 2px 8px;">Forensic Evaluation Cockpit</span>
            <span style="color: var(--border-structural);">•</span>
            <span class="text-code-sm" style="color: var(--text-muted);">Session ${state.candidate.sessionId}</span>
          </div>
          <h1 class="text-headline-xl" style="font-size: 26px;">Live AI Decision Trail</h1>
          <p class="text-body-sm" style="color: var(--text-mid); margin-top: 4px;">
            Follow candidate's cognitive decisions, test executions, prompt interactions, and code iterations recorded live from backend telemetry.
          </p>
        </div>

        <div style="display: gap: 10px; display: flex;">
          <button class="btn btn-outline" onclick="window.refreshData()">
            <span class="material-symbols-outlined">sync</span>
            <span>Refresh Events</span>
          </button>
          <button class="btn btn-primary" data-view="skill-report">
            <span class="material-symbols-outlined">insights</span>
            <span>View Skill Report</span>
          </button>
        </div>
      </div>

      <!-- Candidate Dossier Card -->
      <div class="card card-accent" style="margin-bottom: 24px; padding: 20px;">
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 16px; align-items: center;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <img class="profile-avatar" style="width: 52px; height: 52px; border-radius: 12px;" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" alt="Avatar" />
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="text-headline-md" style="font-size: 18px;">${state.candidate.name}</span>
                <span class="badge badge-pass">Live Session</span>
              </div>
              <div class="text-body-sm" style="color: var(--text-mid);">${state.candidate.role}</div>
            </div>
          </div>

          <div>
            <div class="text-label-sm" style="color: var(--text-muted);">Autonomy Index</div>
            <div class="text-headline-md" style="color: var(--emerald);">${autonomy}%</div>
            <div class="text-code-sm" style="color: var(--text-mid);">${aiPrompts === 0 ? 'Pure Independent' : `${aiPrompts} Guided Prompts`}</div>
          </div>

          <div>
            <div class="text-label-sm" style="color: var(--text-muted);">Recorded Events</div>
            <div class="text-headline-md" style="color: var(--blue-light);">${events.length} Events</div>
            <div class="text-code-sm" style="color: var(--text-mid);">${testRuns} Test Runs / ${aiPrompts} Queries</div>
          </div>

          <div>
            <div class="text-label-sm" style="color: var(--text-muted);">Tamper-evident Hash</div>
            <div class="text-code-md" style="color: var(--text-high);">${state.skillReport ? state.skillReport.tamperEvidentHash : '0x9f4a2b'}</div>
            <div class="text-code-sm" style="color: var(--emerald);">Grounded Ledger</div>
          </div>
        </div>
      </div>

      <!-- Decision Stream & Code Diff Comparison -->
      <div style="display: grid; grid-template-columns: 1fr 1.1fr; gap: 16px;">
        <!-- Timeline Column -->
        <div class="card card-low" style="padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div class="text-headline-md" style="font-size: 16px;">Chronological Action Ledger</div>
            <span class="badge badge-neutral">${events.length} Events</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; max-height: 520px; overflow-y: auto;">
            ${events.slice().reverse().map((evt, idx) => `
              <div class="timeline-item ${idx === 0 ? 'active' : ''}">
                <span class="timeline-time">${evt.timestamp}</span>
                <div class="timeline-body">
                  <div class="timeline-title">
                    <span class="material-symbols-outlined icon-xs" style="color: ${evt.type === 'ai' ? 'var(--blue-light)' : (evt.tag === 'Passed' ? 'var(--emerald)' : (evt.tag === 'Syntax Error' || evt.tag === 'Failed' ? 'var(--red-light)' : 'var(--text-high)'))};">
                      ${evt.type === 'ai' ? 'smart_toy' : (evt.type === 'test' ? 'bug_report' : 'check_circle')}
                    </span>
                    <span>${evt.action}</span>
                  </div>
                  <div class="timeline-desc" style="font-size: 12px; color: var(--text-mid); margin-top: 2px;">${evt.details}</div>
                </div>
                <span class="timeline-tag ${evt.tag === 'Passed' ? 'badge-pass' : (evt.tag === 'Failed' || evt.tag === 'Syntax Error' ? 'badge-fail' : (evt.type === 'ai' ? 'badge-ai' : 'badge-neutral'))}">
                  ${evt.tag || evt.type}
                </span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Code Inspection Diff -->
        <div class="card card-low" style="padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div class="text-headline-md" style="font-size: 16px;">Synthesis Diff: Baseline Loop → Counter Preservation</div>
            <span class="badge badge-ai">Forensic Code Comparison</span>
          </div>

          <div style="background: #06100d; border-radius: 8px; padding: 12px; font-family: 'JetBrains Mono', monospace; font-size: 12px; overflow-x: auto;">
            <div class="diff-line context"><span class="ln">01</span><span class="sign"> </span><span>def find_duplicates(nums: List[int]) -> List[int]:</span></div>
            <div class="diff-line removed"><span class="ln">02</span><span class="sign">-</span><span>    seen = set()</span></div>
            <div class="diff-line removed"><span class="ln">03</span><span class="sign">-</span><span>    duplicates = []</span></div>
            <div class="diff-line removed"><span class="ln">04</span><span class="sign">-</span><span>    # Appending directly when encountering 2nd instance</span></div>
            <div class="diff-line added"><span class="ln">02</span><span class="sign">+</span><span>    from collections import Counter</span></div>
            <div class="diff-line added"><span class="ln">03</span><span class="sign">+</span><span>    counts = Counter(nums)</span></div>
            <div class="diff-line added"><span class="ln">04</span><span class="sign">+</span><span>    # Preserve first-seen key insertion ordering</span></div>
            <div class="diff-line added"><span class="ln">05</span><span class="sign">+</span><span>    return [x for x in counts if counts[x] >= 2]</span></div>
          </div>

          <div style="margin-top: 14px; padding: 12px; background: var(--surface-2); border-radius: 8px;">
            <div class="text-label-sm" style="color: var(--emerald); margin-bottom: 4px;">Forensic Synthesis Rationale</div>
            <p class="text-body-sm" style="color: var(--text-mid); line-height: 1.5;">
              In the baseline implementation, appending upon hitting the second duplicate instance returned <code>[2, 4]</code> because 2 reached its 2nd occurrence before 4 did. Modern Python 3.7+ dictionaries maintain key insertion order; using <code>Counter</code> preserves the first appearance position while achieving $O(N)$ linear time and space.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── View: Skill Report ─────────────────────────────────────────────
function renderSkillReportView() {
  const report = state.skillReport || {};
  const scores = report.scores || {};
  const evidence = report.evidence || {};
  const evidenceSummary = report.evidenceSummary || [];

  const overall = scores.overall !== null ? scores.overall : '--';
  const correctness = scores.correctness !== null ? `${scores.correctness}%` : 'Pending Tests';
  const autonomy = scores.autonomy !== null ? `${scores.autonomy}%` : '100%';
  const adaptability = scores.adaptability !== null ? `${scores.adaptability}%` : 'Not Attempted';

  return `
    <div class="page-enter" style="padding: 24px;">
      <!-- Title & Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span class="badge badge-pass">Audit Grade</span>
            <span style="color: var(--border-structural);">•</span>
            <span class="text-code-sm" style="color: var(--text-muted);">Session ${state.candidate.sessionId}</span>
          </div>
          <h1 class="text-headline-xl" style="font-size: 26px;">Evidence-Linked Skill Report</h1>
          <p class="text-body-sm" style="color: var(--text-mid); margin-top: 4px;">
            Assessment metrics mathematically derived from verified test outcomes, child process runtimes, and Decision Trail events.
          </p>
        </div>

        <div style="display: flex; gap: 10px;">
          <button class="btn btn-outline" data-view="decision-trail">
            <span class="material-symbols-outlined">alt_route</span>
            <span>View Decision Trail</span>
          </button>
          <button class="btn btn-primary" onclick="window.print()">
            <span class="material-symbols-outlined">download</span>
            <span>Export Report</span>
          </button>
        </div>
      </div>

      <!-- Overview Cards -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
        <div class="card card-low">
          <div class="text-label-sm" style="color: var(--text-muted);">Overall Benchmark</div>
          <div class="text-headline-xl" style="color: var(--emerald); margin-top: 4px;">${overall}<span style="font-size: 16px; color: var(--text-muted);">/100</span></div>
          <div class="text-code-sm" style="color: var(--emerald); margin-top: 2px;">
            ${scores.overall ? 'Verified Competency Score' : 'Run tests to generate'}
          </div>
        </div>

        <div class="card card-low">
          <div class="text-label-sm" style="color: var(--text-muted);">Algorithmic Precision</div>
          <div class="text-headline-xl" style="color: var(--blue-light); margin-top: 4px;">${correctness}</div>
          <div class="text-code-sm" style="color: var(--text-mid); margin-top: 2px;">Deterministic Test Pass Rate</div>
        </div>

        <div class="card card-low">
          <div class="text-label-sm" style="color: var(--text-muted);">AI Collaboration Index</div>
          <div class="text-headline-xl" style="color: var(--amber-light); margin-top: 4px;">${autonomy}</div>
          <div class="text-code-sm" style="color: var(--text-mid); margin-top: 2px;">Autonomy vs Guidance Ratio</div>
        </div>

        <div class="card card-low">
          <div class="text-label-sm" style="color: var(--text-muted);">Adaptability (Follow-up)</div>
          <div class="text-headline-xl" style="color: ${scores.adaptability ? 'var(--emerald)' : 'var(--text-muted)'}; margin-top: 4px;">${adaptability}</div>
          <div class="text-code-sm" style="color: var(--text-mid); margin-top: 2px;">Counterfactual Challenge</div>
        </div>
      </div>

      <!-- Detailed Breakdown Table -->
      <div class="card card-low" style="padding: 0; overflow: hidden; margin-bottom: 24px;">
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-structural); display: flex; justify-content: space-between; align-items: center;">
          <h2 class="text-headline-md" style="font-size: 16px;">Core Competency Telemetry Evidence</h2>
          <span class="badge badge-neutral">Cryptographically Verified: ${report.tamperEvidentHash || '0x9f4a2'}</span>
        </div>

        <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-structural); background: rgba(16,27,23,0.5);">
              <th style="padding: 12px 16px; font-size: 11px; text-transform: uppercase; color: var(--text-muted);">Competency Dimension</th>
              <th style="padding: 12px 16px; font-size: 11px; text-transform: uppercase; color: var(--text-muted);">Grounded Score</th>
              <th style="padding: 12px 16px; font-size: 11px; text-transform: uppercase; color: var(--text-muted);">Telemetry &amp; Execution Proof</th>
              <th style="padding: 12px 16px; font-size: 11px; text-transform: uppercase; color: var(--text-muted);">Forensic Insight</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid rgba(38,60,49,0.3);">
              <td style="padding: 14px 16px;">
                <div style="font-weight: 600; color: var(--text-high);">Algorithmic Optimization</div>
                <div class="text-code-sm" style="color: var(--text-muted);">Data structures &amp; complexity</div>
              </td>
              <td style="padding: 14px 16px;">
                <span class="badge ${scores.correctness >= 80 ? 'badge-pass' : 'badge-fail'}">${scores.correctness !== null ? `${scores.correctness} / 100` : 'No Data'}</span>
              </td>
              <td class="text-code-sm" style="padding: 14px 16px; color: var(--text-mid);">
                ${evidence.correctness || 'Awaiting execution run.'}
              </td>
              <td class="text-body-sm" style="padding: 14px 16px; color: var(--text-mid);">
                ${scores.correctness === 100 ? 'Candidate preserved first-appearance ordering and avoided quadratic loops.' : 'Ordering or boundary test assertion failed.'}
              </td>
            </tr>

            <tr style="border-bottom: 1px solid rgba(38,60,49,0.3);">
              <td style="padding: 14px 16px;">
                <div style="font-weight: 600; color: var(--text-high);">AI Collaborative Autonomy</div>
                <div class="text-code-sm" style="color: var(--text-muted);">Prompting efficacy &amp; critical synthesis</div>
              </td>
              <td style="padding: 14px 16px;">
                <span class="badge badge-ai">${scores.autonomy} / 100</span>
              </td>
              <td class="text-code-sm" style="padding: 14px 16px; color: var(--text-mid);">
                ${evidence.autonomy || 'Independent execution without hallucinations.'}
              </td>
              <td class="text-body-sm" style="padding: 14px 16px; color: var(--text-mid);">
                Utilized AI guidance as a diagnostic sounding board without blind copy-pasting.
              </td>
            </tr>

            <tr style="border-bottom: 1px solid rgba(38,60,49,0.3);">
              <td style="padding: 14px 16px;">
                <div style="font-weight: 600; color: var(--text-high);">Adaptability (Counterfactual)</div>
                <div class="text-code-sm" style="color: var(--text-muted);">Handling requirement evolution</div>
              </td>
              <td style="padding: 14px 16px;">
                <span class="badge ${scores.adaptability ? 'badge-pass' : 'badge-neutral'}">
                  ${scores.adaptability !== null ? `${scores.adaptability} / 100` : 'Pending'}
                </span>
              </td>
              <td class="text-code-sm" style="padding: 14px 16px; color: var(--text-mid);">
                ${evidence.adaptability || 'Counterfactual follow-up challenge not yet attempted.'}
              </td>
              <td class="text-body-sm" style="padding: 14px 16px; color: var(--text-mid);">
                ${scores.adaptability ? 'Demonstrated strong flexibility when requirement shifted to frequency threshold (K>=3).' : 'Toggle to Follow-up mode in Workspace to assess requirement adaptability.'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Grounded Evidence Timeline Log -->
      <div class="card card-low" style="padding: 16px;">
        <div class="text-headline-md" style="font-size: 15px; margin-bottom: 10px;">Session Evidence Audit Trail</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${evidenceSummary.map(item => `
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-high); background: var(--surface-2); padding: 8px 12px; border-radius: 6px;">
              <span class="material-symbols-outlined icon-xs" style="color: var(--emerald);">verified</span>
              <span>${item}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ── Main App Rendering Router ──────────────────────────────────────
function renderApp() {
  const app = document.querySelector('#app');
  if (!app) return;

  // Save cursor & scroll position if editor exists
  const oldEditor = document.querySelector('#codeEditor');
  let cursorPos = null;
  let scrollTop = 0;
  if (oldEditor) {
    cursorPos = oldEditor.selectionStart;
    scrollTop = oldEditor.scrollTop;
  }

  let currentContent = '';
  if (state.currentView === 'workspace') currentContent = renderWorkspaceView();
  else if (state.currentView === 'decision-trail') currentContent = renderDecisionTrailView();
  else if (state.currentView === 'skill-report') currentContent = renderSkillReportView();

  app.innerHTML = `
    ${renderSidebar()}
    <div class="main-wrapper">
      ${renderHeader()}
      <main class="content">
        ${currentContent}
      </main>
    </div>
  `;

  // Restore editor state
  const newEditor = document.querySelector('#codeEditor');
  if (newEditor && cursorPos !== null) {
    newEditor.selectionStart = cursorPos;
    newEditor.selectionEnd = cursorPos;
    newEditor.scrollTop = scrollTop;
  }

  attachEventListeners();
}

// ── Event Handlers & Interactivity ─────────────────────────────────
function attachEventListeners() {
  // Navigation buttons
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view');
      if (targetView && state.currentView !== targetView) {
        state.currentView = targetView;
        renderApp();
      }
    });
  });

  // Code editor textarea sync & tab indentation handling
  const editor = document.querySelector('#codeEditor');
  if (editor) {
    editor.addEventListener('input', (e) => {
      state.code = e.target.value;
    });

    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 4;
        state.code = editor.value;
      }
    });
  }

  // Run Tests button
  const runTestsBtn = document.querySelector('#runTestsBtn');
  if (runTestsBtn) {
    runTestsBtn.addEventListener('click', () => {
      runTestsAPI();
    });
  }

  // Toggle Follow-up button
  const toggleBtn = document.querySelector('#toggleFollowUpBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      state.isFollowUp = !state.isFollowUp;
      renderApp();
    });
  }

  const modeBaseBtn = document.querySelector('#modeBaseBtn');
  if (modeBaseBtn) {
    modeBaseBtn.addEventListener('click', () => {
      if (state.isFollowUp) {
        state.isFollowUp = false;
        renderApp();
      }
    });
  }

  const modeFollowUpBtn = document.querySelector('#modeFollowUpBtn');
  if (modeFollowUpBtn) {
    modeFollowUpBtn.addEventListener('click', () => {
      if (!state.isFollowUp) {
        state.isFollowUp = true;
        renderApp();
      }
    });
  }

  // Load Solution Template button
  const loadSolutionTemplateBtn = document.querySelector('#loadSolutionTemplateBtn');
  if (loadSolutionTemplateBtn) {
    loadSolutionTemplateBtn.addEventListener('click', () => {
      if (state.isFollowUp) {
        state.code = `# Counterfactual Challenge: Elements appearing >= 3 times
from typing import List
from collections import Counter

def find_duplicates(nums: List[int], min_count: int = 3) -> List[int]:
    counts = Counter(nums)
    # Filter items appearing >= min_count while preserving first seen insertion order
    return [x for x in counts if counts[x] >= min_count]
`;
      } else {
        state.code = `# Solved Task: Return duplicates in the order of their FIRST appearance
from typing import List
from collections import Counter

def find_duplicates(nums: List[int]) -> List[int]:
    counts = Counter(nums)
    # Modern Python dicts maintain key insertion order
    return [x for x in counts if counts[x] > 1]
`;
      }
      renderApp();
    });
  }

  // Submit assessment button
  const submitBtn = document.querySelector('#submitAssessmentBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      state.currentView = 'skill-report';
      renderApp();
    });
  }

  // Chat Form
  const chatForm = document.querySelector('#chatForm');
  const chatInput = document.querySelector('#chatInput');
  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = chatInput.value.trim();
      if (!val) return;
      chatInput.value = '';
      sendChatMessageAPI(val);
    });
  }
}

// Global helper for chips and triggers
window.sendChatPrompt = function(text) {
  sendChatMessageAPI(text);
};

window.refreshData = function() {
  fetchSessionData().then(() => renderApp());
};

// Initial Mount & Session Data Fetch
fetchSessionData().then(() => {
  renderApp();
});
renderApp();

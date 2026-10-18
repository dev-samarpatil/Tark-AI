// In-Memory Database for TARK AI Assessment Sessions

export const mockDatabase = {
  candidate: {
    name: 'Aarav Sharma',
    sessionId: '#TRK-8821',
    role: 'Senior Python Engineer',
    timeRemaining: '24:18',
    status: 'In Progress',
    problem: {
      id: 'TRK-P42',
      title: 'Find Duplicates in a List',
      difficulty: 'Medium-Hard',
      description: 'Return each integer that appears more than once, exactly once, preserving the order of its first appearance in the input array.',
      followUpDescription: 'Counterfactual Challenge: Return each integer that appears at least 3 times (min_count >= 3), preserving the order of its first appearance.',
      timeSpec: 'O(N)',
      memorySpec: 'O(N)'
    }
  },
  currentCode: `from typing import List

def find_duplicates(nums: List[int]) -> List[int]:
    seen = set()
    duplicates = []
    
    # Bug Notice: Appending directly upon encountering 2nd instance
    for val in nums:
        if val in seen:
            if val not in duplicates:
                duplicates.append(val)
        else:
            seen.add(val)
            
    return duplicates
`,
  revisions: [
    {
      id: 1,
      timestamp: '14:00:15',
      codeLength: 312,
      note: 'Initial scaffold baseline'
    }
  ],
  tests: [
    { id: 1, name: 'Standard Multiset', input: '[4, 2, 4, 1, 2]', expected: '[4, 2]', passed: true, duration: '12ms' },
    { id: 2, name: 'Ordering Preservation', input: '[4, 2, 2, 4]', expected: '[4, 2]', actual: '[2, 4]', passed: false, duration: '14ms', assertion: 'Returned [2, 4] instead of expected [4, 2].' },
    { id: 3, name: 'No Duplicates', input: '[1, 2, 3]', expected: '[]', passed: true, duration: '8ms' },
    { id: 4, name: 'Empty and Single-Value Arrays', input: '[]', expected: '[]', passed: true, duration: '5ms' },
    { id: 5, name: 'Negative Values & Duplicates', input: '[-1, -2, -1, 0, -2]', expected: '[-1, -2]', passed: true, duration: '9ms' }
  ],
  latestExecution: null,
  counterfactualCompleted: false,
  chatMessages: [
    { 
      sender: 'candidate', 
      text: 'Why did Test 2 fail with actual [2, 4] when the input array was [4, 2, 2, 4]?', 
      timestamp: '14:02:10' 
    },
    { 
      sender: 'ai', 
      text: '[Deterministic Diagnostic Engine - Local Test Analysis]\nIn your loop, an element is added to duplicates the exact moment its count reaches 2. In [4, 2, 2, 4], 2 reaches count 2 before 4 reaches count 2, so 2 is appended first even though 4 appeared first at index 0. Consider using collections.Counter or an auxiliary dictionary to preserve key insertion order.', 
      timestamp: '14:02:12' 
    }
  ],
  decisionTrail: [
    {
      id: 'evt-1',
      timestamp: '13:58:00',
      action: 'Session Initialized',
      details: 'Candidate started coding environment for Session #TRK-8821.',
      type: 'system',
      tag: 'Scaffold'
    },
    {
      id: 'evt-2',
      timestamp: '14:00:15',
      action: 'Initial Scaffold Authored',
      details: 'Baseline solution loop implemented with set() tracker.',
      type: 'revision',
      tag: 'Revision 1'
    },
    {
      id: 'evt-3',
      timestamp: '14:01:45',
      action: 'Test Suite Executed',
      details: 'Candidate ran tests. Result: 4 of 5 passed (Test 2 Ordering Preservation failed).',
      type: 'test',
      tag: 'Failed'
    },
    {
      id: 'evt-4',
      timestamp: '14:02:10',
      action: 'AI Diagnostic Query',
      details: 'Candidate asked why Test 2 failed. Diagnostic explanation returned regarding first appearance preservation.',
      type: 'ai',
      tag: 'Prompt'
    }
  ],

  // Event logging helper with duplicate prevention
  addEvent({ action, details, type, tag, metadata = {} }) {
    const lastEvent = this.decisionTrail[this.decisionTrail.length - 1];
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Prevent immediate identical event spam
    if (lastEvent && lastEvent.action === action && lastEvent.details === details) {
      return lastEvent;
    }

    const newEvent = {
      id: `evt-${this.decisionTrail.length + 1}`,
      timestamp,
      action,
      details,
      type: type || 'system',
      tag: tag || 'Event',
      metadata,
      sessionId: this.candidate.sessionId
    };

    this.decisionTrail.push(newEvent);
    return newEvent;
  }
};

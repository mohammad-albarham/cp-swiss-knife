import * as assert from 'assert';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const proxyquire = require('proxyquire');

const { TestResultsPanel } = proxyquire('../../views/testResultsPanel', {
  '../services/storageService': { getStorageService: () => ({ isSolved: () => false }) },
  '../services/authService': { getAuthService: () => ({ isLoggedIn: () => false, getCurrentUser: () => null }) },
  '../services/testService': { getTestService: () => ({ showOutput: () => {} }) },
  './problemsExplorer': { getProblemsExplorer: () => ({ refreshView: () => {} }) },
});

interface TestResult {
  testNumber: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  error?: string;
  executionTime?: number;
}

interface TestResultsPanelState {
  filePath: string;
  results: TestResult[];
  problem?: { contestId: number; index: string; name?: string; testCases?: number };
  errorMessage?: string;
}

function buildResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    testNumber: 1,
    passed: true,
    input: '3\n1 2 3',
    expectedOutput: '6',
    actualOutput: '6',
    ...overrides,
  };
}

function buildState(overrides: Partial<TestResultsPanelState> = {}): TestResultsPanelState {
  return {
    filePath: '/home/user/cf_1900A.cpp',
    results: [buildResult()],
    problem: { contestId: 1900, index: 'A', name: 'Watermelon', testCases: 2 },
    ...overrides,
  };
}

suite('TestResultsPanel Tests', () => {

  suite('HTML Structure', () => {
    test('getHtml returns valid HTML document', () => {
      const html = TestResultsPanel.getHtml(buildState());
      assert.ok(html.includes('<!DOCTYPE html>'), 'Should start with DOCTYPE');
      assert.ok(html.includes('<html lang="en">'), 'Should have html tag');
      assert.ok(html.includes('</html>'), 'Should close html tag');
    });

    test('getHtml includes CSS styles', () => {
      const html = TestResultsPanel.getHtml(buildState());
      assert.ok(html.includes('<style>'), 'Should have style tag');
      assert.ok(html.includes('--bg:'), 'Should include theme CSS variables');
    });

    test('getHtml includes script section', () => {
      const html = TestResultsPanel.getHtml(buildState());
      assert.ok(html.includes('acquireVsCodeApi()'), 'Should acquire VS Code API');
      assert.ok(html.includes('function post('), 'Should have post helper');
    });
  });

  suite('All Passed', () => {
    test('shows all passed message when all tests pass', () => {
      const state = buildState({
        results: [
          buildResult({ testNumber: 1, passed: true }),
          buildResult({ testNumber: 2, passed: true }),
          buildResult({ testNumber: 3, passed: true }),
        ],
      });
      const html = TestResultsPanel.getHtml(state);
      assert.ok(html.includes('All'), 'Should contain "All"');
      assert.ok(html.includes('passed'), 'Should contain "passed"');
      assert.ok(html.includes('summary success'), 'Should have success tone');
    });

    test('all passed shows pass badges', () => {
      const state = buildState({
        results: [buildResult({ testNumber: 1, passed: true })],
      });
      const html = TestResultsPanel.getHtml(state);
      assert.ok(html.includes('badge pass'), 'Should have pass badge');
      assert.ok(html.includes('PASS'), 'Should show PASS label');
    });
  });

  suite('Mixed Results', () => {
    test('shows fail badges when some tests fail', () => {
      const state = buildState({
        results: [
          buildResult({ testNumber: 1, passed: true }),
          buildResult({ testNumber: 2, passed: false, actualOutput: '5', expectedOutput: '6' }),
        ],
      });
      const html = TestResultsPanel.getHtml(state);
      assert.ok(html.includes('badge fail'), 'Should have fail badge');
      assert.ok(html.includes('FAIL'), 'Should show FAIL label');
      assert.ok(html.includes('summary warning'), 'Should have warning tone');
    });

    test('mixed results show partial pass count', () => {
      const state = buildState({
        results: [
          buildResult({ testNumber: 1, passed: true }),
          buildResult({ testNumber: 2, passed: false }),
          buildResult({ testNumber: 3, passed: false }),
        ],
      });
      const html = TestResultsPanel.getHtml(state);
      assert.ok(html.includes('1/3'), 'Should show 1 out of 3 passed');
    });
  });

  suite('Compilation Error', () => {
    test('shows error message when errorMessage is set', () => {
      const state = buildState({
        results: [],
        errorMessage: 'error: expected semicolon before }',
      });
      const html = TestResultsPanel.getHtml(state);
      assert.ok(html.includes('expected semicolon'), 'Should contain the error message');
      assert.ok(html.includes('summary error'), 'Should have error tone');
    });

    test('error state shows run failed title', () => {
      const state = buildState({
        results: [],
        errorMessage: 'Compilation failed',
      });
      const html = TestResultsPanel.getHtml(state);
      assert.ok(html.includes('Run failed'), 'Should show run failed message');
    });
  });

  suite('Zero Tests', () => {
    test('shows empty state with no results', () => {
      const state = buildState({ results: [] });
      const html = TestResultsPanel.getHtml(state);
      assert.ok(html.includes('empty-state'), 'Should show empty state section');
      assert.ok(html.includes('No sample run was produced'), 'Should show empty state message');
    });

    test('zero tests shows no test results message', () => {
      const state = buildState({ results: [] });
      const html = TestResultsPanel.getHtml(state);
      assert.ok(html.includes('No test results yet'), 'Should show no test results message');
    });
  });

  suite('Problem Metadata', () => {
    test('problem metadata rendered when present', () => {
      const state = buildState({
        problem: { contestId: 1900, index: 'A', name: 'Watermelon', testCases: 2 },
      });
      const html = TestResultsPanel.getHtml(state);
      assert.ok(html.includes('1900A'), 'Should show problem ID');
      assert.ok(html.includes('Watermelon'), 'Should show problem name');
    });

    test('no problem metadata uses file path', () => {
      const state = buildState({ problem: undefined });
      const html = TestResultsPanel.getHtml(state);
      assert.ok(html.includes('cf_1900A.cpp'), 'Should show file name from path');
    });

    test('test case count info when problem has testCases', () => {
      const state = buildState({
        results: [buildResult()],
        problem: { contestId: 100, index: 'B', testCases: 3 },
      });
      const html = TestResultsPanel.getHtml(state);
      assert.ok(html.includes('3 sample test'), 'Should mention test case count');
    });
  });

  suite('Result Card Details', () => {
    test('result card shows input, expected, and actual panes', () => {
      const state = buildState({
        results: [buildResult({ input: '42', expectedOutput: '7', actualOutput: '7' })],
      });
      const html = TestResultsPanel.getHtml(state);
      assert.ok(html.includes('Input'), 'Should have Input pane');
      assert.ok(html.includes('Expected'), 'Should have Expected pane');
      assert.ok(html.includes('Actual'), 'Should have Actual pane');
      assert.ok(html.includes('42'), 'Should show input text');
    });

    test('result card shows execution time', () => {
      const state = buildState({
        results: [buildResult({ executionTime: 150 })],
      });
      const html = TestResultsPanel.getHtml(state);
      assert.ok(html.includes('150 ms'), 'Should show execution time');
    });

    test('result card shows runtime error note', () => {
      const state = buildState({
        results: [buildResult({ passed: false, error: 'segmentation fault' })],
      });
      const html = TestResultsPanel.getHtml(state);
      assert.ok(html.includes('segmentation fault'), 'Should show error note');
      assert.ok(html.includes('error-note'), 'Should have error-note class');
    });
  });

  suite('Action Buttons', () => {
    test('rerun button is always present', () => {
      const html = TestResultsPanel.getHtml(buildState());
      assert.ok(html.includes("post('rerunTests')"), 'Should have rerun button');
    });

    test('open raw log button is present', () => {
      const html = TestResultsPanel.getHtml(buildState());
      assert.ok(html.includes("post('openOutput')"), 'Should have open output button');
    });
  });
});

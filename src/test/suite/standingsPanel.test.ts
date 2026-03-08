import * as assert from 'assert';
import * as vscode from 'vscode';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const proxyquire = require('proxyquire');

const { StandingsPanel } = proxyquire('../../views/standingsPanel', {
  '../services/authService': {
    getAuthService: () => ({
      getCurrentUser: () => ({ handle: 'testuser' }),
      isLoggedIn: () => true,
    }),
  },
});

function mockWebview(): vscode.Webview {
  return {
    cspSource: 'https://mock.csp.source',
    html: '',
    options: {},
    onDidReceiveMessage: () => ({ dispose: () => { } }),
    postMessage: async () => true,
    asWebviewUri: (uri: vscode.Uri) => uri,
  } as unknown as vscode.Webview;
}

function buildContest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 100,
    name: 'Codeforces Round #100',
    type: 'CF',
    phase: 'FINISHED',
    frozen: false,
    durationSeconds: 7200,
    startTimeSeconds: 1700000000,
    ...overrides,
  };
}

function buildRow(
  handle: string,
  rank: number,
  points: number,
  penalty: number,
  problemResults: Record<string, unknown>[],
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    party: {
      members: [{ handle }],
      participantType: 'CONTESTANT',
      ghost: false,
    },
    rank,
    points,
    penalty,
    successfulHackCount: 0,
    unsuccessfulHackCount: 0,
    problemResults,
    ...overrides,
  };
}

function buildProblemResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    points: 0,
    rejectedAttemptCount: 0,
    type: 'FINAL',
    ...overrides,
  };
}

function setState(overrides: Record<string, unknown> = {}): void {
  StandingsPanel.state = {
    contestId: 100,
    contest: buildContest(),
    problems: [
      { contestId: 100, index: 'A', name: 'Easy', type: 'PROGRAMMING', tags: [] },
      { contestId: 100, index: 'B', name: 'Medium', type: 'PROGRAMMING', tags: [] },
      { contestId: 100, index: 'C', name: 'Hard', type: 'PROGRAMMING', tags: [] },
    ],
    rows: [],
    ratingMap: new Map(),
    page: 1,
    friendsOnly: false,
    loading: false,
    ...overrides,
  };
}

suite('StandingsPanel Tests', () => {

  suite('HTML Structure', () => {
    test('getHtml returns valid HTML document', () => {
      setState({
        rows: [
          buildRow('user1', 1, 3000, 50, [
            buildProblemResult({ points: 500, bestSubmissionTimeSeconds: 300 }),
            buildProblemResult({ points: 1000, bestSubmissionTimeSeconds: 900 }),
            buildProblemResult(),
          ]),
        ],
      });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('<!DOCTYPE html>'), 'Should start with DOCTYPE');
      assert.ok(html.includes('<html lang="en">'), 'Should have html tag');
      assert.ok(html.includes('</html>'), 'Should close html tag');
    });

    test('getHtml includes CSP', () => {
      setState();
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('Content-Security-Policy'), 'Should include CSP');
    });

    test('getHtml includes theme styles', () => {
      setState();
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('--bg:'), 'Should include theme CSS variables');
    });

    test('getHtml returns empty string when state is undefined', () => {
      StandingsPanel.state = undefined;
      const html = StandingsPanel.getHtml(mockWebview());
      assert.strictEqual(html, '', 'Should return empty string');
    });
  });

  suite('Standings Table with Rows', () => {
    test('contains handle names in table', () => {
      setState({
        rows: [
          buildRow('alice', 1, 3000, 50, [
            buildProblemResult({ points: 500, bestSubmissionTimeSeconds: 300 }),
            buildProblemResult({ points: 1000, bestSubmissionTimeSeconds: 600 }),
            buildProblemResult(),
          ]),
          buildRow('bob', 2, 2000, 80, [
            buildProblemResult({ points: 500, bestSubmissionTimeSeconds: 400 }),
            buildProblemResult(),
            buildProblemResult(),
          ]),
        ],
      });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('alice'), 'Should contain handle alice');
      assert.ok(html.includes('bob'), 'Should contain handle bob');
    });

    test('shows contest name in hero', () => {
      setState();
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('Codeforces Round #100'), 'Should contain contest name');
    });

    test('table has standings-table class', () => {
      setState({
        rows: [
          buildRow('user1', 1, 1000, 10, [buildProblemResult(), buildProblemResult(), buildProblemResult()]),
        ],
      });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('class="standings-table"'), 'Should have standings-table class');
    });

    test('problem headers show indices', () => {
      setState({
        rows: [
          buildRow('user1', 1, 1000, 10, [buildProblemResult(), buildProblemResult(), buildProblemResult()]),
        ],
      });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('problem-header-index">A<'), 'Should have problem A header');
      assert.ok(html.includes('problem-header-index">B<'), 'Should have problem B header');
      assert.ok(html.includes('problem-header-index">C<'), 'Should have problem C header');
    });
  });

  suite('Problem Cells', () => {
    test('accepted problem shows accepted styling', () => {
      setState({
        rows: [
          buildRow('user1', 1, 500, 10, [
            buildProblemResult({ points: 500, rejectedAttemptCount: 0, bestSubmissionTimeSeconds: 300 }),
            buildProblemResult(),
            buildProblemResult(),
          ]),
        ],
      });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('problem-accepted'), 'Should have accepted class');
    });

    test('rejected problem shows rejected styling', () => {
      setState({
        rows: [
          buildRow('user1', 1, 0, 0, [
            buildProblemResult({ points: 0, rejectedAttemptCount: 3 }),
            buildProblemResult(),
            buildProblemResult(),
          ]),
        ],
      });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('problem-rejected'), 'Should have rejected class');
      assert.ok(html.includes('-3'), 'Should show rejection count');
    });

    test('not attempted problem shows dot', () => {
      setState({
        rows: [
          buildRow('user1', 1, 0, 0, [
            buildProblemResult(),
            buildProblemResult(),
            buildProblemResult(),
          ]),
        ],
      });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('problem-not-attempted'), 'Should have not-attempted class');
    });
  });

  suite('Hack Cells', () => {
    test('shows hack counts when present', () => {
      setState({
        rows: [
          buildRow('hacker', 1, 1000, 10, [buildProblemResult(), buildProblemResult(), buildProblemResult()], {
            successfulHackCount: 3,
            unsuccessfulHackCount: 1,
          }),
        ],
      });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('hack-plus'), 'Should have hack-plus class');
      assert.ok(html.includes('+3'), 'Should show successful hack count');
      assert.ok(html.includes('hack-minus'), 'Should have hack-minus class');
      assert.ok(html.includes('-1'), 'Should show unsuccessful hack count');
    });

    test('no hacks shows dash', () => {
      setState({
        rows: [
          buildRow('user1', 1, 1000, 10, [buildProblemResult(), buildProblemResult(), buildProblemResult()], {
            successfulHackCount: 0,
            unsuccessfulHackCount: 0,
          }),
        ],
      });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('hacks-cell'), 'Should have hacks cell');
      // The cell should contain a dash for no hacks
      assert.ok(html.includes('problem-not-attempted">-<'), 'Should show dash for no hacks');
    });
  });

  suite('Empty Rows', () => {
    test('shows empty state with no rows', () => {
      setState({ rows: [] });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('empty-state'), 'Should show empty state');
      assert.ok(html.includes('No standings available'), 'Should show no standings message');
    });

    test('friends only empty state shows specific message', () => {
      setState({ rows: [], friendsOnly: true });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('None of your friends'), 'Should show friends-specific empty message');
    });
  });

  suite('Loading State', () => {
    test('loading with no rows shows loading message', () => {
      setState({ rows: [], loading: true });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('Loading standings'), 'Should show loading message');
    });

    test('loading with existing rows shows refreshing indicator', () => {
      setState({
        rows: [
          buildRow('user1', 1, 1000, 10, [buildProblemResult(), buildProblemResult(), buildProblemResult()]),
        ],
        loading: true,
      });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('Refreshing'), 'Should show refreshing indicator');
    });
  });

  suite('Error State', () => {
    test('shows error message when present', () => {
      setState({ errorMessage: 'API rate limited' });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('API rate limited'), 'Should show error message');
      assert.ok(html.includes('error-card'), 'Should have error card class');
    });
  });

  suite('Current User Highlighting', () => {
    test('current user row has special class', () => {
      setState({
        rows: [
          buildRow('testuser', 1, 3000, 50, [buildProblemResult(), buildProblemResult(), buildProblemResult()]),
          buildRow('otheruser', 2, 2000, 80, [buildProblemResult(), buildProblemResult(), buildProblemResult()]),
        ],
      });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('row-current-user'), 'Should highlight current user row');
    });
  });

  suite('Controls', () => {
    test('has friends only toggle', () => {
      setState();
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes("post('toggleFriends')"), 'Should have toggle friends button');
    });

    test('has refresh button', () => {
      setState();
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes("post('refresh')"), 'Should have refresh button');
    });

    test('friends only label toggled', () => {
      setState({ friendsOnly: true });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('Show All'), 'Should show "Show All" when in friends mode');
    });

    test('non-friends mode shows friends only button', () => {
      setState({ friendsOnly: false });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('Friends Only'), 'Should show "Friends Only" button');
    });
  });

  suite('Participant Count', () => {
    test('shows loaded participant count', () => {
      setState({
        rows: [
          buildRow('a', 1, 100, 10, [buildProblemResult()]),
          buildRow('b', 2, 90, 20, [buildProblemResult()]),
          buildRow('c', 3, 80, 30, [buildProblemResult()]),
        ],
        problems: [{ contestId: 100, index: 'A', name: 'P', type: 'PROGRAMMING', tags: [] }],
      });
      const html = StandingsPanel.getHtml(mockWebview());
      assert.ok(html.includes('3 participants'), 'Should show participant count');
    });
  });
});

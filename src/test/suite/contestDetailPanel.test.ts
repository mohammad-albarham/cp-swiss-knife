/* eslint-disable @typescript-eslint/no-explicit-any */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { ContestDetailPanel } from '../../views/contestDetailPanel';

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
    id: 1900,
    name: 'Codeforces Round #900',
    type: 'CF',
    phase: 'FINISHED',
    frozen: false,
    durationSeconds: 7200,
    startTimeSeconds: 1700000000,
    ...overrides,
  };
}

function buildProblem(index: string, name: string): Record<string, unknown> {
  return {
    contestId: 1900,
    index,
    name,
    type: 'PROGRAMMING',
    tags: [],
  };
}

function buildUserRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    party: {
      members: [{ handle: 'testuser' }],
      participantType: 'CONTESTANT',
      ghost: false,
    },
    rank: 42,
    points: 3500,
    penalty: 120,
    successfulHackCount: 2,
    unsuccessfulHackCount: 1,
    problemResults: [
      { points: 500, rejectedAttemptCount: 0, type: 'FINAL', bestSubmissionTimeSeconds: 300 },
      { points: 1000, rejectedAttemptCount: 2, type: 'FINAL', bestSubmissionTimeSeconds: 1800 },
      { points: 0, rejectedAttemptCount: 3, type: 'FINAL' },
      { points: 0, rejectedAttemptCount: 0, type: 'FINAL' },
    ],
    ...overrides,
  };
}

function buildState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contestId: 1900,
    contest: buildContest(),
    problems: [
      buildProblem('A', 'Easy Task'),
      buildProblem('B', 'Medium Task'),
      buildProblem('C', 'Hard Task'),
      buildProblem('D', 'Very Hard Task'),
    ],
    participated: true,
    handle: 'testuser',
    userRow: buildUserRow(),
    ...overrides,
  };
}

suite('ContestDetailPanel Tests', () => {

  suite('HTML Structure', () => {
    test('getHtml returns valid HTML document', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('<!DOCTYPE html>'), 'Should start with DOCTYPE');
      assert.ok(html.includes('<html lang="en">'), 'Should have html tag');
      assert.ok(html.includes('</html>'), 'Should close html tag');
    });

    test('getHtml includes CSP', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('Content-Security-Policy'), 'Should include CSP');
      assert.ok(html.includes('nonce-'), 'CSP should use nonce');
    });

    test('getHtml includes theme styles', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('--bg:'), 'Should include theme CSS variables');
    });

    test('getHtml includes script section', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('acquireVsCodeApi()'), 'Should acquire VS Code API');
      assert.ok(html.includes('function post('), 'Should have post helper');
    });
  });

  suite('Contest with Full Data', () => {
    test('contains contest name', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('Codeforces Round #900'), 'Should contain contest name');
    });

    test('contains duration info', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('Duration'), 'Should show duration label');
    });

    test('contains phase info', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('Phase'), 'Should show phase label');
      assert.ok(html.includes('Finished'), 'Should show phase value');
    });

    test('contains hero section', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('class="hero"'), 'Should have hero section');
    });
  });

  suite('Error State', () => {
    test('shows error message when errorMessage is set', () => {
      const state = buildState({
        errorMessage: 'Network timeout',
        contest: undefined,
      });
      const html = ContestDetailPanel.getHtml(mockWebview(), state as any);
      assert.ok(html.includes('Network timeout'), 'Should contain the error message');
      assert.ok(html.includes('Failed to Load Contest'), 'Should show failed to load heading');
    });

    test('shows error when contest is null', () => {
      const state = buildState({ contest: undefined });
      const html = ContestDetailPanel.getHtml(mockWebview(), state as any);
      assert.ok(html.includes('Contest data could not be loaded'), 'Should show fallback error');
    });
  });

  suite('Non-Participant View', () => {
    test('shows no participation data for non-participant', () => {
      const state = buildState({
        participated: false,
        userRow: undefined,
        handle: 'someuser',
      });
      const html = ContestDetailPanel.getHtml(mockWebview(), state as any);
      assert.ok(html.includes('No Participation Data'), 'Should show no participation message');
    });

    test('non-participant shows handle note', () => {
      const state = buildState({
        participated: false,
        userRow: undefined,
        handle: 'someuser',
      });
      const html = ContestDetailPanel.getHtml(mockWebview(), state as any);
      assert.ok(html.includes('someuser'), 'Should mention the handle');
      assert.ok(html.includes('did not participate'), 'Should say did not participate');
    });

    test('non-participant without handle shows login prompt', () => {
      const state = buildState({
        participated: false,
        userRow: undefined,
        handle: undefined,
      });
      const html = ContestDetailPanel.getHtml(mockWebview(), state as any);
      assert.ok(html.includes('Log in'), 'Should prompt to log in');
    });
  });

  suite('Problems List', () => {
    test('problem indices appear in output', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('>A<'), 'Should contain problem index A');
      assert.ok(html.includes('>B<'), 'Should contain problem index B');
      assert.ok(html.includes('>C<'), 'Should contain problem index C');
      assert.ok(html.includes('>D<'), 'Should contain problem index D');
    });

    test('problem names appear in output', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('Easy Task'), 'Should contain problem name A');
      assert.ok(html.includes('Medium Task'), 'Should contain problem name B');
    });

    test('problem grid has cells with status classes', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('problem-cell solved'), 'Should have solved cells');
      assert.ok(html.includes('problem-cell unsolved'), 'Should have unsolved cells');
      assert.ok(html.includes('problem-cell unattempted'), 'Should have unattempted cells');
    });
  });

  suite('User Participation', () => {
    test('shows rank for participant', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('#42'), 'Should show rank');
    });

    test('shows score for participant', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('3500'), 'Should show score');
    });

    test('shows penalty for participant', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('120'), 'Should show penalty');
    });

    test('performance section title present', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('Your Performance'), 'Should show performance section title');
    });

    test('shows rating change when present', () => {
      const state = buildState({
        ratingChange: {
          contestId: 1900,
          contestName: 'Codeforces Round #900',
          handle: 'testuser',
          rank: 42,
          ratingUpdateTimeSeconds: 1700007200,
          oldRating: 1500,
          newRating: 1600,
        },
      });
      const html = ContestDetailPanel.getHtml(mockWebview(), state as any);
      assert.ok(html.includes('Rating Change'), 'Should show rating change label');
      assert.ok(html.includes('+100'), 'Should show positive delta');
    });
  });

  suite('Standings Button', () => {
    test('view full standings button present', () => {
      const html = ContestDetailPanel.getHtml(mockWebview(), buildState() as any);
      assert.ok(html.includes('viewFullStandings'), 'Should have view standings command');
      assert.ok(html.includes('View Full Standings'), 'Should show button text');
    });
  });
});

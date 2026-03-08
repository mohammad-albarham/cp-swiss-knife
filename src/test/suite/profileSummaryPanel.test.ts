import * as assert from 'assert';
import * as vscode from 'vscode';
import { ProfileSummaryPanel } from '../../views/profileSummaryPanel';
import { User, RatingChange } from '../../api/types';
import { UserAnalyticsSnapshot } from '../../models/userAnalytics';

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

function buildUser(overrides: Partial<User> = {}): User {
  return {
    handle: 'tourist',
    rating: 3500,
    maxRating: 3800,
    rank: 'legendary grandmaster',
    maxRank: 'legendary grandmaster',
    contribution: 150,
    friendOfCount: 20000,
    registrationTimeSeconds: 1300000000,
    avatar: 'https://userpic.codeforces.org/no-avatar.jpg',
    titlePhoto: 'https://userpic.codeforces.org/no-title.jpg',
    lastOnlineTimeSeconds: 1700000000,
    ...overrides,
  } as User;
}

function buildRatingHistory(count: number = 3): RatingChange[] {
  const history: RatingChange[] = [];
  for (let i = 0; i < count; i++) {
    history.push({
      contestId: 1800 + i,
      contestName: `Codeforces Round #${800 + i}`,
      handle: 'tourist',
      rank: i + 1,
      ratingUpdateTimeSeconds: 1600000000 + i * 86400,
      oldRating: 3400 + i * 20,
      newRating: 3420 + i * 20,
    });
  }
  return history;
}

function buildAnalytics(overrides: Partial<UserAnalyticsSnapshot> = {}): UserAnalyticsSnapshot {
  return {
    handle: 'tourist',
    fetchedAt: Date.now(),
    analyzedSubmissionCount: 500,
    acceptedSubmissionCount: 400,
    solvedProblemCount: 350,
    attemptedProblemCount: 360,
    attemptedUnsolvedCount: 10,
    acceptanceRate: 0.8,
    isPartial: false,
    currentStreak: 5,
    longestStreak: 30,
    ratingBuckets: [
      { label: '800-1000', min: 800, max: 1000, count: 10 },
      { label: '1000-1200', min: 1000, max: 1200, count: 20 },
      { label: '1200-1400', min: 1200, max: 1400, count: 30 },
    ],
    topTags: [
      { tag: 'dp', count: 50 },
      { tag: 'math', count: 40 },
      { tag: 'greedy', count: 30 },
    ],
    recentSubmissions: [],
    mostDifficultSolved: {
      contestId: 1900,
      index: 'F',
      name: 'Super Hard',
      rating: 3200,
      tags: ['dp', 'trees'],
    },
    solvedProblems: [],
    ...overrides,
  };
}

suite('ProfileSummaryPanel Tests', () => {

  suite('HTML Generation', () => {
    test('getHtml returns valid HTML document', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('<!DOCTYPE html>'), 'Should start with DOCTYPE');
      assert.ok(html.includes('<html lang="en">'), 'Should have html tag');
      assert.ok(html.includes('</html>'), 'Should close html tag');
      assert.ok(html.includes('<head>'), 'Should have head section');
      assert.ok(html.includes('<body>'), 'Should have body section');
    });

    test('getHtml includes Content Security Policy', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('Content-Security-Policy'), 'Should include CSP meta tag');
      assert.ok(html.includes('nonce-'), 'CSP should use nonce');
    });

    test('getHtml includes theme styles', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('--bg:'), 'Should include theme CSS variables');
      assert.ok(html.includes('--accent:'), 'Should include accent variable');
    });
  });

  suite('User Info', () => {
    test('user handle appears in output', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser({ handle: 'myhandle123' }), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('myhandle123'), 'Should contain the user handle');
    });

    test('user rating is embedded in data', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser({ rating: 2500 }), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('"rating":2500'), 'Should contain the user rating');
    });

    test('user rank is embedded in data', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser({ rank: 'expert' }), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('"rank":"expert"'), 'Should contain the user rank');
    });

    test('maxRating is embedded in data', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser({ maxRating: 2800 }), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('"maxRating":2800'), 'Should contain the max rating');
    });
  });

  suite('Rating Chart Data', () => {
    test('ratingHistory is embedded as JSON', () => {
      const history = buildRatingHistory(2);
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), history, buildAnalytics());
      assert.ok(html.includes('"ratingHistory":['), 'Should contain ratingHistory array');
      assert.ok(html.includes('"contestName":"Codeforces Round #800"'), 'Should contain contest name');
    });

    test('rating chart canvas is present', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('id="ratingChart"'), 'Should have ratingChart canvas');
      assert.ok(html.includes('<canvas'), 'Should include a canvas element');
    });

    test('empty rating history still renders', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), [], buildAnalytics());
      assert.ok(html.includes('<!DOCTYPE html>'), 'Should still produce valid HTML');
      assert.ok(html.includes('"ratingHistory":[]'), 'Should have empty ratingHistory');
    });
  });

  suite('Analytics Summary', () => {
    test('solvedCount appears in data', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics({ solvedProblemCount: 42 }));
      assert.ok(html.includes('"solvedCount":42'), 'Should serialize solved count');
    });

    test('acceptanceRate appears in data', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics({ acceptanceRate: 0.95 }));
      assert.ok(html.includes('"acceptanceRate":0.95'), 'Should serialize acceptance rate');
    });

    test('streak data appears', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics({ currentStreak: 7, longestStreak: 14 }));
      assert.ok(html.includes('"currentStreak":7'), 'Should serialize current streak');
      assert.ok(html.includes('"longestStreak":14'), 'Should serialize longest streak');
    });

    test('contestCount derived from ratingHistory length', () => {
      const history = buildRatingHistory(5);
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), history, buildAnalytics());
      assert.ok(html.includes('"contestCount":5'), 'Should serialize contest count from rating history length');
    });
  });

  suite('Edge Cases', () => {
    test('no country or organization still produces valid HTML', () => {
      const user = buildUser({ country: undefined, city: undefined, organization: undefined });
      const html = ProfileSummaryPanel.getHtml(mockWebview(), user, buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('<!DOCTYPE html>'), 'Should still produce valid HTML');
      assert.ok(html.includes('"country":null'), 'Country should be null');
      assert.ok(html.includes('"organization":null'), 'Organization should be null');
    });

    test('user with country and organization renders them', () => {
      const user = buildUser({ country: 'Belarus', organization: 'ITMO' });
      const html = ProfileSummaryPanel.getHtml(mockWebview(), user, buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('"country":"Belarus"'), 'Should include country');
      assert.ok(html.includes('"organization":"ITMO"'), 'Should include organization');
    });

    test('zero solved problems still renders', () => {
      const analytics = buildAnalytics({ solvedProblemCount: 0, mostDifficultSolved: undefined });
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), analytics);
      assert.ok(html.includes('<!DOCTYPE html>'), 'Should produce valid HTML');
      assert.ok(html.includes('"solvedCount":0'), 'Should show zero solved');
      assert.ok(html.includes('"mostDifficultSolved":null'), 'Most difficult should be null');
    });
  });

  suite('Rating Bars and Tags', () => {
    test('ratingBuckets are serialized', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('"ratingBuckets":['), 'Should serialize rating buckets');
    });

    test('topTags are serialized', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('"topTags":['), 'Should serialize top tags');
      assert.ok(html.includes('"tag":"dp"'), 'Should include tag names');
    });

    test('rating bar container exists', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('id="ratingBars"'), 'Should have ratingBars container');
    });

    test('tag bar container exists', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('id="tagBars"'), 'Should have tagBars container');
    });
  });

  suite('UI Elements', () => {
    test('includes hero section', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('class="hero"'), 'Should have hero section');
    });

    test('includes stats grid', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('id="statsGrid"'), 'Should have stats grid');
    });

    test('includes refresh button', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes("post('refresh')"), 'Should have refresh button');
    });

    test('includes open on web button', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('id="btnWeb"'), 'Should have open on web button');
    });

    test('includes footer row', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('id="footerRow"'), 'Should have footer row');
    });
  });

  suite('Script and Interactivity', () => {
    test('includes acquireVsCodeApi', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('acquireVsCodeApi()'), 'Should acquire VS Code API');
    });

    test('includes rating color helper', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('function rc(r)'), 'Should have rating color function');
    });

    test('includes esc function for XSS protection', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      assert.ok(html.includes('function esc(s)'), 'Should have esc function');
    });

    test('nonce is present on script tag', () => {
      const html = ProfileSummaryPanel.getHtml(mockWebview(), buildUser(), buildRatingHistory(), buildAnalytics());
      const scriptNonce = html.match(/script nonce="([a-f0-9]+)"/);
      assert.ok(scriptNonce, 'Should have nonce on script tag');
    });
  });
});

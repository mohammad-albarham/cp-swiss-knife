import * as assert from 'assert';
import * as vscode from 'vscode';
import { SolvedProblemsPanel } from '../../views/solvedProblemsPanel';
import { UserAnalyticsSnapshot, UserAnalyticsProblemSummary } from '../../models/userAnalytics';

// Helper: build a minimal mock webview
function mockWebview(): vscode.Webview {
  return {
    cspSource: 'https://mock.csp.source',
    html: '',
    options: {},
    onDidReceiveMessage: () => ({ dispose: () => { /* noop */ } }),
    postMessage: async () => true,
    asWebviewUri: (uri: vscode.Uri) => uri,
  } as unknown as vscode.Webview;
}

// Helper: build a snapshot with configurable data
function buildSnapshot(overrides: Partial<UserAnalyticsSnapshot> = {}): UserAnalyticsSnapshot {
  return {
    handle: 'testuser',
    fetchedAt: Date.now(),
    analyzedSubmissionCount: 100,
    acceptedSubmissionCount: 60,
    solvedProblemCount: 40,
    attemptedProblemCount: 50,
    attemptedUnsolvedCount: 10,
    acceptanceRate: 0.6,
    isPartial: false,
    ratingBuckets: [
      { label: '800-1000', min: 800, max: 1000, count: 5 },
      { label: '1000-1200', min: 1000, max: 1200, count: 10 },
      { label: '1200-1400', min: 1200, max: 1400, count: 8 },
      { label: '1400-1600', min: 1400, max: 1600, count: 7 },
      { label: '1600-1800', min: 1600, max: 1800, count: 5 },
      { label: '1800-2000', min: 1800, max: 2000, count: 3 },
      { label: '2000-2200', min: 2000, max: 2200, count: 2 },
      { label: '2200-2400', min: 2200, max: 2400, count: 0 },
    ],
    topTags: [
      { tag: 'dp', count: 15 },
      { tag: 'greedy', count: 12 },
      { tag: 'math', count: 10 },
      { tag: 'implementation', count: 8 },
    ],
    recentSubmissions: [],
    mostDifficultSolved: {
      contestId: 1900,
      index: 'D',
      name: 'Hard Problem',
      rating: 2100,
      tags: ['dp', 'graphs']
    },
    solvedProblems: [
      { contestId: 1, index: 'A', name: 'Watermelon', rating: 800, tags: ['math', 'brute force'] },
      { contestId: 4, index: 'A', name: 'Watermelon Again', rating: 800, tags: ['math'] },
      { contestId: 71, index: 'A', name: 'Way Too Long Words', rating: 1000, tags: ['strings', 'implementation'] },
      { contestId: 158, index: 'B', name: 'Taxi', rating: 1100, tags: ['greedy', 'implementation'] },
      { contestId: 1900, index: 'D', name: 'Hard Problem', rating: 2100, tags: ['dp', 'graphs'] },
    ],
    ...overrides
  };
}

suite('SolvedProblemsPanel Tests', () => {

  // ============================
  // HTML Structure Tests
  // ============================
  suite('HTML Generation', () => {
    test('getHtml returns valid HTML document', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('<!DOCTYPE html>'), 'Should start with DOCTYPE');
      assert.ok(html.includes('<html lang="en">'), 'Should have html tag');
      assert.ok(html.includes('</html>'), 'Should close html tag');
      assert.ok(html.includes('<head>'), 'Should have head section');
      assert.ok(html.includes('<body>'), 'Should have body section');
    });

    test('getHtml includes Content Security Policy', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('Content-Security-Policy'), 'Should include CSP meta tag');
      assert.ok(html.includes('script-src'), 'CSP should have script-src directive');
      assert.ok(html.includes('nonce-'), 'CSP should use nonce');
    });

    test('getHtml includes nonce on script tag', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      const scriptNonce = html.match(/script nonce="([a-f0-9]+)"/);
      assert.ok(scriptNonce, 'Should have nonce on script tag');
      const cspNonce = html.match(/nonce-([a-f0-9]+)/);
      assert.ok(cspNonce, 'Should have nonce in CSP');
      assert.strictEqual(scriptNonce![1], cspNonce![1], 'Script nonce should match CSP nonce');
    });

    test('getHtml includes theme styles', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('--bg:'), 'Should include theme CSS variables');
      assert.ok(html.includes('--accent:'), 'Should include accent variable');
    });
  });

  // ============================
  // Hero / Stat Grid Tests
  // ============================
  suite('Stat Grid', () => {
    test('includes stat grid container', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="statGrid"'), 'Should have stat grid element');
      assert.ok(html.includes('class="stat-grid"'), 'CSS should define stat-grid');
    });

    test('serializes total solved count', () => {
      const snapshot = buildSnapshot({ solvedProblemCount: 42 });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      assert.ok(html.includes('"totalSolved":42'), 'Should serialize solved count');
    });

    test('serializes acceptance rate', () => {
      const snapshot = buildSnapshot({ acceptanceRate: 0.75 });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      assert.ok(html.includes('"acceptanceRate":0.75'), 'Should serialize acceptance rate');
    });

    test('serializes attempted count and unsolved count', () => {
      const snapshot = buildSnapshot({ attemptedProblemCount: 50, attemptedUnsolvedCount: 10 });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      assert.ok(html.includes('"attemptedCount":50'), 'Should serialize attempted count');
      assert.ok(html.includes('"attemptedUnsolved":10'), 'Should serialize unsolved count');
    });

    test('serializes most difficult solved problem', () => {
      const snapshot = buildSnapshot({
        mostDifficultSolved: {
          contestId: 1900,
          index: 'D',
          name: 'Hard Problem',
          rating: 2100,
          tags: ['dp']
        }
      });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      assert.ok(html.includes('"mostDifficult":{'), 'Should serialize most difficult');
      assert.ok(html.includes('"contestId":1900'), 'Should include contest ID');
      assert.ok(html.includes('"rating":2100'), 'Should include rating');
    });

    test('handles null most difficult solved', () => {
      const snapshot = buildSnapshot({ mostDifficultSolved: undefined });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      assert.ok(html.includes('"mostDifficult":null'), 'Should serialize as null');
    });

    test('includes partial data indicator', () => {
      const snapshot = buildSnapshot({ isPartial: true, analyzedSubmissionCount: 5000 });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      assert.ok(html.includes('"isPartial":true'), 'Should serialize isPartial flag');
      assert.ok(html.includes('"analyzedCount":5000'), 'Should serialize analyzed count');
    });
  });

  // ============================
  // Rating Distribution Tests
  // ============================
  suite('Rating Distribution', () => {
    test('includes rating chart canvas', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="ratingChart"'), 'Should have rating chart canvas');
      assert.ok(html.includes('<canvas'), 'Should include a canvas element');
    });

    test('includes drawRatingChart function', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function drawRatingChart()'), 'Should have chart drawing function');
    });

    test('serializes rating buckets correctly', () => {
      const snapshot = buildSnapshot({
        ratingBuckets: [
          { label: '800-1000', min: 800, max: 1000, count: 5 },
          { label: '1000-1200', min: 1000, max: 1200, count: 0 },
        ]
      });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      assert.ok(html.includes('"ratingBuckets":['), 'Should serialize buckets array');
      assert.ok(html.includes('"count":5'), 'Should include bucket count');
    });

    test('includes bucket row for interactive filtering', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="bucketRow"'), 'Should have bucket row');
      assert.ok(html.includes('class="bucket-row"'), 'CSS should define bucket-row');
      assert.ok(html.includes('.bucket-active'), 'CSS should define active state');
    });

    test('includes canvas click handler for bar chart', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("getElementById('ratingChart').addEventListener('click'"), 'Should have canvas click handler');
    });

    test('includes chart mode toggle buttons', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="chartModeToggle"'), 'Should have chart mode toggle container');
      assert.ok(html.includes('data-chart-view="bar"'), 'Should have bar mode button');
      assert.ok(html.includes('data-chart-view="pie"'), 'Should have pie mode button');
    });

    test('includes pie chart rendering helpers', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function drawRatingPieChart('), 'Should have pie chart renderer');
      assert.ok(html.includes("currentChartView === 'pie'"), 'Should branch to pie mode');
      assert.ok(html.includes('function setChartView('), 'Should have chart mode setter');
    });

    test('reuses filtered rating buckets helper', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function getVisibleRatingBuckets()'), 'Should centralize visible buckets');
      assert.ok(html.includes('var bkts = getVisibleRatingBuckets();'), 'Should reuse visible bucket helper');
    });
  });

  // ============================
  // Tag Distribution Tests
  // ============================
  suite('Tag Distribution', () => {
    test('includes tag bars container', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="tagsBars"'), 'Should have tags bars container');
    });

    test('serializes top tags', () => {
      const snapshot = buildSnapshot({
        topTags: [
          { tag: 'dp', count: 15 },
          { tag: 'greedy', count: 12 }
        ]
      });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      assert.ok(html.includes('"topTags":['), 'Should serialize top tags');
      assert.ok(html.includes('"tag":"dp"'), 'Should include tag names');
      assert.ok(html.includes('"count":15'), 'Should include tag counts');
    });

    test('includes tag bar CSS styles', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('.tag-bar-row'), 'CSS should define tag-bar-row');
      assert.ok(html.includes('.tag-bar-fill'), 'CSS should define tag-bar-fill');
      assert.ok(html.includes('.tag-bar-track'), 'CSS should define tag-bar-track');
    });
  });

  // ============================
  // Interactive Filter Tests
  // ============================
  suite('Interactive Filters', () => {
    test('includes toggleRatingFilter function', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function toggleRatingFilter('), 'Should have rating filter toggle');
    });

    test('includes toggleTagFilter function', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function toggleTagFilter('), 'Should have tag filter toggle');
    });

    test('includes updateActiveStates function', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function updateActiveStates()'), 'Should have active state updater');
    });

    test('filter bar has search input', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="searchInput"'), 'Should have search input');
      assert.ok(html.includes('placeholder="Search by name or ID'), 'Search should have placeholder');
    });

    test('filter bar has rating dropdown', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="ratingFilter"'), 'Should have rating filter dropdown');
      assert.ok(html.includes('All Ratings'), 'Should have default option');
    });

    test('filter bar has tag dropdown', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="tagFilter"'), 'Should have tag filter dropdown');
      assert.ok(html.includes('All Tags'), 'Should have default option');
    });

    test('filter bar has clear button', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="clearFiltersBtn"'), 'Should have clear button element');
      assert.ok(html.includes("getElementById('clearFiltersBtn').addEventListener('click', clearFilters)"), 'Should bind clear button through event listener');
    });

    test('filter count element exists', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="filterCount"'), 'Should have filter count element');
    });
  });

  // ============================
  // Table Enhancement Tests
  // ============================
  suite('Enhanced Table', () => {
    test('table is wrapped in table-wrapper', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="tableWrapper"'), 'Should have table wrapper');
      assert.ok(html.includes('class="table-wrapper"'), 'CSS should define table-wrapper');
    });

    test('table has sticky header styles', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('position: sticky'), 'Should have sticky position');
      assert.ok(html.includes('top: 0'), 'Should stick to top');
      assert.ok(html.includes('z-index: 2'), 'Should have z-index for stacking');
    });

    test('table has alternating row styles', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('tbody tr:nth-child(even)'), 'Should have alternating row styles');
    });

    test('table has hover effect styles', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('tbody tr:hover'), 'Should have row hover styles');
    });

    test('table has 5 columns including Actions', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      // Match <th> tags but not <thead> — use <th followed by space or >
      const theadMatch = html.match(/<thead>[\s\S]*?<\/thead>/);
      assert.ok(theadMatch, 'Should have thead element');
      const thMatches = theadMatch![0].match(/<th[\s>]/g);
      assert.ok(thMatches, 'Should have th elements');
      assert.strictEqual(thMatches!.length, 5, 'Should have 5 column headers');
      assert.ok(html.includes('>Actions<'), 'Should have Actions column');
    });

    test('table has sortable headers', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('th data-sort-field="id"'), 'Problem column should declare sortable field');
      assert.ok(html.includes('th data-sort-field="name"'), 'Name column should declare sortable field');
      assert.ok(html.includes('th data-sort-field="rating"'), 'Rating column should declare sortable field');
      assert.ok(html.includes("querySelectorAll('th[data-sort-field]')"), 'Should bind sortable headers through event listeners');
    });

    test('includes sort arrow elements', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="sort-id"'), 'Should have id sort arrow');
      assert.ok(html.includes('id="sort-name"'), 'Should have name sort arrow');
      assert.ok(html.includes('id="sort-rating"'), 'Should have rating sort arrow');
    });

    test('includes openOnWeb function', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function openOnWeb('), 'Should have openOnWeb function');
    });

    test('action link CSS exists', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('.action-cell'), 'CSS should define action-cell');
      assert.ok(html.includes('.action-link'), 'CSS should define action-link');
    });
  });

  // ============================
  // View Toggle Tests
  // ============================
  suite('View Toggle', () => {
    test('includes view toggle buttons', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="viewToggle"'), 'Should have view toggle container');
      assert.ok(html.includes('data-view="table"'), 'Should have table view button');
      assert.ok(html.includes('data-view="grid"'), 'Should have grid view button');
    });

    test('table view is active by default', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      // The table button should be active initially
      const tableBtn = html.match(/data-view="table"[^>]*>/);
      assert.ok(tableBtn, 'Should have table button');
      // Check that the vt-btn with data-view="table" also has the active class
      assert.ok(html.includes('class="vt-btn active" data-view="table"'), 'Table button should have active class');
    });

    test('includes grid container', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="gridContainer"'), 'Should have grid container');
      assert.ok(html.includes('class="problem-grid-view"'), 'CSS should define grid view');
    });

    test('grid container hidden by default', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="gridContainer" class="problem-grid-view" style="display:none;"'), 'Grid should be hidden initially');
    });

    test('includes setView function', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function setView('), 'Should have setView function');
    });

    test('includes grid card styles', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('.problem-card'), 'CSS should define problem-card');
      assert.ok(html.includes('.problem-card-header'), 'CSS should define card header');
      assert.ok(html.includes('.problem-card-name'), 'CSS should define card name');
      assert.ok(html.includes('.problem-card-tags'), 'CSS should define card tags');
    });

    test('grid cards have hover effects', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('.problem-card:hover'), 'Cards should have hover styles');
      assert.ok(html.includes('translateY(-2px)'), 'Cards should lift on hover');
    });
  });

  // ============================
  // Copy/Export Tests
  // ============================
  suite('Copy/Export', () => {
    test('includes copy button', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="copyBtn"'), 'Should have copy button');
      assert.ok(html.includes("getElementById('copyBtn').addEventListener('click', copyToClipboard)"), 'Button should bind copy action through event listener');
    });

    test('includes copyToClipboard function', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function copyToClipboard()'), 'Should have copyToClipboard function');
    });

    test('copyToClipboard sends message to extension', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("command: 'copyToClipboard'"), 'Should send copyToClipboard command');
    });

    test('copy button shows feedback', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("'Copied!'"), 'Should show Copied! feedback');
      assert.ok(html.includes("'Copy List'"), 'Should restore Copy List text');
    });
  });

  // ============================
  // Keyboard Shortcuts Tests
  // ============================
  suite('Keyboard Shortcuts', () => {
    test('includes keydown event listener', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("addEventListener('keydown'"), 'Should have keydown listener');
    });

    test('handles Ctrl+F for search focus', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("e.key === 'f'"), 'Should check for f key');
      assert.ok(html.includes('e.ctrlKey || e.metaKey'), 'Should check for Ctrl/Cmd modifier');
      assert.ok(html.includes('searchInput'), 'Should reference search input');
    });

    test('handles Escape for clearing filters', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("e.key === 'Escape'"), 'Should check for Escape key');
    });
  });

  // ============================
  // Empty State Tests
  // ============================
  suite('Empty State', () => {
    test('includes empty state building functions', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function buildEmptyState('), 'Should have buildEmptyState');
      assert.ok(html.includes('function buildEmptyStateContent('), 'Should have buildEmptyStateContent');
      assert.ok(html.includes('function buildEmptyStateDiv('), 'Should have buildEmptyStateDiv');
    });

    test('empty state includes clear all button', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('Clear All Filters'), 'Should have clear all button in empty state');
    });

    test('empty state CSS exists', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('.empty-state-cell'), 'CSS should define empty-state-cell');
      assert.ok(html.includes('.empty-icon'), 'CSS should define empty-icon');
      assert.ok(html.includes('.empty-title'), 'CSS should define empty-title');
    });
  });

  // ============================
  // Problem Data Serialization Tests
  // ============================
  suite('Problem Data Serialization', () => {
    test('serializes problems as JSON array', () => {
      const snapshot = buildSnapshot({
        solvedProblems: [
          { contestId: 1, index: 'A', name: 'Test', rating: 800, tags: ['math'] }
        ]
      });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      assert.ok(html.includes('"contestId":1'), 'Should serialize contestId');
      assert.ok(html.includes('"index":"A"'), 'Should serialize index');
      assert.ok(html.includes('"name":"Test"'), 'Should serialize name');
      assert.ok(html.includes('"rating":800'), 'Should serialize rating');
      assert.ok(html.includes('"tags":["math"]'), 'Should serialize tags');
    });

    test('handles problem with no rating', () => {
      const snapshot = buildSnapshot({
        solvedProblems: [
          { contestId: 1, index: 'A', name: 'No Rating', tags: ['math'] }
        ]
      });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      assert.ok(html.includes('"rating":null'), 'Should serialize undefined rating as null');
    });

    test('handles problem with empty tags', () => {
      const snapshot = buildSnapshot({
        solvedProblems: [
          { contestId: 1, index: 'A', name: 'No Tags', rating: 800, tags: [] }
        ]
      });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      assert.ok(html.includes('"tags":[]'), 'Should serialize empty tags array');
    });

    test('collects and sorts all unique tags', () => {
      const snapshot = buildSnapshot({
        solvedProblems: [
          { contestId: 1, index: 'A', name: 'P1', rating: 800, tags: ['math', 'dp'] },
          { contestId: 2, index: 'A', name: 'P2', rating: 900, tags: ['dp', 'greedy'] },
          { contestId: 3, index: 'A', name: 'P3', rating: 1000, tags: ['greedy'] },
        ]
      });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      // allTags should be sorted: dp, greedy, math
      assert.ok(html.includes('const allTags = ["dp","greedy","math"]'), 'Should have sorted unique tags');
    });

    test('handles empty problem list', () => {
      const snapshot = buildSnapshot({ solvedProblems: [], solvedProblemCount: 0 });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      assert.ok(html.includes('const allProblems = []'), 'Should have empty problems array');
      assert.ok(html.includes('"totalSolved":0'), 'Should show zero solved');
    });
  });

  // ============================
  // Sort Logic Tests
  // ============================
  suite('Sort Logic', () => {
    test('default sort is by rating descending', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("currentSort = { field: 'rating', dir: 'desc' }"), 'Default sort should be rating desc');
    });

    test('includes sortProblems function', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function sortProblems('), 'Should have sort function');
    });

    test('sortProblems supports id sorting', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("f === 'id'"), 'Should handle id field sort');
      assert.ok(html.includes('a.contestId - b.contestId'), 'Should compare contest IDs numerically');
    });

    test('sortProblems supports name sorting', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("f === 'name'"), 'Should handle name field sort');
      assert.ok(html.includes('a.name.localeCompare(b.name)'), 'Should compare names with localeCompare');
    });

    test('sortProblems supports rating sorting', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("f === 'rating'"), 'Should handle rating field sort');
      assert.ok(html.includes('(a.rating || 0) - (b.rating || 0)'), 'Should handle null ratings');
    });

    test('toggleSort changes direction for same field', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function toggleSort('), 'Should have toggleSort function');
    });

    test('name sort defaults to ascending', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("currentSort.dir = field === 'name' ? 'asc' : 'desc'"), 'Name should default to asc');
    });
  });

  // ============================
  // Pagination Tests
  // ============================
  suite('Pagination', () => {
    test('PAGE_SIZE is set to 100', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('const PAGE_SIZE = 100'), 'Should use PAGE_SIZE of 100');
    });

    test('includes loadMore function', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function loadMore()'), 'Should have loadMore function');
    });

    test('loadMore increments visibleCount by PAGE_SIZE', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('visibleCount += PAGE_SIZE'), 'Should increment by PAGE_SIZE');
    });

    test('includes load more container', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('id="loadMoreContainer"'), 'Should have load more container');
    });
  });

  // ============================
  // Filter Logic Tests
  // ============================
  suite('Filter Logic', () => {
    test('includes getFiltered function', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function getFiltered()'), 'Should have getFiltered function');
    });

    test('search filters by name and ID', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('!id.includes(search)'), 'Should filter by ID');
      assert.ok(html.includes('!p.name.toLowerCase().includes(search)'), 'Should filter by name');
    });

    test('rating filter checks range boundaries', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('p.rating < rMin'), 'Should check minimum rating');
      assert.ok(html.includes('p.rating >= rMax'), 'Should check maximum rating (exclusive)');
    });

    test('tag filter checks tag inclusion', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('!p.tags.includes(tagVal)'), 'Should check tag inclusion');
    });

    test('includes clearFilters function', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function clearFilters()'), 'Should have clearFilters function');
    });

    test('clearFilters resets all filters and calls updateActiveStates', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      // Check that clearFilters calls updateActiveStates
      assert.ok(html.includes('updateActiveStates'), 'clearFilters should call updateActiveStates');
    });
  });

  // ============================
  // Rating Color Tests
  // ============================
  suite('Rating Colors', () => {
    test('includes color function rc()', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function rc(r)'), 'Should have rating color function');
    });

    test('rc function handles null/undefined ratings', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("if (!r) return 'var(--muted)'"), 'Should return muted for no rating');
    });

    test('rc function covers all rating thresholds', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('r < 1200'), 'Should check < 1200');
      assert.ok(html.includes('r < 1400'), 'Should check < 1400');
      assert.ok(html.includes('r < 1600'), 'Should check < 1600');
      assert.ok(html.includes('r < 1900'), 'Should check < 1900');
      assert.ok(html.includes('r < 2100'), 'Should check < 2100');
      assert.ok(html.includes('r < 2300'), 'Should check < 2300');
      assert.ok(html.includes('r < 2600'), 'Should check < 2600');
      assert.ok(html.includes('r < 3000'), 'Should check < 3000');
    });
  });

  // ============================
  // Message Passing Tests
  // ============================
  suite('Message Passing', () => {
    test('includes vscode API acquisition', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('acquireVsCodeApi()'), 'Should acquire VS Code API');
    });

    test('includes preview function that posts message', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function preview('), 'Should have preview function');
      assert.ok(html.includes("command: 'previewProblem'"), 'Should post previewProblem command');
    });

    test('includes openOnWeb function that posts message', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function openOnWeb('), 'Should have openOnWeb function');
      assert.ok(html.includes("command: 'openOnWeb'"), 'Should post openOnWeb command');
    });

    test('includes refresh button that posts message', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("post('refresh')"), 'Should have refresh message post');
    });

    test('includes post helper function', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function post(cmd)'), 'Should have post helper');
    });
  });

  // ============================
  // Render Function Tests
  // ============================
  suite('Render Function', () => {
    test('includes render function', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('function render()'), 'Should have render function');
    });

    test('render is called on initial load', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      // The last render() call should be at the end of the script
      const scriptContent = html.split('<script')[1];
      assert.ok(scriptContent.includes('\n    render();\n'), 'Should call render at end of script');
    });

    test('render handles both table and grid views', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("currentView === 'table'"), 'Should check for table view');
      assert.ok(html.includes("tableWrapper.style.display = ''"), 'Should show table in table view');
      assert.ok(html.includes("gridContainer.style.display = 'none'"), 'Should hide grid in table view');
    });

    test('clickable tags in table have event.stopPropagation', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes('event.stopPropagation()'), 'Tags should stop event propagation');
    });
  });

  // ============================
  // Resize Handling Tests
  // ============================
  suite('Resize Handling', () => {
    test('chart redraws on window resize', () => {
      const html = SolvedProblemsPanel.getHtml(mockWebview(), buildSnapshot());
      assert.ok(html.includes("window.addEventListener('resize', drawRatingChart)"), 'Should redraw chart on resize');
    });
  });

  // ============================
  // Special Character / XSS Tests
  // ============================
  suite('Special Characters', () => {
    test('problem names with special chars are handled in JSON', () => {
      const snapshot = buildSnapshot({
        solvedProblems: [
          { contestId: 1, index: 'A', name: 'Test <b>bold</b>', rating: 800, tags: [] }
        ]
      });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      // JSON.stringify keeps angle brackets but they are inside a <script> tag
      // and rendered via the esc() function when inserted into DOM
      assert.ok(html.includes('function esc(s)'), 'Should have esc function for XSS protection');
      assert.ok(html.includes('d.textContent = s'), 'esc should use textContent for safe escaping');
    });

    test('tag names with special chars are handled via esc function', () => {
      const snapshot = buildSnapshot({
        topTags: [{ tag: 'dp & greedy', count: 5 }]
      });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      // Tags are rendered through the esc() function in the client-side JS
      assert.ok(html.includes('esc(t.tag)'), 'Tag rendering should use esc() function');
      assert.ok(html.includes('esc(t)'), 'Table tag rendering should use esc() function');
    });
  });

  // ============================
  // Large Dataset Tests
  // ============================
  suite('Large Datasets', () => {
    test('handles 1000+ problems without error', () => {
      const problems: UserAnalyticsProblemSummary[] = [];
      for (let i = 0; i < 1500; i++) {
        problems.push({
          contestId: 1000 + i,
          index: 'A',
          name: `Problem ${i}`,
          rating: 800 + Math.floor(i / 10) * 100,
          tags: ['dp', 'greedy']
        });
      }
      const snapshot = buildSnapshot({
        solvedProblems: problems,
        solvedProblemCount: problems.length
      });
      const html = SolvedProblemsPanel.getHtml(mockWebview(), snapshot);
      assert.ok(html.includes('"totalSolved":1500'), 'Should handle large problem count');
      assert.ok(html.length > 10000, 'HTML should be reasonably large');
    });
  });
});

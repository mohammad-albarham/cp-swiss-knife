import * as vscode from 'vscode';
import { UserAnalyticsSnapshot } from '../models/userAnalytics';
import { getAuthService } from '../services/authService';
import { getUserStatsService } from '../services/userStatsService';
import { getNonce, getCspMeta, getThemeStyles, escapeHtml } from './webviewUtils';

const PAGE_SIZE = 100;

export class SolvedProblemsPanel {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static context: vscode.ExtensionContext | undefined;

  static show(context: vscode.ExtensionContext): void {
    SolvedProblemsPanel.context = context;

    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (SolvedProblemsPanel.currentPanel) {
      SolvedProblemsPanel.currentPanel.reveal(column);
      return;
    }

    SolvedProblemsPanel.currentPanel = vscode.window.createWebviewPanel(
      'codeforcesSolvedProblems',
      'Solved Problems',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri]
      }
    );

    SolvedProblemsPanel.currentPanel.onDidDispose(() => {
      SolvedProblemsPanel.currentPanel = undefined;
    }, null, context.subscriptions);

    SolvedProblemsPanel.currentPanel.webview.onDidReceiveMessage(async message => {
      switch (message.command) {
        case 'previewProblem':
          await vscode.commands.executeCommand(
            'codeforces.previewProblem',
            message.contestId,
            message.index,
            message.name
          );
          break;
        case 'openOnWeb':
          await vscode.env.openExternal(
            vscode.Uri.parse(
              `https://codeforces.com/problemset/problem/${encodeURIComponent(message.contestId)}/${encodeURIComponent(message.index)}`
            )
          );
          break;
        case 'copyToClipboard':
          await vscode.env.clipboard.writeText(message.text);
          vscode.window.showInformationMessage(
            `Copied ${message.count} problems to clipboard.`
          );
          break;
        case 'refresh':
          await SolvedProblemsPanel.fetchAndRender(true);
          break;
      }
    }, undefined, context.subscriptions);

    void SolvedProblemsPanel.fetchAndRender(false);
  }

  private static async fetchAndRender(forceRefresh: boolean): Promise<void> {
    const panel = SolvedProblemsPanel.currentPanel;
    if (!panel) { return; }

    const authService = getAuthService();
    const user = authService.getCurrentUser();

    if (!user) {
      panel.webview.html = SolvedProblemsPanel.getErrorHtml(panel.webview, 'Please login first.');
      return;
    }

    panel.webview.html = SolvedProblemsPanel.getLoadingHtml(panel.webview);

    try {
      const snapshot = await getUserStatsService().getSnapshot(user.handle, forceRefresh);
      panel.webview.html = SolvedProblemsPanel.getHtml(panel.webview, snapshot);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      panel.webview.html = SolvedProblemsPanel.getErrorHtml(panel.webview, msg);
    }
  }

  private static getLoadingHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${getCspMeta(webview, nonce)}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${getThemeStyles()}</style>
</head>
<body>
  <div class="shell" style="text-align:center;padding-top:80px;">
    <p style="font-size:16px;color:var(--muted);">Loading solved problems...</p>
  </div>
</body>
</html>`;
  }

  private static getErrorHtml(webview: vscode.Webview, message: string): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${getCspMeta(webview, nonce)}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${getThemeStyles()}</style>
</head>
<body>
  <div class="shell" style="text-align:center;padding-top:80px;">
    <p style="font-size:16px;color:var(--bad);">${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
  }

  static getHtml(webview: vscode.Webview, snapshot: UserAnalyticsSnapshot): string {
    const nonce = getNonce();

    const problems = snapshot.solvedProblems.map(p => ({
      contestId: p.contestId,
      index: p.index,
      name: p.name,
      rating: p.rating ?? null,
      tags: p.tags || []
    }));

    const summary = {
      totalSolved: snapshot.solvedProblemCount,
      acceptanceRate: snapshot.acceptanceRate,
      attemptedCount: snapshot.attemptedProblemCount,
      attemptedUnsolved: snapshot.attemptedUnsolvedCount,
      ratingBuckets: snapshot.ratingBuckets,
      topTags: snapshot.topTags,
      mostDifficult: snapshot.mostDifficultSolved
        ? {
            contestId: snapshot.mostDifficultSolved.contestId,
            index: snapshot.mostDifficultSolved.index,
            name: snapshot.mostDifficultSolved.name,
            rating: snapshot.mostDifficultSolved.rating ?? null
          }
        : null,
      isPartial: snapshot.isPartial,
      analyzedCount: snapshot.analyzedSubmissionCount
    };

    const tagSet = new Set<string>();
    for (const p of problems) {
      for (const t of p.tags) { tagSet.add(t); }
    }
    const allTags = Array.from(tagSet).sort();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${getCspMeta(webview, nonce)}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${getThemeStyles()}

    /* Hero Section */
    .hero {
      margin-bottom: 20px;
      padding: 22px;
      border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
      border-radius: 18px;
      background: linear-gradient(160deg,
        color-mix(in srgb, var(--panel-strong) 95%, transparent),
        color-mix(in srgb, var(--panel) 88%, transparent));
      box-shadow: 0 18px 40px rgba(0,0,0,0.16);
    }
    .hero h1 {
      margin: 0 0 4px;
      font: 600 26px/1.15 var(--serif);
      color: var(--text);
    }
    .hero .sub {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 16px;
    }

    /* Stat Grid */
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 14px;
      margin-bottom: 14px;
    }
    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .stat-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    .stat-value {
      font: 600 20px/1.2 var(--mono);
    }

    /* Chart Section */
    .chart-section {
      margin: 18px 0 10px;
    }
    .chart-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .section-label {
      margin: 0;
      font: 600 12px/1 var(--vscode-font-family);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    .chart-toggle {
      margin-left: 0;
    }

    /* Rating Buckets */
    .bucket-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
      margin: 10px 0 6px;
    }
    .bucket {
      padding: 4px 10px;
      border-radius: 999px;
      font: 600 11px/1 var(--mono);
      border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
      background: color-mix(in srgb, var(--panel) 80%, transparent);
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    .bucket:hover {
      transform: translateY(-1px);
    }
    .bucket-active {
      box-shadow: 0 0 0 2px currentColor;
      background: color-mix(in srgb, currentColor 12%, transparent);
    }

    /* Tag Bar Visualization */
    .tag-bar-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 8px;
      transition: background 120ms ease;
    }
    .tag-bar-row:hover {
      background: color-mix(in srgb, var(--accent) 8%, transparent);
    }
    .tag-bar-row.active {
      background: color-mix(in srgb, var(--accent) 14%, transparent);
    }
    .tag-bar-label {
      min-width: 140px;
      font-size: 12px;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tag-bar-track {
      flex: 1;
      height: 8px;
      background: color-mix(in srgb, var(--border) 30%, transparent);
      border-radius: 4px;
      overflow: hidden;
    }
    .tag-bar-fill {
      height: 100%;
      border-radius: 4px;
      background: var(--accent);
      transition: width 300ms ease;
    }
    .tag-bar-count {
      min-width: 32px;
      text-align: right;
      font: 600 12px/1 var(--mono);
      color: var(--muted);
    }

    /* Hero Actions */
    .hero-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      margin-top: 14px;
    }
    .refresh-btn {
      padding: 7px 14px;
      border-radius: 999px;
      font: 600 12px/1 var(--vscode-font-family);
      cursor: pointer;
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      background: transparent;
      color: var(--accent);
    }
    .refresh-btn:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }

    /* View Toggle */
    .view-toggle {
      display: inline-flex;
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 8px;
      overflow: hidden;
      margin-left: auto;
    }
    .vt-btn {
      padding: 6px 12px;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--muted);
      font-size: 12px;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
    }
    .vt-btn:hover { color: var(--text); }
    .vt-btn.active {
      background: color-mix(in srgb, var(--accent) 16%, transparent);
      color: var(--accent);
      font-weight: 600;
    }

    /* Filter Bar */
    .filter-bar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      margin: 14px 0;
      padding: 12px 16px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--panel) 90%, transparent);
      border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
    }
    .filter-bar input, .filter-bar select {
      padding: 7px 12px;
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 8px;
      background: var(--bg);
      color: var(--text);
      font: 13px var(--vscode-font-family);
      outline: none;
    }
    .filter-bar input:focus, .filter-bar select:focus {
      border-color: var(--accent);
    }
    .filter-bar input { flex: 1; min-width: 180px; }
    .filter-bar select { min-width: 140px; }
    .filter-bar .count {
      margin-left: auto;
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .clear-btn {
      padding: 7px 12px;
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 8px;
      background: transparent;
      color: var(--muted);
      font-size: 12px;
      cursor: pointer;
    }
    .clear-btn:hover { color: var(--text); border-color: var(--accent); }

    /* Enhanced Table */
    .table-wrapper {
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 16px;
      overflow: hidden;
      margin-top: 4px;
    }
    table { margin-top: 0; }
    thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: color-mix(in srgb, var(--panel-strong) 96%, transparent);
      border-bottom: 2px solid color-mix(in srgb, var(--border) 80%, transparent);
      cursor: pointer;
      user-select: none;
    }
    thead th:hover { color: var(--accent); }
    th .sort-arrow { font-size: 10px; margin-left: 4px; }
    tbody tr:nth-child(even) {
      background: color-mix(in srgb, var(--panel) 50%, transparent);
    }
    tbody tr:hover {
      background: color-mix(in srgb, var(--accent) 6%, transparent);
    }
    td a {
      color: var(--accent);
      text-decoration: none;
      cursor: pointer;
    }
    td a:hover { text-decoration: underline; }
    .rating-cell { font-weight: 700; font-family: var(--mono); }
    .action-cell { white-space: nowrap; }
    .action-link {
      color: var(--muted);
      cursor: pointer;
      font-size: 12px;
      padding: 2px 6px;
      border-radius: 4px;
      transition: color 120ms ease;
    }
    .action-link:hover { color: var(--accent); }

    /* Clickable Tags */
    .tag-clickable {
      cursor: pointer;
      transition: transform 100ms ease;
    }
    .tag-clickable:hover {
      transform: scale(1.05);
      filter: brightness(1.2);
    }

    /* Load More */
    .load-more-row { text-align: center; padding: 16px; }
    .load-more-btn {
      padding: 8px 24px;
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 8px;
      background: transparent;
      color: var(--accent);
      font-size: 13px;
      cursor: pointer;
    }
    .load-more-btn:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }

    /* Grid View */
    .problem-grid-view {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
      margin-top: 4px;
    }
    .problem-card {
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 14px;
      background: color-mix(in srgb, var(--panel) 92%, transparent);
      padding: 14px 16px;
      cursor: pointer;
      transition: transform 120ms ease, border-color 120ms ease;
    }
    .problem-card:hover {
      transform: translateY(-2px);
      border-color: var(--accent);
    }
    .problem-card-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 6px;
    }
    .problem-card-id {
      font: 700 14px/1 var(--mono);
      color: var(--accent);
    }
    .problem-card-rating { font: 700 13px/1 var(--mono); }
    .problem-card-name {
      font-size: 13px;
      color: var(--text);
      margin-bottom: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .problem-card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    /* Empty State */
    .empty-state-cell {
      text-align: center;
      padding: 48px 20px !important;
    }
    .empty-icon {
      font: 700 28px/1 var(--mono);
      color: var(--muted);
      margin-bottom: 8px;
      opacity: 0.5;
    }
    .empty-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 4px;
    }
    .empty-filters {
      color: var(--muted);
      margin: 8px 0 16px;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <h1>Solved Problems</h1>
      <div class="sub" id="heroSub"></div>
      <div class="stat-grid" id="statGrid"></div>

      <div class="chart-section">
        <div class="chart-header">
          <h3 class="section-label">Rating Distribution</h3>
          <div class="view-toggle chart-toggle" id="chartModeToggle">
            <button class="vt-btn active" data-chart-view="bar">Bar</button>
            <button class="vt-btn" data-chart-view="pie">Pie</button>
          </div>
        </div>
        <div class="bucket-row" id="bucketRow"></div>
        <canvas id="ratingChart" height="180" style="width:100%;max-width:700px;cursor:pointer;"></canvas>
      </div>

      <div class="chart-section">
        <h3 class="section-label">Top Tags</h3>
        <div id="tagsBars"></div>
      </div>

      <div class="hero-actions">
        <button class="refresh-btn" id="refreshBtn">Refresh Data</button>
        <button class="refresh-btn" id="copyBtn">Copy List</button>
        <div class="view-toggle" id="viewToggle">
          <button class="vt-btn active" data-view="table">Table</button>
          <button class="vt-btn" data-view="grid">Grid</button>
        </div>
      </div>
    </section>

    <div class="filter-bar">
      <input type="text" id="searchInput" placeholder="Search by name or ID (e.g. 1900A)" />
      <select id="ratingFilter">
        <option value="">All Ratings</option>
      </select>
      <select id="tagFilter">
        <option value="">All Tags</option>
      </select>
      <button class="clear-btn" id="clearFiltersBtn">Clear</button>
      <span class="count" id="filterCount"></span>
    </div>

    <div class="table-wrapper" id="tableWrapper">
      <table>
        <thead>
          <tr>
            <th data-sort-field="id">Problem <span class="sort-arrow" id="sort-id"></span></th>
            <th data-sort-field="name">Name <span class="sort-arrow" id="sort-name"></span></th>
            <th data-sort-field="rating">Rating <span class="sort-arrow" id="sort-rating"></span></th>
            <th>Tags</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
    </div>
    <div id="gridContainer" class="problem-grid-view" style="display:none;"></div>
    <div id="loadMoreContainer"></div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const allProblems = ${JSON.stringify(problems)};
    const summary = ${JSON.stringify(summary)};
    const allTags = ${JSON.stringify(allTags)};
    const PAGE_SIZE = ${PAGE_SIZE};

    let currentSort = { field: 'rating', dir: 'desc' };
    let visibleCount = PAGE_SIZE;
    let currentView = 'table';
    let currentChartView = 'bar';

    function rc(r) {
      if (!r) return 'var(--muted)';
      if (r < 1200) return '#808080';
      if (r < 1400) return '#008000';
      if (r < 1600) return '#03a89e';
      if (r < 1900) return '#0000ff';
      if (r < 2100) return '#aa00aa';
      if (r < 2300) return '#ff8c00';
      if (r < 2400) return '#ff8c00';
      if (r < 2600) return '#ff0000';
      if (r < 3000) return '#ff0000';
      return '#ff0000';
    }

    function esc(s) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    function post(cmd) {
      vscode.postMessage({ command: cmd });
    }

    // ---- Populate dropdowns ----
    const ratingSelect = document.getElementById('ratingFilter');
    const buckets = summary.ratingBuckets || [];
    buckets.forEach(function(b) {
      if (b.count > 0) {
        const opt = document.createElement('option');
        opt.value = b.min + '-' + b.max;
        opt.textContent = b.label + ' (' + b.count + ')';
        ratingSelect.appendChild(opt);
      }
    });

    const tagSelect = document.getElementById('tagFilter');
    allTags.forEach(function(t) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      tagSelect.appendChild(opt);
    });

    // ---- Render summary ----
    var heroSub = document.getElementById('heroSub');
    heroSub.textContent = summary.isPartial
      ? 'Based on latest ' + summary.analyzedCount + ' submissions'
      : summary.analyzedCount + ' submissions analyzed';

    // Stat grid
    var statGrid = document.getElementById('statGrid');
    statGrid.innerHTML =
      '<div class="stat-item"><span class="stat-label">Total Solved</span>' +
      '<span class="stat-value">' + summary.totalSolved + '</span></div>' +
      '<div class="stat-item"><span class="stat-label">Acceptance Rate</span>' +
      '<span class="stat-value">' + (summary.acceptanceRate * 100).toFixed(1) + '%</span></div>' +
      '<div class="stat-item"><span class="stat-label">Attempted</span>' +
      '<span class="stat-value">' + summary.attemptedCount + '</span></div>' +
      '<div class="stat-item"><span class="stat-label">Unsolved</span>' +
      '<span class="stat-value">' + summary.attemptedUnsolved + '</span></div>' +
      (summary.mostDifficult
        ? '<div class="stat-item"><span class="stat-label">Hardest Solved</span>' +
          '<span class="stat-value" style="color:' + rc(summary.mostDifficult.rating) + '">' +
          summary.mostDifficult.contestId + summary.mostDifficult.index +
          (summary.mostDifficult.rating ? ' (' + summary.mostDifficult.rating + ')' : '') +
          '</span></div>'
        : '');

    // Rating bucket badges
    var bucketRow = document.getElementById('bucketRow');
    bucketRow.innerHTML = buckets
      .filter(function(b) { return b.count > 0; })
      .map(function(b) {
        return '<span class="bucket" data-range="' + b.min + '-' + b.max + '"' +
          ' style="color:' + rc(b.min) + '">' +
          b.label + ': ' + b.count + '</span>';
      }).join('');

    // Tag bars visualization
    var tagsBars = document.getElementById('tagsBars');
    var topTags = summary.topTags || [];
    var maxTagCount = topTags.length > 0 ? topTags[0].count : 1;
    tagsBars.innerHTML = topTags.map(function(t) {
      var pct = ((t.count / maxTagCount) * 100).toFixed(1);
      return '<div class="tag-bar-row" data-tag="' + esc(t.tag) + '">' +
        '<span class="tag-bar-label">' + esc(t.tag) + '</span>' +
        '<div class="tag-bar-track"><div class="tag-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="tag-bar-count">' + t.count + '</span>' +
        '</div>';
    }).join('');

    function getVisibleRatingBuckets() {
      return (summary.ratingBuckets || []).filter(function(b) { return b.count > 0; });
    }

    function prepareChartCanvas() {
      var canvas = document.getElementById('ratingChart');
      if (!canvas) return null;
      var ctx = canvas.getContext('2d');
      var bkts = getVisibleRatingBuckets();
      if (bkts.length === 0) {
        canvas.style.display = 'none';
        return null;
      }

      canvas.style.display = '';

      var dpr = window.devicePixelRatio || 1;
      var rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      var W = rect.width, H = rect.height;

      ctx.clearRect(0, 0, W, H);
      return { canvas: canvas, ctx: ctx, buckets: bkts, width: W, height: H };
    }

    function drawRatingBarChart(chart) {
      var ctx = chart.ctx;
      var bkts = chart.buckets;
      var W = chart.width;
      var H = chart.height;
      var maxCount = Math.max.apply(null, bkts.map(function(b) { return b.count; }).concat([1]));
      var pad = { top: 14, bottom: 30, left: 10, right: 10 };
      var chartW = W - pad.left - pad.right;
      var chartH = H - pad.top - pad.bottom;
      var barW = Math.min(chartW / bkts.length - 6, 48);
      var gap = (chartW - barW * bkts.length) / (bkts.length + 1);

      var styles = getComputedStyle(document.body);
      var textColor = styles.getPropertyValue('color') || '#ccc';
      var mutedColor = styles.getPropertyValue('--muted') || '#888';

      bkts.forEach(function(b, i) {
        var barH = (b.count / maxCount) * chartH;
        var x = pad.left + gap + i * (barW + gap);
        var y = pad.top + chartH - barH;
        var isActive = ratingSelect.value === b.min + '-' + b.max;

        ctx.fillStyle = rc(b.min);
        ctx.beginPath();
        var r = Math.min(4, barW / 2);
        ctx.moveTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.arcTo(x + barW, y, x + barW, y + r, r);
        ctx.lineTo(x + barW, pad.top + chartH);
        ctx.lineTo(x, pad.top + chartH);
        ctx.closePath();
        ctx.fill();

        if (isActive) {
          ctx.strokeStyle = textColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Count above bar
        ctx.fillStyle = textColor;
        ctx.font = '600 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('' + b.count, x + barW / 2, y - 4);

        // Label below bar
        ctx.fillStyle = mutedColor;
        ctx.font = '10px sans-serif';
        ctx.fillText(b.label, x + barW / 2, pad.top + chartH + 16);
      });
    }

    function drawRatingPieChart(chart) {
      var ctx = chart.ctx;
      var bkts = chart.buckets;
      var W = chart.width;
      var H = chart.height;
      var styles = getComputedStyle(document.body);
      var textColor = styles.getPropertyValue('color') || '#ccc';
      var mutedColor = styles.getPropertyValue('--muted') || '#888';
      var total = bkts.reduce(function(sum, bucket) { return sum + bucket.count; }, 0) || 1;
      var centerX = W / 2;
      var centerY = H / 2 + 4;
      var radius = Math.max(36, Math.min(W, H) / 2 - 18);
      var startAngle = -Math.PI / 2;

      bkts.forEach(function(bucket) {
        var angle = (bucket.count / total) * Math.PI * 2;
        var endAngle = startAngle + angle;
        var isActive = ratingSelect.value === bucket.min + '-' + bucket.max;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = rc(bucket.min);
        ctx.globalAlpha = isActive ? 1 : 0.92;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = isActive ? 3 : 1;
        ctx.strokeStyle = isActive ? textColor : 'rgba(255,255,255,0.16)';
        ctx.stroke();

        var midAngle = startAngle + angle / 2;
        var pct = Math.round((bucket.count / total) * 100);
        if (pct >= 8) {
          var labelRadius = radius * 0.64;
          ctx.fillStyle = textColor;
          ctx.font = '600 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            pct + '%',
            centerX + Math.cos(midAngle) * labelRadius,
            centerY + Math.sin(midAngle) * labelRadius
          );
        }

        startAngle = endAngle;
      });

      ctx.fillStyle = textColor;
      ctx.font = '600 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Total ' + total, centerX, centerY - 8);

      ctx.fillStyle = mutedColor;
      ctx.font = '11px sans-serif';
      ctx.fillText('solved buckets', centerX, centerY + 10);
    }

    function drawRatingChart() {
      var chart = prepareChartCanvas();
      if (!chart) {
        return;
      }

      if (currentChartView === 'pie') {
        drawRatingPieChart(chart);
        return;
      }

      drawRatingBarChart(chart);
    }

    function setChartView(view) {
      currentChartView = view;
      document.querySelectorAll('[data-chart-view]').forEach(function(button) {
        button.classList.toggle('active', button.getAttribute('data-chart-view') === view);
      });
      drawRatingChart();
    }

    drawRatingChart();
    window.addEventListener('resize', drawRatingChart);

    // Chart click handler
    document.getElementById('ratingChart').addEventListener('click', function(e) {
      var bkts = getVisibleRatingBuckets();
      if (bkts.length === 0) return;
      var rect = this.getBoundingClientRect();
      if (currentChartView === 'pie') {
        var centerX = rect.width / 2;
        var centerY = rect.height / 2 + 4;
        var dx = e.clientX - rect.left - centerX;
        var dy = e.clientY - rect.top - centerY;
        var distance = Math.sqrt(dx * dx + dy * dy);
        var radius = Math.max(36, Math.min(rect.width, rect.height) / 2 - 18);
        if (distance > radius) {
          return;
        }

        var total = bkts.reduce(function(sum, bucket) { return sum + bucket.count; }, 0) || 1;
        var angle = Math.atan2(dy, dx) + Math.PI / 2;
        if (angle < 0) {
          angle += Math.PI * 2;
        }

        var cumulative = 0;
        for (var j = 0; j < bkts.length; j++) {
          cumulative += (bkts[j].count / total) * Math.PI * 2;
          if (angle <= cumulative) {
            toggleRatingFilter(bkts[j].min + '-' + bkts[j].max);
            return;
          }
        }
        return;
      }

      var clickX = e.clientX - rect.left;
      var W = rect.width;
      var pad = { left: 10, right: 10 };
      var chartW = W - pad.left - pad.right;
      var barW = Math.min(chartW / bkts.length - 6, 48);
      var gap = (chartW - barW * bkts.length) / (bkts.length + 1);

      for (var i = 0; i < bkts.length; i++) {
        var x = pad.left + gap + i * (barW + gap);
        if (clickX >= x && clickX <= x + barW) {
          toggleRatingFilter(bkts[i].min + '-' + bkts[i].max);
          return;
        }
      }
    });

    // ---- Interactive filter functions ----
    function toggleRatingFilter(rangeStr) {
      var sel = document.getElementById('ratingFilter');
      if (sel.value === rangeStr) {
        sel.value = '';
      } else {
        sel.value = rangeStr;
      }
      visibleCount = PAGE_SIZE;
      updateActiveStates();
      render();
    }

    function toggleTagFilter(tag) {
      var sel = document.getElementById('tagFilter');
      if (sel.value === tag) {
        sel.value = '';
      } else {
        sel.value = tag;
      }
      visibleCount = PAGE_SIZE;
      updateActiveStates();
      render();
    }

    function updateActiveStates() {
      var ratingVal = document.getElementById('ratingFilter').value;
      document.querySelectorAll('.bucket').forEach(function(el) {
        el.classList.toggle('bucket-active', el.getAttribute('data-range') === ratingVal);
      });
      var tagVal = document.getElementById('tagFilter').value;
      document.querySelectorAll('.tag-bar-row').forEach(function(el) {
        el.classList.toggle('active', el.getAttribute('data-tag') === tagVal);
      });
      drawRatingChart();
    }

    // ---- View toggle ----
    function setView(view) {
      currentView = view;
      document.querySelectorAll('.vt-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-view') === view);
      });
      render();
    }

    // ---- Filtering + sorting + rendering ----
    function getFiltered() {
      var search = document.getElementById('searchInput').value.toLowerCase();
      var ratingVal = ratingSelect.value;
      var tagVal = tagSelect.value;

      var rMin = null, rMax = null;
      if (ratingVal) {
        var parts = ratingVal.split('-');
        rMin = parseInt(parts[0]);
        rMax = parseInt(parts[1]);
      }

      return allProblems.filter(function(p) {
        if (search) {
          var id = ('' + p.contestId + p.index).toLowerCase();
          if (!id.includes(search) && !p.name.toLowerCase().includes(search)) return false;
        }
        if (rMin !== null) {
          if (!p.rating || p.rating < rMin || p.rating >= rMax) return false;
        }
        if (tagVal) {
          if (!p.tags || !p.tags.includes(tagVal)) return false;
        }
        return true;
      });
    }

    function sortProblems(list) {
      var f = currentSort.field;
      var d = currentSort.dir === 'asc' ? 1 : -1;
      return list.slice().sort(function(a, b) {
        var cmp = 0;
        if (f === 'id') {
          cmp = a.contestId - b.contestId || a.index.localeCompare(b.index);
        } else if (f === 'name') {
          cmp = a.name.localeCompare(b.name);
        } else if (f === 'rating') {
          cmp = (a.rating || 0) - (b.rating || 0);
        }
        return cmp * d;
      });
    }

    function render() {
      var filtered = sortProblems(getFiltered());
      var showing = filtered.slice(0, visibleCount);

      document.getElementById('filterCount').textContent =
        filtered.length === allProblems.length
          ? filtered.length + ' problems'
          : filtered.length + ' of ' + allProblems.length;

      var tableWrapper = document.getElementById('tableWrapper');
      var gridContainer = document.getElementById('gridContainer');
      var tbody = document.getElementById('tbody');

      if (currentView === 'table') {
        tableWrapper.style.display = '';
        gridContainer.style.display = 'none';

        if (filtered.length === 0) {
          tbody.innerHTML = buildEmptyState(5);
        } else {
          tbody.innerHTML = showing.map(function(p) {
            var id = p.contestId + '' + p.index;
            var tagsHtml = (p.tags || []).map(function(t) {
              return '<span class="tag tag-clickable" data-tag-filter="' + esc(t) + '">' + esc(t) + '</span>';
            }).join('');
            return '<tr>' +
              '<td><a href="#" data-preview-problem data-contest-id="' + p.contestId + '" data-problem-index="' + esc(p.index) + '" data-problem-name="' + esc(p.name) + '">' + esc(id) + '</a></td>' +
              '<td><a href="#" data-preview-problem data-contest-id="' + p.contestId + '" data-problem-index="' + esc(p.index) + '" data-problem-name="' + esc(p.name) + '">' + esc(p.name) + '</a></td>' +
              '<td class="rating-cell" style="color:' + rc(p.rating) + '">' + (p.rating || '-') + '</td>' +
              '<td>' + tagsHtml + '</td>' +
              '<td class="action-cell"><span class="action-link" data-open-web data-contest-id="' + p.contestId + '" data-problem-index="' + esc(p.index) + '">Open</span></td>' +
              '</tr>';
          }).join('');
        }
      } else {
        tableWrapper.style.display = 'none';
        gridContainer.style.display = '';

        if (filtered.length === 0) {
          gridContainer.innerHTML = '<div style="grid-column:1/-1;">' + buildEmptyStateDiv() + '</div>';
        } else {
          gridContainer.innerHTML = showing.map(function(p) {
            var id = p.contestId + '' + p.index;
            var tagsHtml = (p.tags || []).map(function(t) {
              return '<span class="tag tag-clickable" data-tag-filter="' + esc(t) + '">' + esc(t) + '</span>';
            }).join('');
            return '<div class="problem-card" data-preview-problem data-contest-id="' + p.contestId + '" data-problem-index="' + esc(p.index) + '" data-problem-name="' + esc(p.name) + '">' +
              '<div class="problem-card-header">' +
              '<span class="problem-card-id">' + esc(id) + '</span>' +
              '<span class="problem-card-rating" style="color:' + rc(p.rating) + '">' + (p.rating || '-') + '</span>' +
              '</div>' +
              '<div class="problem-card-name" title="' + esc(p.name) + '">' + esc(p.name) + '</div>' +
              '<div class="problem-card-tags">' + tagsHtml + '</div>' +
              '</div>';
          }).join('');
        }
      }

      // Load more button
      var container = document.getElementById('loadMoreContainer');
      if (filtered.length > visibleCount) {
        var remaining = filtered.length - visibleCount;
        container.innerHTML = '<div class="load-more-row"><button class="load-more-btn" id="loadMoreBtn">Load More (' + remaining + ' remaining)</button></div>';
      } else {
        container.innerHTML = '';
      }

      // Update sort arrows
      ['id', 'name', 'rating'].forEach(function(f) {
        var el = document.getElementById('sort-' + f);
        if (f === currentSort.field) {
          el.textContent = currentSort.dir === 'asc' ? '\\u25B2' : '\\u25BC';
        } else {
          el.textContent = '';
        }
      });

      wireRenderedInteractions();
    }

    function buildEmptyState(colspan) {
      var content = buildEmptyStateContent();
      return '<tr><td colspan="' + colspan + '" class="empty-state-cell">' + content + '</td></tr>';
    }

    function buildEmptyStateDiv() {
      return '<div class="empty-state-cell">' + buildEmptyStateContent() + '</div>';
    }

    function buildEmptyStateContent() {
      var activeFilters = [];
      var searchVal = document.getElementById('searchInput').value;
      if (searchVal) {
        activeFilters.push('search: "' + esc(searchVal) + '"');
      }
      if (ratingSelect.value) {
        activeFilters.push('rating: ' + ratingSelect.value);
      }
      if (tagSelect.value) {
        activeFilters.push('tag: ' + esc(tagSelect.value));
      }

      var filterDesc = activeFilters.length > 0
        ? '<p class="empty-filters">Active filters: ' + activeFilters.join(', ') + '</p>'
        : '';

      return '<div class="empty-icon">0 results</div>' +
        '<div class="empty-title">No problems match the current filters</div>' +
        filterDesc +
        '<button class="clear-btn" id="emptyStateClearBtn">Clear All Filters</button>';
    }

    function preview(contestId, index, name) {
      vscode.postMessage({ command: 'previewProblem', contestId: contestId, index: index, name: name });
    }

    function openOnWeb(contestId, index) {
      vscode.postMessage({ command: 'openOnWeb', contestId: contestId, index: index });
    }

    function toggleSort(field) {
      if (currentSort.field === field) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.field = field;
        currentSort.dir = field === 'name' ? 'asc' : 'desc';
      }
      visibleCount = PAGE_SIZE;
      render();
    }

    function loadMore() {
      visibleCount += PAGE_SIZE;
      render();
    }

    function clearFilters() {
      document.getElementById('searchInput').value = '';
      ratingSelect.value = '';
      tagSelect.value = '';
      visibleCount = PAGE_SIZE;
      updateActiveStates();
      render();
    }

    function copyToClipboard() {
      var filtered = sortProblems(getFiltered());
      var lines = filtered.map(function(p) {
        var id = p.contestId + '' + p.index;
        var rating = p.rating || 'unrated';
        var tags = (p.tags || []).join(', ');
        return id + '\\t' + p.name + '\\t' + rating + '\\t' + tags;
      });
      var header = 'Problem\\tName\\tRating\\tTags';
      var text = header + '\\n' + lines.join('\\n');
      vscode.postMessage({ command: 'copyToClipboard', text: text, count: filtered.length });
      var btn = document.getElementById('copyBtn');
      btn.textContent = 'Copied!';
      setTimeout(function() { btn.textContent = 'Copy List'; }, 1500);
    }

    function wireStaticInteractions() {
      document.getElementById('refreshBtn').addEventListener('click', function() { post('refresh'); });
      document.getElementById('copyBtn').addEventListener('click', copyToClipboard);
      document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);

      document.querySelectorAll('.vt-btn').forEach(function(button) {
        button.addEventListener('click', function() {
          var view = button.getAttribute('data-view');
          if (view) {
            setView(view);
          }
        });
      });

      document.querySelectorAll('[data-chart-view]').forEach(function(button) {
        button.addEventListener('click', function() {
          var view = button.getAttribute('data-chart-view');
          if (view) {
            setChartView(view);
          }
        });
      });

      document.querySelectorAll('th[data-sort-field]').forEach(function(header) {
        header.addEventListener('click', function() {
          toggleSort(header.getAttribute('data-sort-field'));
        });
      });

      document.getElementById('bucketRow').addEventListener('click', function(event) {
        var bucket = event.target.closest('.bucket');
        if (!bucket) {
          return;
        }
        toggleRatingFilter(bucket.getAttribute('data-range'));
      });

      document.getElementById('tagsBars').addEventListener('click', function(event) {
        var row = event.target.closest('.tag-bar-row');
        if (!row) {
          return;
        }
        toggleTagFilter(row.getAttribute('data-tag'));
      });
    }

    function wireRenderedInteractions() {
      document.querySelectorAll('[data-preview-problem]').forEach(function(element) {
        element.addEventListener('click', function(event) {
          event.preventDefault();
          preview(
            Number(element.getAttribute('data-contest-id')),
            element.getAttribute('data-problem-index'),
            element.getAttribute('data-problem-name')
          );
        });
      });

      document.querySelectorAll('[data-open-web]').forEach(function(element) {
        element.addEventListener('click', function(event) {
          event.preventDefault();
          event.stopPropagation();
          openOnWeb(
            Number(element.getAttribute('data-contest-id')),
            element.getAttribute('data-problem-index')
          );
        });
      });

      document.querySelectorAll('[data-tag-filter]').forEach(function(element) {
        element.addEventListener('click', function(event) {
          event.preventDefault();
          event.stopPropagation();
          toggleTagFilter(element.getAttribute('data-tag-filter'));
        });
      });

      var loadMoreButton = document.getElementById('loadMoreBtn');
      if (loadMoreButton) {
        loadMoreButton.addEventListener('click', loadMore);
      }

      var emptyStateClearButton = document.getElementById('emptyStateClearBtn');
      if (emptyStateClearButton) {
        emptyStateClearButton.addEventListener('click', clearFilters);
      }
    }

    // ---- Event listeners ----
    document.getElementById('searchInput').addEventListener('input', function() { visibleCount = PAGE_SIZE; render(); });
    ratingSelect.addEventListener('change', function() { visibleCount = PAGE_SIZE; updateActiveStates(); render(); });
    tagSelect.addEventListener('change', function() { visibleCount = PAGE_SIZE; updateActiveStates(); render(); });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        var searchInput = document.getElementById('searchInput');
        searchInput.focus();
        searchInput.select();
      }
      if (e.key === 'Escape') {
        var searchEl = document.getElementById('searchInput');
        if (document.activeElement === searchEl && searchEl.value) {
          searchEl.value = '';
          visibleCount = PAGE_SIZE;
          updateActiveStates();
          render();
        } else {
          clearFilters();
          if (document.activeElement) { document.activeElement.blur(); }
        }
      }
    });

    wireStaticInteractions();
    render();
  </script>
</body>
</html>`;
  }
}

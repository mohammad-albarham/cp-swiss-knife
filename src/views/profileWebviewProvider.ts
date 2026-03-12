import * as vscode from 'vscode';
import { codeforcesApi } from '../api';
import { RatingChange, User, getRatingColor } from '../api/types';
import { UserAnalyticsSnapshot } from '../models/userAnalytics';
import { getAuthService } from '../services/authService';
import { getStorageService } from '../services/storageService';
import { getUserStatsService } from '../services/userStatsService';
import { getNonce, getCspMeta, getThemeStyles, escapeHtml } from './webviewUtils';
import { getProblemsExplorer } from './problemsExplorer';
import { ProfileSummaryPanel } from './profileSummaryPanel';



export class ProfileWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codeforcesUserDashboard';

  private view: vscode.WebviewView | undefined;
  private extensionUri: vscode.Uri;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.extensionUri = context.extensionUri;
    this.context = context;

    const authService = getAuthService();
    authService.onDidChangeSession(() => this.refresh());
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resolveWebviewView(webviewView: vscode.WebviewView, _ctx: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void {
    console.log('Codeforces extension: Resolving Profile Webview');
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.onDidReceiveMessage(async message => {
      switch (message.command) {
        case 'refresh':
          await this.loadAndRender(true);
          break;
        case 'openOnWeb': {
          const handle = message.handle;
          if (handle) {
            await vscode.env.openExternal(
              vscode.Uri.parse(`https://codeforces.com/profile/${encodeURIComponent(handle)}`)
            );
          }
          break;
        }
        case 'showProfile':
          await vscode.commands.executeCommand('codeforces.showProfile');
          break;
        case 'showRatingGraph':
          await vscode.commands.executeCommand('codeforces.showRatingGraph');
          break;
        case 'showSolvedProblems':
          await vscode.commands.executeCommand('codeforces.showSolvedProblems');
          break;
        case 'previewProblem':
          await vscode.commands.executeCommand(
            'codeforces.previewProblem',
            message.contestId,
            message.index,
            message.name
          );
          break;
        case 'login':
          await vscode.commands.executeCommand('codeforces.login');
          break;
      }
    });

    void this.loadAndRender(false);
  }

  refresh(): void {
    void this.loadAndRender(false);
  }

  async refreshForced(): Promise<void> {
    await this.loadAndRender(true);
  }

  async showRatingGraph(): Promise<void> {
    const authService = getAuthService();
    const user = authService.getCurrentUser();
    
    if (!user) {
      vscode.window.showInformationMessage('No rating history available - Please login first.');
      return;
    }

    try {
      const ratingHistory = await codeforcesApi.getUserRating(user.handle);
      if (ratingHistory.length === 0) {
        vscode.window.showInformationMessage('No rating history available for this user.');
        return;
      }
      
      // The full graph is displayed inside the main Profile Summary Panel. 
      // Open that panel directly when the user requests the "Full Graph"
      await ProfileSummaryPanel.show(this.context);
    } catch (error) {
      vscode.window.showErrorMessage('Failed to load rating history');
      console.error(error);
    }
  }

  private async loadAndRender(forceRefresh: boolean): Promise<void> {
    if (!this.view) { return; }

    const authService = getAuthService();
    const user = authService.getCurrentUser();

    if (!user) {
      this.view.webview.html = this.getLoginHtml(this.view.webview);
      return;
    }

    this.view.webview.html = this.getLoadingHtml(this.view.webview);

    try {
      const [ratingHistory, analytics] = await Promise.all([
        codeforcesApi.getUserRating(user.handle),
        getUserStatsService().getSnapshot(user.handle, forceRefresh)
      ]);

      // Sync solved problems so other views stay consistent
      if (analytics.solvedProblems.length > 0) {
        const storage = getStorageService();
        await storage.syncSolvedProblemsFromApi(analytics.solvedProblems);
        try {
          getProblemsExplorer().refreshView();
        } catch { /* problems explorer may not be initialized */ }
      }

      this.view.webview.html = ProfileWebviewProvider.getHtml(
        this.view.webview, user, ratingHistory, analytics
      );
    } catch (error) {
      console.error('Codeforces extension: Failed to render profile HTML:', error);
      const msg = error instanceof Error ? error.message : String(error);
      this.view.webview.html = this.getErrorHtml(this.view.webview, `Profile Render Error: ${msg}`);
    }
  }

  private getLoginHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${getCspMeta(webview, nonce)}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${this.getSidebarStyles()}</style>
</head>
<body>
  <div class="sidebar">
    <div class="login-prompt">
      <div class="login-icon">👤</div>
      <h3>Welcome to CP Swiss Knife</h3>
      <p class="muted">Login to view your profile, stats, and track progress.</p>
      <button class="btn-primary" data-cmd="login">Login to Codeforces</button>
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function post(cmd, extra) { vscode.postMessage(Object.assign({ command: cmd }, extra || {})); }
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-cmd]');
      if (btn) post(btn.getAttribute('data-cmd'));
    });
  </script>
</body>
</html>`;
  }

  private getLoadingHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${getCspMeta(webview, nonce)}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${this.getSidebarStyles()}</style>
</head>
<body>
  <div class="sidebar">
    <div class="loading">
      <p class="muted">Loading profile...</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getErrorHtml(webview: vscode.Webview, message: string): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${getCspMeta(webview, nonce)}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${this.getSidebarStyles()}</style>
</head>
<body>
  <div class="sidebar">
    <div class="error-state">
      <p style="color:var(--bad);">${escapeHtml(message)}</p>
      <button class="btn-secondary" data-cmd="refresh">Retry</button>
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function post(cmd, extra) { vscode.postMessage(Object.assign({ command: cmd }, extra || {})); }
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-cmd]');
      if (btn) post(btn.getAttribute('data-cmd'));
    });
  </script>
</body>
</html>`;
  }

  static getHtml(
    webview: vscode.Webview,
    user: User,
    ratingHistory: RatingChange[],
    analytics: UserAnalyticsSnapshot
  ): string {
    const nonce = getNonce();
    try {
      const rankColor = getRatingColor(user.rating);

      // Build solve-day set for heatmap (last 90 days)
      const solveDays: Record<string, number> = {};
      for (const sub of analytics.recentSubmissions) {
        if (sub.verdict === 'OK') {
          const d = new Date(sub.creationTimeSeconds * 1000);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          solveDays[key] = (solveDays[key] || 0) + 1;
        }
      }

      const data = {
        handle: user.handle,
        rating: user.rating,
        maxRating: user.maxRating,
        rank: user.rank,
        maxRank: user.maxRank,
        rankColor,
        contribution: user.contribution,
        friendOfCount: user.friendOfCount || 0,
        registrationStr: user.registrationTimeSeconds ? ProfileWebviewProvider.formatAbsoluteDate(user.registrationTimeSeconds) : 'Unknown',
        lastOnlineStr: user.lastOnlineTimeSeconds ? ProfileWebviewProvider.formatRelativeTime(user.lastOnlineTimeSeconds * 1000) : 'Unknown',
        organization: user.organization || 'Not set',
        country: user.country || 'Not set',
        solvedCount: analytics.solvedProblemCount,
        attemptedUnsolvedCount: analytics.attemptedUnsolvedCount,
        acceptedSubmissionCount: analytics.acceptedSubmissionCount,
        analyzedSubmissionCount: analytics.analyzedSubmissionCount,
        isPartial: analytics.isPartial,
        mostDifficultSolved: analytics.mostDifficultSolved,
        acceptanceRate: analytics.acceptanceRate,
        currentStreak: analytics.currentStreak,
        longestStreak: analytics.longestStreak,
        contestCount: ratingHistory.length,
        ratingHistory: ratingHistory.map(r => ({
          contestName: r.contestName,
          oldRating: r.oldRating,
          newRating: r.newRating,
          rank: r.rank,
          time: r.ratingUpdateTimeSeconds
        })),
        recentSubmissions: analytics.recentSubmissions.slice(0, 8).map(s => ({
          contestId: s.problem.contestId,
          index: s.problem.index,
          name: s.problem.name,
          verdict: s.verdict || 'TESTING',
          lang: s.programmingLanguage,
          time: s.creationTimeSeconds
        })),
        solveDays,
        ratingBuckets: analytics.ratingBuckets,
        topTags: analytics.topTags
      };

      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${getCspMeta(webview, nonce)}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${getSidebarStylesStatic()}</style>
</head>
<body>
  <div class="sidebar">
    <!-- Hero -->
    <div class="hero">
      <div class="avatar" id="avatar"></div>
      <div class="hero-info">
        <div class="hero-handle" id="heroHandle"></div>
        <div class="hero-rank" id="heroRank"></div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid" id="statsGrid"></div>

    <!-- Rating Sparkline -->
    <div class="section">
      <div class="section-header">
        <span class="section-title">Rating History</span>
        <span class="section-action" data-cmd="showRatingGraph">Full Graph →</span>
      </div>
      <canvas id="sparkline" height="60"></canvas>
    </div>

    <!-- Acceptance Donut + Streak -->
    <div class="row-2col">
      <div class="mini-card">
        <div class="section-title">Acceptance</div>
        <svg id="donut" viewBox="0 0 80 80" width="80" height="80"></svg>
        <div class="donut-label" id="donutLabel"></div>
      </div>
      <div class="mini-card">
        <div class="section-title">Streaks</div>
        <div class="streak-row"><span class="streak-icon">🔥</span><span class="streak-val" id="curStreak"></span><span class="muted">current</span></div>
        <div class="streak-row"><span class="streak-icon">🏆</span><span class="streak-val" id="maxStreak"></span><span class="muted">longest</span></div>
      </div>
    </div>

    <!-- Solve Heatmap -->
    <div class="section">
      <div class="section-header">
        <span class="section-title">Activity (90 days)</span>
        <span class="section-action" data-cmd="showSolvedProblems">All Solved →</span>
      </div>
      <canvas id="heatmap" height="80"></canvas>
    </div>

    <!-- Details Collapsibles -->
    <details class="profile-details">
      <summary>Profile Details</summary>
      <div class="details-content" id="profileDetailsContent"></div>
    </details>

    <details class="profile-details">
      <summary>Performance Snapshot</summary>
      <div class="details-content" id="performanceSnapshotContent"></div>
    </details>

    <details class="profile-details">
      <summary>Problems by Rating</summary>
      <div class="details-content" id="problemsByRatingContent"></div>
    </details>

    <details id="allTagsDetails" class="profile-details">
      <summary>All Tags</summary>
      <div class="details-content" id="allTagsContent"></div>
    </details>

    <!-- Top Tags -->
    <div class="section" id="tagsSection">
      <div class="section-title">Top Tags</div>
      <div id="tagBars"></div>
    </div>

    <!-- Recent Submissions -->
    <div class="section">
      <div class="section-header">
        <span class="section-title">Recent Submissions</span>
        <span class="section-action" data-cmd="showProfile">Full Profile →</span>
      </div>
      <div id="recentList"></div>
    </div>

    <!-- Actions -->
    <div class="actions-row">
      <button class="btn-secondary" data-cmd="refresh">↻ Refresh</button>
      <button class="btn-secondary" data-cmd="openOnWeb" data-handle="\${D.handle}">↗ Web</button>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function post(cmd, extra) { vscode.postMessage(Object.assign({ command: cmd }, extra || {})); }
    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    const D = ${JSON.stringify(data)};

    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-cmd]');
      if (btn) {
        const cmd = btn.getAttribute('data-cmd');
        const handle = btn.getAttribute('data-handle');
        if (handle) post(cmd, { handle: handle });
        else post(cmd);
      }
    });

    /* ── Rating color ── */
    function rc(r) {
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

    /* ── Hero ── */
    var avatar = document.getElementById('avatar');
    avatar.textContent = D.handle.substring(0, 2).toUpperCase();
    avatar.style.backgroundColor = D.rankColor;

    var heroHandle = document.getElementById('heroHandle');
    heroHandle.textContent = D.handle;
    heroHandle.style.color = D.rankColor;

    var heroRank = document.getElementById('heroRank');
    heroRank.innerHTML = '<span class="rank-pill" style="background:' + D.rankColor + '">' + esc(D.rank || 'Unrated') + '</span>'
      + ' <span class="rating-num">' + D.rating + '</span>';

    /* ── Stats Grid ── */
    var stats = [
      { v: D.rating, l: 'Rating', c: D.rankColor },
      { v: D.maxRating, l: 'Max Rating', c: rc(D.maxRating) },
      { v: D.solvedCount, l: 'Solved', c: null },
      { v: D.contestCount, l: 'Contests', c: null },
      { v: (D.acceptanceRate * 100).toFixed(1) + '%', l: 'Accept Rate', c: null },
      { v: D.contribution >= 0 ? '+' + D.contribution : '' + D.contribution, l: 'Contribution', c: D.contribution > 0 ? 'var(--ok)' : D.contribution < 0 ? 'var(--bad)' : null }
    ];
    var grid = document.getElementById('statsGrid');
    stats.forEach(function(s) {
      var el = document.createElement('div');
      el.className = 'stat-cell';
      el.innerHTML = '<div class="stat-val"' + (s.c ? ' style="color:' + s.c + '"' : '') + '>' + esc(String(s.v)) + '</div>'
        + '<div class="stat-lbl">' + esc(s.l) + '</div>';
      grid.appendChild(el);
    });

    /* ── Sparkline ── */
    (function drawSparkline() {
      var canvas = document.getElementById('sparkline');
      var history = D.ratingHistory;
      if (history.length < 2) {
        canvas.style.display = 'none';
        return;
      }
      var dpr = window.devicePixelRatio || 1;
      var rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      var W = rect.width, H = rect.height;
      var pad = { top: 6, bottom: 6, left: 2, right: 2 };
      var cw = W - pad.left - pad.right;
      var ch = H - pad.top - pad.bottom;
      var ratings = history.map(function(h) { return h.newRating; });
      var minR = Math.min.apply(null, ratings) - 50;
      var maxR = Math.max.apply(null, ratings) + 50;

      function x(i) { return pad.left + (i / (history.length - 1)) * cw; }
      function y(r) { return pad.top + (1 - (r - minR) / (maxR - minR || 1)) * ch; }

      // Gradient fill
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, D.rankColor + '30');
      grad.addColorStop(1, D.rankColor + '05');
      ctx.beginPath();
      ctx.moveTo(x(0), H);
      history.forEach(function(h, i) { ctx.lineTo(x(i), y(h.newRating)); });
      ctx.lineTo(x(history.length - 1), H);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.strokeStyle = D.rankColor;
      ctx.lineWidth = 1.5;
      history.forEach(function(h, i) {
        i === 0 ? ctx.moveTo(x(i), y(h.newRating)) : ctx.lineTo(x(i), y(h.newRating));
      });
      ctx.stroke();

      // Current rating dot
      var last = history[history.length - 1];
      ctx.beginPath();
      ctx.arc(x(history.length - 1), y(last.newRating), 3, 0, Math.PI * 2);
      ctx.fillStyle = D.rankColor;
      ctx.fill();
    })();

    /* ── Donut ── */
    (function drawDonut() {
      var svg = document.getElementById('donut');
      var pct = D.acceptanceRate;
      var r = 32, cx = 40, cy = 40, stroke = 7;
      var circumference = 2 * Math.PI * r;
      var filled = circumference * pct;
      var empty = circumference - filled;

      svg.innerHTML =
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(128,128,128,0.15)" stroke-width="' + stroke + '"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--ok)" stroke-width="' + stroke + '"' +
        ' stroke-dasharray="' + filled + ' ' + empty + '"' +
        ' stroke-dashoffset="' + (circumference / 4) + '"' +
        ' stroke-linecap="round" style="transition: stroke-dasharray 0.6s ease"/>';

      document.getElementById('donutLabel').textContent = (pct * 100).toFixed(1) + '%';
    })();

    /* ── Streaks ── */
    document.getElementById('curStreak').textContent = D.currentStreak + 'd';
    document.getElementById('maxStreak').textContent = D.longestStreak + 'd';

    /* ── Heatmap ── */
    (function drawHeatmap() {
      var canvas = document.getElementById('heatmap');
      var dpr = window.devicePixelRatio || 1;
      var rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      var W = rect.width, H = rect.height;

      var totalDays = 90;
      var cols = Math.ceil(totalDays / 7);
      var cellSize = Math.min(Math.floor((W - 4) / cols) - 1, Math.floor((H - 4) / 7) - 1, 10);
      var gap = 2;

      var today = new Date();
      today.setHours(0, 0, 0, 0);

      // Build array of days going back
      var days = [];
      for (var i = totalDays - 1; i >= 0; i--) {
        var d = new Date(today);
        d.setDate(d.getDate() - i);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        days.push({ date: d, count: D.solveDays[key] || 0, dayOfWeek: d.getDay() });
      }

      // Find max for color scale
      var maxCount = 1;
      days.forEach(function(d) { if (d.count > maxCount) maxCount = d.count; });

      var startX = 2;
      var startY = 2;
      var col = 0;

      // Pad first week
      if (days.length > 0) {
        var firstDow = days[0].dayOfWeek;
        col = 0;
        var row = firstDow;
        for (var di2 = 0; di2 < days.length; di2++) {
          var day2 = days[di2];
          var x = startX + col * (cellSize + gap);
          var y = startY + row * (cellSize + gap);

          var intensity = day2.count === 0 ? 0 : Math.min(day2.count / maxCount, 1);
          if (intensity === 0) {
            ctx.fillStyle = 'rgba(128,128,128,0.1)';
          } else {
            var alpha = 0.3 + intensity * 0.7;
            ctx.fillStyle = 'rgba(47, 143, 78, ' + alpha + ')';
          }
          ctx.beginPath();
          ctx.roundRect(x, y, cellSize, cellSize, 2);
          ctx.fill();

          row++;
          if (row >= 7) {
            row = 0;
            col++;
          }
        }
      }
    })();

    /* ── Details Sections ── */
    var dRow = function(l, v) { return '<div class="detail-row"><span class="detail-label">' + esc(l) + '</span><span class="detail-value">' + esc(String(v)) + '</span></div>'; };
    
    document.getElementById('profileDetailsContent').innerHTML = 
      dRow('Max Rating', D.maxRating + ' • ' + D.maxRank) +
      dRow('Contests', D.contestCount + ' rated entries') +
      dRow('Contribution', D.contribution) +
      dRow('Friend Of', D.friendOfCount) +
      dRow('Registered', D.registrationStr) +
      dRow('Last Online', D.lastOnlineStr) +
      dRow('Organization', D.organization) +
      dRow('Country', D.country);

    document.getElementById('performanceSnapshotContent').innerHTML = 
      dRow('Attempted Unsolved', D.attemptedUnsolvedCount) +
      dRow('Accepted Submissions', D.acceptedSubmissionCount + '/' + D.analyzedSubmissionCount) +
      dRow('Snapshot Coverage', D.isPartial ? ('Latest ' + D.analyzedSubmissionCount + ' submissions') : (D.analyzedSubmissionCount + ' submissions analyzed')) +
      (D.mostDifficultSolved ? dRow('Hardest Solved', D.mostDifficultSolved.contestId + D.mostDifficultSolved.index + ' • ' + esc(D.mostDifficultSolved.name) + (D.mostDifficultSolved.rating ? ' • ' + D.mostDifficultSolved.rating : '')) : '');

    var bucketsHtml = '';
    D.ratingBuckets.forEach(function(b) {
      if (b.count > 0) bucketsHtml += dRow(b.label, b.count + ' solved');
    });
    document.getElementById('problemsByRatingContent').innerHTML = bucketsHtml || '<div class="muted">No data</div>';

    var allTagsHtml = '';
    D.topTags.forEach(function(t) {
      allTagsHtml += dRow(t.tag, t.count + ' solved');
    });
    document.getElementById('allTagsContent').innerHTML = allTagsHtml || '<div class="muted">No tags</div>';
    if (D.topTags.length === 0) document.getElementById('allTagsDetails').style.display = 'none';

    /* ── Top Tags (Graphical) ── */
    (function drawTags() {
      var container = document.getElementById('tagBars');
      if (D.topTags.length === 0) {
        document.getElementById('tagsSection').style.display = 'none';
        return;
      }
      var maxC = D.topTags[0].count;
      var html = '';
      D.topTags.slice(0, 6).forEach(function(t) {
        var pct = (t.count / maxC * 100).toFixed(1);
        html += '<div class="tag-row">'
          + '<span class="tag-name">' + esc(t.tag) + '</span>'
          + '<div class="tag-track"><div class="tag-fill" style="width:' + pct + '%"></div></div>'
          + '<span class="tag-cnt">' + t.count + '</span>'
          + '</div>';
      });
      container.innerHTML = html;
    })();

    /* ── Recent Submissions ── */
    (function drawRecent() {
      var list = document.getElementById('recentList');
      if (D.recentSubmissions.length === 0) {
        list.innerHTML = '<div class="muted" style="text-align:center;padding:12px;">No recent submissions</div>';
        return;
      }
      var html = '';
      D.recentSubmissions.forEach(function(s) {
        var icon = '❓', color = 'var(--muted)';
        switch (s.verdict) {
          case 'OK': icon = '✓'; color = 'var(--ok)'; break;
          case 'WRONG_ANSWER': icon = '✗'; color = 'var(--bad)'; break;
          case 'TIME_LIMIT_EXCEEDED': icon = '⏱'; color = 'var(--warn)'; break;
          case 'MEMORY_LIMIT_EXCEEDED': icon = '💾'; color = 'var(--warn)'; break;
          case 'RUNTIME_ERROR': icon = '⚠'; color = 'var(--bad)'; break;
          case 'COMPILATION_ERROR': icon = '⊘'; color = 'var(--bad)'; break;
          case 'TESTING': icon = '…'; color = 'var(--accent)'; break;
        }
        var ago = formatAgo(s.time);
        var encodedName = encodeURIComponent(s.name);
        html += '<div class="sub-row" data-cid="' + s.contestId + '" data-idx="' + esc(s.index) + '" data-name="' + encodedName + '">'
          + '<span class="sub-icon" style="color:' + color + '">' + icon + '</span>'
          + '<span class="sub-id">' + s.contestId + s.index + '</span>'
          + '<span class="sub-verdict" style="color:' + color + '">' + esc(formatVerdict(s.verdict)) + '</span>'
          + '<span class="sub-lang">' + esc(s.lang) + '</span>'
          + '<span class="sub-ago">' + esc(ago) + '</span>'
          + '</div>';
      });
      list.innerHTML = html;
      // Event delegation for submission row clicks
      list.addEventListener('click', function(e) {
        var row = e.target.closest('.sub-row');
        if (!row) return;
        var cid = row.getAttribute('data-cid');
        var idx = row.getAttribute('data-idx');
        var name = decodeURIComponent(row.getAttribute('data-name') || '');
        if (cid && idx) {
          post('previewProblem', { contestId: Number(cid), index: idx, name: name });
        }
      });
    })();

    function formatVerdict(v) {
      switch (v) {
        case 'OK': return 'AC';
        case 'WRONG_ANSWER': return 'WA';
        case 'TIME_LIMIT_EXCEEDED': return 'TLE';
        case 'MEMORY_LIMIT_EXCEEDED': return 'MLE';
        case 'RUNTIME_ERROR': return 'RTE';
        case 'COMPILATION_ERROR': return 'CE';
        case 'TESTING': return '...';
        default: return v;
      }
    }

    function formatAgo(ts) {
      var diff = Math.floor((Date.now() / 1000) - ts);
      if (diff < 60) return 'now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h';
      var days = Math.floor(diff / 86400);
      if (days < 30) return days + 'd';
      return Math.floor(days / 30) + 'mo';
    }
  </script>
</body>
</html>`;
    } catch (error) {
       console.error('Codeforces extension: getHtml parsing error:', error);
       const msg = error instanceof Error ? error.message : String(error);
       return `<!DOCTYPE html>
       <html lang="en">
       <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
       <body style="padding: 20px; color: var(--vscode-errorForeground);">
          <h3>Error Rendering Profile Webview</h3>
          <p>${escapeHtml(msg)}</p>
       </body>
       </html>`;
    }
  }

  private getSidebarStyles(): string {
    return getSidebarStylesStatic();
  }

  private static formatAbsoluteDate(timestampSeconds: number): string {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(timestampSeconds * 1000));
  }

  private static formatRelativeTime(timestampMs: number): string {
    const diffMs = Date.now() - timestampMs;
    if (diffMs < 60_000) { return 'Just now'; }
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 60) { return `${minutes}m ago`; }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) { return `${hours}h ago`; }
    const days = Math.floor(hours / 24);
    if (days < 30) { return `${days}d ago`; }
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(timestampMs));
  }
}

function getSidebarStylesStatic(): string {
  return `
    ${getThemeStyles()}
    .sidebar { padding: 12px; }
    .muted { color: var(--muted); font-size: 12px; }

    /* Hero */
    .hero {
      display: flex; align-items: center; gap: 12px;
      padding: 14px; margin-bottom: 12px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--panel) 90%, transparent);
      border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
    }
    .avatar {
      width: 42px; height: 42px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 700; color: #fff;
      flex-shrink: 0; text-transform: uppercase;
    }
    .hero-info { flex: 1; min-width: 0; }
    .hero-handle { font-size: 16px; font-weight: 700; line-height: 1.2; }
    .hero-rank { margin-top: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .rank-pill {
      display: inline-block; padding: 2px 8px; border-radius: 999px;
      font-size: 10px; font-weight: 700; color: #fff;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .rating-num { font: 600 13px/1 var(--mono); color: var(--muted); }

    /* Stats Grid */
    .stats-grid {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 6px; margin-bottom: 12px;
    }
    .stat-cell {
      text-align: center; padding: 8px 4px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--panel) 80%, transparent);
      border: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
    }
    .stat-val { font: 700 16px/1.2 var(--mono); }
    .stat-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-top: 2px; }

    /* Sections */
    .section { margin-bottom: 12px; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .section-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
    .section-action { font-size: 10px; color: var(--accent); cursor: pointer; }
    .section-action:hover { text-decoration: underline; }

    /* Sparkline */
    #sparkline { width: 100%; border-radius: 8px; background: color-mix(in srgb, var(--panel) 80%, transparent); display: block; }

    /* Donut + Streaks Row */
    .row-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    .mini-card {
      padding: 10px; border-radius: 10px;
      background: color-mix(in srgb, var(--panel) 80%, transparent);
      border: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
      text-align: center;
    }
    .donut-label { font: 700 18px/1 var(--mono); margin-top: 4px; }
    #donut { display: block; margin: 6px auto 0; }
    .streak-row { display: flex; align-items: center; gap: 6px; justify-content: center; margin-top: 8px; font-size: 12px; }
    .streak-icon { font-size: 14px; }
    .streak-val { font: 700 16px/1 var(--mono); }

    /* Heatmap */
    #heatmap { width: 100%; border-radius: 8px; background: color-mix(in srgb, var(--panel) 80%, transparent); display: block; }

    /* Tags */
    .tag-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 11px; }
    .tag-name { width: 90px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
    .tag-track { flex: 1; height: 6px; background: color-mix(in srgb, var(--border) 25%, transparent); border-radius: 3px; overflow: hidden; }
    .tag-fill { height: 100%; border-radius: 3px; background: var(--accent); transition: width 0.3s ease; }
    .tag-cnt { width: 24px; text-align: right; font: 600 10px/1 var(--mono); color: var(--muted); flex-shrink: 0; }

    /* Recent Submissions */
    .sub-row {
      display: flex; align-items: center; gap: 6px; padding: 5px 6px;
      border-radius: 6px; cursor: pointer; font-size: 11px;
      transition: background 100ms ease;
    }
    .sub-row:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); }
    .sub-icon { font-size: 12px; width: 14px; text-align: center; flex-shrink: 0; }
    .sub-id { font: 600 11px/1 var(--mono); color: var(--accent); min-width: 48px; }
    .sub-verdict { font: 700 10px/1 var(--mono); min-width: 28px; }
    .sub-lang { color: var(--muted); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sub-ago { color: var(--muted); font-size: 10px; flex-shrink: 0; }

    /* Actions */
    .actions-row { display: flex; gap: 6px; margin-top: 8px; }
    .btn-primary {
      flex: 1; padding: 8px; border: none; border-radius: 8px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 92%, white 10%), color-mix(in srgb, var(--accent) 76%, black 8%));
      color: white; font: 600 12px/1 var(--vscode-font-family); cursor: pointer;
      transition: transform 100ms ease;
    }
    .btn-primary:hover { transform: translateY(-1px); }
    .btn-secondary {
      flex: 1; padding: 6px; border-radius: 8px;
      border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
      background: transparent; color: var(--muted); font: 600 11px/1 var(--vscode-font-family);
      cursor: pointer; transition: color 100ms ease;
    }
    .btn-secondary:hover { color: var(--accent); border-color: var(--accent); }

    /* Expandable Details */
    details {
      margin-bottom: 8px;
      padding: 0;
      border-radius: 6px;
      overflow: hidden;
      background: color-mix(in srgb, var(--panel) 30%, transparent);
    }
    details > summary {
      cursor: pointer;
      list-style: none;
      padding: 6px 8px;
      background: color-mix(in srgb, var(--panel) 60%, transparent);
      border-radius: 4px;
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
      transition: background 100ms ease;
      color: var(--muted);
    }
    details > summary::-webkit-details-marker { display: none; }
    details > summary:hover { background: color-mix(in srgb, var(--panel) 100%, transparent); }
    details > summary::after { content: '▾'; float: right; }
    details[open] > summary::after { content: '▴'; }
    .details-content { padding: 8px; }
    .detail-row {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 4px 0; border-bottom: 1px solid color-mix(in srgb, var(--border) 20%, transparent);
      font-size: 11px;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: var(--muted); }
    .detail-value { font: 500 11px/1.2 var(--mono); text-align: right; }

    /* Login / Loading / Error */
    .login-prompt { text-align: center; padding: 40px 16px; }
    .login-prompt h3 { margin: 12px 0 6px; font-size: 15px; }
    .login-icon { font-size: 36px; opacity: 0.5; }
    .loading { text-align: center; padding: 60px 16px; }
    .error-state { text-align: center; padding: 40px 16px; }
  `;
}

let profileWebviewProviderInstance: ProfileWebviewProvider | undefined;

export function initProfileWebviewProvider(context: vscode.ExtensionContext): ProfileWebviewProvider {
  profileWebviewProviderInstance = new ProfileWebviewProvider(context);
  return profileWebviewProviderInstance;
}

export function getProfileWebviewProvider(): ProfileWebviewProvider {
  if (!profileWebviewProviderInstance) {
    throw new Error('Profile webview provider not initialized');
  }
  return profileWebviewProviderInstance;
}

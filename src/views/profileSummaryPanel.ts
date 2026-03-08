import * as vscode from 'vscode';
import { User, RatingChange, getRatingColor } from '../api/types';
import { UserAnalyticsSnapshot } from '../models/userAnalytics';
import { codeforcesApi } from '../api';
import { getAuthService } from '../services/authService';
import { getUserStatsService } from '../services/userStatsService';
import { getNonce, getCspMeta, getThemeStyles, escapeHtml } from './webviewUtils';

export class ProfileSummaryPanel {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static context: vscode.ExtensionContext | undefined;

  static async show(context: vscode.ExtensionContext): Promise<void> {
    ProfileSummaryPanel.context = context;

    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (ProfileSummaryPanel.currentPanel) {
      ProfileSummaryPanel.currentPanel.reveal(column);
      await ProfileSummaryPanel.fetchAndRender(false);
      return;
    }

    const authService = getAuthService();
    const handle = authService.getCurrentUser()?.handle ?? 'Profile';

    ProfileSummaryPanel.currentPanel = vscode.window.createWebviewPanel(
      'codeforcesProfile',
      `${handle}'s Profile`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri]
      }
    );

    ProfileSummaryPanel.currentPanel.onDidDispose(() => {
      ProfileSummaryPanel.currentPanel = undefined;
    }, null, context.subscriptions);

    ProfileSummaryPanel.currentPanel.webview.onDidReceiveMessage(async message => {
      switch (message.command) {
        case 'openOnWeb':
          await vscode.env.openExternal(
            vscode.Uri.parse(
              `https://codeforces.com/profile/${encodeURIComponent(message.handle)}`
            )
          );
          break;
        case 'openProblem':
          await vscode.env.openExternal(
            vscode.Uri.parse(
              `https://codeforces.com/problemset/problem/${encodeURIComponent(message.contestId)}/${encodeURIComponent(message.index)}`
            )
          );
          break;
        case 'refresh':
          await ProfileSummaryPanel.fetchAndRender(true);
          break;
      }
    }, undefined, context.subscriptions);

    await ProfileSummaryPanel.fetchAndRender(false);
  }

  private static async fetchAndRender(forceRefresh: boolean): Promise<void> {
    const panel = ProfileSummaryPanel.currentPanel;
    if (!panel) { return; }

    const authService = getAuthService();
    const user = authService.getCurrentUser();

    if (!user) {
      panel.webview.html = ProfileSummaryPanel.getErrorHtml(panel.webview, 'Please login first.');
      return;
    }

    panel.webview.html = ProfileSummaryPanel.getLoadingHtml(panel.webview);

    try {
      const [ratingHistory, analytics] = await Promise.all([
        codeforcesApi.getUserRating(user.handle),
        getUserStatsService().getSnapshot(user.handle, forceRefresh)
      ]);
      panel.webview.html = ProfileSummaryPanel.getHtml(panel.webview, user, ratingHistory, analytics);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      panel.webview.html = ProfileSummaryPanel.getErrorHtml(panel.webview, msg);
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
    <p style="font-size:16px;color:var(--muted);">Loading profile...</p>
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

  static getHtml(
    webview: vscode.Webview,
    user: User,
    ratingHistory: RatingChange[],
    analytics: UserAnalyticsSnapshot
  ): string {
    const nonce = getNonce();
    const rankColor = getRatingColor(user.rating);

    const data = {
      handle: user.handle,
      rating: user.rating,
      maxRating: user.maxRating,
      rank: user.rank,
      maxRank: user.maxRank,
      rankColor,
      contribution: user.contribution,
      friendOfCount: user.friendOfCount,
      registrationTimeSeconds: user.registrationTimeSeconds,
      country: user.country || null,
      city: user.city || null,
      organization: user.organization || null,
      solvedCount: analytics.solvedProblemCount,
      acceptanceRate: analytics.acceptanceRate,
      currentStreak: analytics.currentStreak,
      longestStreak: analytics.longestStreak,
      contestCount: ratingHistory.length,
      ratingBuckets: analytics.ratingBuckets,
      topTags: analytics.topTags.slice(0, 8),
      mostDifficultSolved: analytics.mostDifficultSolved
        ? {
            contestId: analytics.mostDifficultSolved.contestId,
            index: analytics.mostDifficultSolved.index,
            name: analytics.mostDifficultSolved.name,
            rating: analytics.mostDifficultSolved.rating ?? null
          }
        : null,
      ratingHistory: ratingHistory.map(r => ({
        contestId: r.contestId,
        contestName: r.contestName,
        oldRating: r.oldRating,
        newRating: r.newRating,
        rank: r.rank,
        time: r.ratingUpdateTimeSeconds
      }))
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${getCspMeta(webview, nonce)}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${getThemeStyles()}

    .hero {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 24px;
      border-radius: 16px;
      background: color-mix(in srgb, var(--panel) 92%, transparent);
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      margin-bottom: 20px;
    }
    .avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
      text-transform: uppercase;
    }
    .hero-info { flex: 1; min-width: 0; }
    .hero-handle {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      line-height: 1.2;
    }
    .hero-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 6px;
      font-size: 13px;
      color: var(--muted);
    }
    .rank-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .hero-meta .sep { opacity: 0.4; }
    .hero-actions { flex-shrink: 0; display: flex; gap: 8px; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    @media (max-width: 700px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .stat-card {
      border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
      border-radius: 12px;
      background: color-mix(in srgb, var(--panel) 86%, transparent);
      padding: 16px;
      text-align: center;
    }
    .stat-value {
      font-size: 26px;
      font-weight: 700;
      line-height: 1.2;
    }
    .stat-label {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-top: 4px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      margin: 28px 0 12px;
    }

    .chart-container {
      border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
      border-radius: 12px;
      background: color-mix(in srgb, var(--panel) 86%, transparent);
      padding: 16px;
      margin-bottom: 20px;
    }
    #ratingChart { width: 100%; height: 220px; }

    .bar-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
      font-size: 13px;
    }
    .bar-label {
      width: 70px;
      text-align: right;
      flex-shrink: 0;
      font-weight: 600;
      font-size: 12px;
    }
    .bar-track {
      flex: 1;
      height: 22px;
      background: color-mix(in srgb, var(--border) 30%, transparent);
      border-radius: 6px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 6px;
      transition: width 0.6s ease;
    }
    .bar-count {
      width: 40px;
      flex-shrink: 0;
      font-size: 12px;
      color: var(--muted);
    }

    .tag-bar-fill {
      height: 100%;
      border-radius: 6px;
      background: var(--accent);
      transition: width 0.6s ease;
    }

    .footer-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 24px;
      padding: 16px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--panel) 86%, transparent);
      border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    }
    .footer-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--border) 20%, transparent);
      font-size: 12px;
    }
    .footer-pill .fp-label { color: var(--muted); }
    .footer-pill .fp-value { font-weight: 600; }

    .empty-note {
      text-align: center;
      padding: 32px;
      color: var(--muted);
      font-size: 13px;
    }

    .tooltip {
      position: absolute;
      pointer-events: none;
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12px;
      line-height: 1.5;
      z-index: 100;
      white-space: nowrap;
      display: none;
    }
  </style>
</head>
<body>
  <div class="shell">
    <!-- Hero -->
    <div class="hero">
      <div class="avatar" id="avatar"></div>
      <div class="hero-info">
        <h1 class="hero-handle" id="heroHandle"></h1>
        <div class="hero-meta" id="heroMeta"></div>
      </div>
      <div class="hero-actions">
        <button class="secondary" onclick="post('refresh')">Refresh</button>
        <button class="primary" id="btnWeb">Open on Web</button>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid" id="statsGrid"></div>

    <!-- Rating History -->
    <div class="section-title">Rating History</div>
    <div class="chart-container">
      <canvas id="ratingChart"></canvas>
      <div class="tooltip" id="chartTooltip"></div>
    </div>

    <!-- Problems by Rating -->
    <div class="section-title">Problems by Rating</div>
    <div class="chart-container" id="ratingBars"></div>

    <!-- Top Tags -->
    <div class="section-title">Top Tags</div>
    <div class="chart-container" id="tagBars"></div>

    <!-- Footer -->
    <div class="footer-row" id="footerRow"></div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function post(cmd, extra) { vscode.postMessage(Object.assign({ command: cmd }, extra || {})); }
    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    const D = ${JSON.stringify(data)};

    /* ── Rating color helper ── */
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
    const avatar = document.getElementById('avatar');
    avatar.textContent = D.handle.substring(0, 2);
    avatar.style.backgroundColor = D.rankColor;

    const heroHandle = document.getElementById('heroHandle');
    heroHandle.textContent = D.handle;
    heroHandle.style.color = D.rankColor;

    const regDate = new Date(D.registrationTimeSeconds * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    let metaHtml = '<span class="rank-pill" style="background:' + D.rankColor + '">' + esc(D.rank || 'Unrated') + '</span>';
    metaHtml += '<span class="sep">·</span> Registered ' + esc(regDate);
    if (D.country) metaHtml += '<span class="sep">·</span> ' + esc(D.country);
    if (D.organization) metaHtml += '<span class="sep">·</span> ' + esc(D.organization);
    document.getElementById('heroMeta').innerHTML = metaHtml;

    document.getElementById('btnWeb').onclick = () => post('openOnWeb', { handle: D.handle });

    /* ── Stats Grid ── */
    const stats = [
      { value: D.rating, label: 'Rating', color: D.rankColor },
      { value: D.maxRating, label: 'Max Rating', color: rc(D.maxRating) },
      { value: D.contestCount, label: 'Contests', color: null },
      { value: D.solvedCount, label: 'Solved', color: null },
      { value: D.acceptanceRate.toFixed(1) + '%', label: 'Acceptance Rate', color: null },
      { value: (D.currentStreak > 0 ? '🔥 ' : '') + D.currentStreak, label: 'Current Streak', color: D.currentStreak > 0 ? '#ff6b35' : null },
      { value: D.longestStreak, label: 'Longest Streak', color: null },
      { value: (D.contribution >= 0 ? '+' : '') + D.contribution, label: 'Contribution', color: D.contribution > 0 ? 'var(--ok)' : D.contribution < 0 ? 'var(--bad)' : null }
    ];
    const grid = document.getElementById('statsGrid');
    stats.forEach(s => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.innerHTML = '<div class="stat-value"' + (s.color ? ' style="color:' + s.color + '"' : '') + '>' + esc(String(s.value)) + '</div>'
        + '<div class="stat-label">' + esc(s.label) + '</div>';
      grid.appendChild(card);
    });

    /* ── Rating Chart ── */
    (function drawRatingChart() {
      const canvas = document.getElementById('ratingChart');
      const tooltip = document.getElementById('chartTooltip');
      const history = D.ratingHistory;
      if (!history.length) {
        canvas.parentElement.innerHTML = '<div class="empty-note">No rating history yet.</div>';
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      const W = rect.width, H = rect.height;
      const pad = { top: 16, right: 16, bottom: 28, left: 48 };
      const cw = W - pad.left - pad.right;
      const ch = H - pad.top - pad.bottom;

      const ratings = history.map(h => h.newRating);
      const minR = Math.min(...ratings) - 100;
      const maxR = Math.max(...ratings) + 100;

      function x(i) { return pad.left + (i / (history.length - 1 || 1)) * cw; }
      function y(r) { return pad.top + (1 - (r - minR) / (maxR - minR || 1)) * ch; }

      // Rating tier bands
      const tiers = [
        { min: 0, max: 1200, color: 'rgba(128,128,128,0.06)' },
        { min: 1200, max: 1400, color: 'rgba(0,128,0,0.06)' },
        { min: 1400, max: 1600, color: 'rgba(3,168,158,0.06)' },
        { min: 1600, max: 1900, color: 'rgba(0,0,255,0.06)' },
        { min: 1900, max: 2100, color: 'rgba(170,0,170,0.06)' },
        { min: 2100, max: 2400, color: 'rgba(255,140,0,0.06)' },
        { min: 2400, max: 4000, color: 'rgba(255,0,0,0.06)' }
      ];
      tiers.forEach(t => {
        const top = Math.max(t.min, minR);
        const bot = Math.min(t.max, maxR);
        if (top >= bot) return;
        ctx.fillStyle = t.color;
        ctx.fillRect(pad.left, y(bot), cw, y(top) - y(bot));
      });

      // Grid lines
      ctx.strokeStyle = 'rgba(128,128,128,0.15)';
      ctx.lineWidth = 1;
      const step = maxR - minR > 800 ? 400 : maxR - minR > 400 ? 200 : 100;
      for (let r = Math.ceil(minR / step) * step; r <= maxR; r += step) {
        ctx.beginPath(); ctx.moveTo(pad.left, y(r)); ctx.lineTo(pad.left + cw, y(r)); ctx.stroke();
        ctx.fillStyle = 'rgba(128,128,128,0.5)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(r), pad.left - 6, y(r) + 3);
      }

      // Line
      ctx.beginPath();
      ctx.strokeStyle = D.rankColor;
      ctx.lineWidth = 2;
      history.forEach((h, i) => {
        const px = x(i), py = y(h.newRating);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.stroke();

      // Dots
      history.forEach((h, i) => {
        ctx.beginPath();
        ctx.arc(x(i), y(h.newRating), 3, 0, Math.PI * 2);
        ctx.fillStyle = rc(h.newRating);
        ctx.fill();
      });

      // X-axis labels (first, middle, last)
      ctx.fillStyle = 'rgba(128,128,128,0.5)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      [0, Math.floor(history.length / 2), history.length - 1].forEach(i => {
        if (i < 0 || i >= history.length) return;
        const d = new Date(history[i].time * 1000);
        const lbl = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        ctx.fillText(lbl, x(i), H - 4);
      });

      // Hover tooltip
      const container = canvas.parentElement;
      container.style.position = 'relative';
      canvas.addEventListener('mousemove', (e) => {
        const bx = e.offsetX;
        if (history.length < 2) return;
        const idx = Math.round((bx - pad.left) / cw * (history.length - 1));
        if (idx < 0 || idx >= history.length) { tooltip.style.display = 'none'; return; }
        const h = history[idx];
        const delta = h.newRating - h.oldRating;
        const sign = delta >= 0 ? '+' : '';
        tooltip.innerHTML = '<strong>' + esc(h.contestName) + '</strong><br>'
          + 'Rating: <strong style="color:' + rc(h.newRating) + '">' + h.newRating + '</strong> (' + sign + delta + ')<br>'
          + 'Rank: #' + h.rank;
        tooltip.style.display = 'block';
        const tx = Math.min(x(idx), W - 200);
        tooltip.style.left = tx + 'px';
        tooltip.style.top = (y(h.newRating) - 60) + 'px';
      });
      canvas.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    })();

    /* ── Problems by Rating ── */
    (function drawRatingBars() {
      const container = document.getElementById('ratingBars');
      const buckets = D.ratingBuckets.filter(b => b.count > 0);
      if (!buckets.length) {
        container.innerHTML = '<div class="empty-note">No solved problems with rating data.</div>';
        return;
      }
      const maxCount = Math.max(...buckets.map(b => b.count));
      let html = '';
      buckets.forEach(b => {
        const pct = (b.count / maxCount * 100).toFixed(1);
        const color = rc(b.min);
        html += '<div class="bar-row">'
          + '<span class="bar-label" style="color:' + color + '">' + esc(b.label) + '</span>'
          + '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>'
          + '<span class="bar-count">' + b.count + '</span>'
          + '</div>';
      });
      container.innerHTML = html;
    })();

    /* ── Top Tags ── */
    (function drawTagBars() {
      const container = document.getElementById('tagBars');
      const tags = D.topTags;
      if (!tags.length) {
        container.innerHTML = '<div class="empty-note">No tag data available.</div>';
        return;
      }
      const maxCount = Math.max(...tags.map(t => t.count));
      let html = '';
      tags.forEach(t => {
        const pct = (t.count / maxCount * 100).toFixed(1);
        html += '<div class="bar-row">'
          + '<span class="bar-label" style="color:var(--text);width:130px;font-size:12px">' + esc(t.tag) + '</span>'
          + '<div class="bar-track"><div class="tag-bar-fill" style="width:' + pct + '%"></div></div>'
          + '<span class="bar-count">' + t.count + '</span>'
          + '</div>';
      });
      container.innerHTML = html;
    })();

    /* ── Footer ── */
    (function drawFooter() {
      const row = document.getElementById('footerRow');
      const pills = [];

      if (D.organization) pills.push({ label: 'Org', value: D.organization });
      if (D.country) pills.push({ label: 'Country', value: D.country });
      if (D.city) pills.push({ label: 'City', value: D.city });
      pills.push({ label: 'Friend of', value: D.friendOfCount + ' users' });

      if (D.mostDifficultSolved) {
        const p = D.mostDifficultSolved;
        const rStr = p.rating ? ' (' + p.rating + ')' : '';
        pills.push({ label: 'Hardest', value: p.contestId + p.index + ' - ' + p.name + rStr, problem: p });
      }

      pills.forEach(p => {
        const el = document.createElement('div');
        el.className = 'footer-pill';
        if (p.problem) {
          el.innerHTML = '<span class="fp-label">' + esc(p.label) + ':</span> <a href="#" onclick="post(&quot;openProblem&quot;, {contestId:' + p.problem.contestId + ',index:&quot;' + esc(p.problem.index) + '&quot;});return false;" class="fp-value">' + esc(p.value) + '</a>';
        } else {
          el.innerHTML = '<span class="fp-label">' + esc(p.label) + ':</span> <span class="fp-value">' + esc(p.value) + '</span>';
        }
        row.appendChild(el);
      });
    })();
  </script>
</body>
</html>`;
  }
}

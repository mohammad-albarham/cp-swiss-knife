import * as vscode from 'vscode';
import { codeforcesApi } from '../api';
import { Contest, Problem, ProblemResult, RanklistRow, RatingChange, getRatingColor } from '../api/types';
import { getAuthService } from '../services/authService';
import { getNonce, getCspMeta, getThemeStyles, escapeHtml, formatDuration } from './webviewUtils';

interface StandingsState {
  contestId: number;
  contest?: Contest;
  problems: Problem[];
  rows: RanklistRow[];
  ratingMap: Map<string, number>;
  page: number;
  friendsOnly: boolean;
  loading: boolean;
  errorMessage?: string;
}

const PAGE_SIZE = 50;
const AUTO_REFRESH_INTERVAL = 60_000;

export class StandingsPanel {
  private static currentPanel: vscode.WebviewPanel | undefined;
  static state: StandingsState | undefined;
  private static context: vscode.ExtensionContext | undefined;
  private static autoRefreshTimer: ReturnType<typeof setInterval> | undefined;

  static show(context: vscode.ExtensionContext, contestId: number): void {
    StandingsPanel.context = context;

    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (StandingsPanel.currentPanel) {
      StandingsPanel.currentPanel.reveal(column);
      // If same contest, just refresh; otherwise reset state
      if (StandingsPanel.state?.contestId !== contestId) {
        StandingsPanel.initState(contestId);
        void StandingsPanel.fetchStandings();
      }
      return;
    }

    StandingsPanel.initState(contestId);

    StandingsPanel.currentPanel = vscode.window.createWebviewPanel(
      'codeforcesStandings',
      `Standings: Contest ${contestId}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri]
      }
    );

    StandingsPanel.currentPanel.onDidDispose(() => {
      StandingsPanel.currentPanel = undefined;
      StandingsPanel.state = undefined;
      StandingsPanel.clearAutoRefresh();
    }, null, context.subscriptions);

    StandingsPanel.currentPanel.webview.onDidReceiveMessage(async message => {
      switch (message.command) {
        case 'loadMore':
          await StandingsPanel.loadMore();
          break;
        case 'toggleFriends':
          await StandingsPanel.toggleFriendsOnly();
          break;
        case 'refresh':
          await StandingsPanel.fetchStandings();
          break;
      }
    }, undefined, context.subscriptions);

    void StandingsPanel.fetchStandings();
  }

  private static initState(contestId: number): void {
    StandingsPanel.state = {
      contestId,
      problems: [],
      rows: [],
      ratingMap: new Map(),
      page: 1,
      friendsOnly: false,
      loading: false
    };
  }

  private static clearAutoRefresh(): void {
    if (StandingsPanel.autoRefreshTimer !== undefined) {
      clearInterval(StandingsPanel.autoRefreshTimer);
      StandingsPanel.autoRefreshTimer = undefined;
    }
  }

  private static setupAutoRefresh(): void {
    StandingsPanel.clearAutoRefresh();

    if (StandingsPanel.state?.contest?.phase === 'CODING') {
      StandingsPanel.autoRefreshTimer = setInterval(() => {
        void StandingsPanel.fetchStandings();
      }, AUTO_REFRESH_INTERVAL);
    }
  }

  private static async fetchStandings(): Promise<void> {
    const state = StandingsPanel.state;
    if (!state) {
      return;
    }

    state.loading = true;
    state.errorMessage = undefined;
    StandingsPanel.updateWebview();

    try {
      const options: {
        from?: number;
        count?: number;
        handles?: string[];
        showUnofficial?: boolean;
      } = {
        from: 1,
        count: state.page * PAGE_SIZE,
        showUnofficial: true
      };

      if (state.friendsOnly) {
        const handles = await StandingsPanel.getFriendHandles();
        if (handles.length === 0) {
          state.loading = false;
          state.errorMessage = 'No friends found. Add friends via Codeforces or configure codeforces.friendHandles in settings.';
          StandingsPanel.updateWebview();
          return;
        }
        options.handles = handles;
        // When filtering by handles, remove from/count so we get all matching rows
        delete options.from;
        delete options.count;
      }

      const [standingsResult, ratingChanges] = await Promise.all([
        codeforcesApi.getContestStandings(state.contestId, options),
        StandingsPanel.fetchRatingChangesSafe(state.contestId)
      ]);

      state.contest = standingsResult.contest;
      state.problems = standingsResult.problems;
      state.rows = standingsResult.rows;

      // Build rating map from rating changes
      state.ratingMap = new Map();
      for (const rc of ratingChanges) {
        // Use the rating before the contest for coloring
        state.ratingMap.set(rc.handle, rc.oldRating);
      }

      // Update panel title
      if (StandingsPanel.currentPanel && state.contest) {
        StandingsPanel.currentPanel.title = `Standings: ${state.contest.name}`;
      }

      StandingsPanel.setupAutoRefresh();
    } catch (error) {
      state.errorMessage = error instanceof Error ? error.message : 'Failed to fetch standings';
    } finally {
      state.loading = false;
      StandingsPanel.updateWebview();
    }
  }

  private static async fetchRatingChangesSafe(contestId: number): Promise<RatingChange[]> {
    try {
      return await codeforcesApi.getContestRatingChanges(contestId);
    } catch {
      // Rating changes may not be available for ongoing or unrated contests
      return [];
    }
  }

  private static async getFriendHandles(): Promise<string[]> {
    const configHandles = vscode.workspace.getConfiguration('codeforces').get<string[]>('friendHandles', []);
    let apiHandles: string[] = [];

    if (getAuthService().isLoggedIn()) {
      try {
        apiHandles = await codeforcesApi.getUserFriends();
      } catch {
        // API friends require auth with API key; fall back to config
      }
    }

    // Merge and deduplicate
    const all = new Set<string>([...configHandles, ...apiHandles]);

    // Also include current user handle so their row shows in friends view
    const currentHandle = getAuthService().getCurrentUser()?.handle;
    if (currentHandle) {
      all.add(currentHandle);
    }

    return Array.from(all);
  }

  private static async loadMore(): Promise<void> {
    const state = StandingsPanel.state;
    if (!state || state.friendsOnly) {
      return;
    }

    state.page += 1;
    await StandingsPanel.fetchStandings();
  }

  private static async toggleFriendsOnly(): Promise<void> {
    const state = StandingsPanel.state;
    if (!state) {
      return;
    }

    state.friendsOnly = !state.friendsOnly;
    state.page = 1;
    await StandingsPanel.fetchStandings();
  }

  private static updateWebview(): void {
    if (StandingsPanel.currentPanel && StandingsPanel.state) {
      StandingsPanel.currentPanel.webview.html = StandingsPanel.getHtml(
        StandingsPanel.currentPanel.webview
      );
    }
  }

  static getHtml(webview: vscode.Webview): string {
    const state = StandingsPanel.state;
    if (!state) {
      return '';
    }

    const nonce = getNonce();
    const cspMeta = getCspMeta(webview, nonce);
    const themeStyles = getThemeStyles();
    const currentHandle = getAuthService().getCurrentUser()?.handle?.toLowerCase();

    const contestName = state.contest ? escapeHtml(state.contest.name) : `Contest ${state.contestId}`;
    const contestPhase = state.contest?.phase ?? 'UNKNOWN';
    const contestType = state.contest?.type ?? '';
    const duration = state.contest ? formatDuration(state.contest.durationSeconds) : '';
    const phaseLabel = StandingsPanel.getPhaseLabel(contestPhase);
    const phaseBadgeClass = contestPhase === 'CODING' ? 'badge-live' : 'badge-phase';

    // Determine if "Load More" should be shown
    const totalLoaded = state.rows.length;
    const expectedMax = state.page * PAGE_SIZE;
    const hasMore = !state.friendsOnly && totalLoaded >= expectedMax;

    const heroHtml = `
      <section class="hero">
        <div>
          <div class="hero-badges">
            <span class="badge ${phaseBadgeClass}">${escapeHtml(phaseLabel)}</span>
            ${contestType ? `<span class="badge badge-type">${escapeHtml(contestType)}</span>` : ''}
            ${duration ? `<span class="badge badge-type">${escapeHtml(duration)}</span>` : ''}
            ${state.contest?.frozen ? '<span class="badge badge-frozen">Frozen</span>' : ''}
          </div>
          <h1>${contestName}</h1>
          <p>${totalLoaded} participant${totalLoaded !== 1 ? 's' : ''} loaded${state.friendsOnly ? ' (friends only)' : ''}</p>
        </div>
        <div class="actions">
          <button class="secondary" onclick="post('toggleFriends')">${state.friendsOnly ? 'Show All' : 'Friends Only'}</button>
          <button class="secondary" onclick="post('refresh')">Refresh</button>
        </div>
      </section>
    `;

    let bodyHtml: string;

    if (state.loading && state.rows.length === 0) {
      bodyHtml = `
        <section class="empty-state">
          <h2>Loading standings...</h2>
          <p>Fetching contest data from Codeforces.</p>
        </section>
      `;
    } else if (state.errorMessage) {
      bodyHtml = `
        <section class="card error-card">
          <h2>Error</h2>
          <p>${escapeHtml(state.errorMessage)}</p>
        </section>
      `;
    } else if (state.rows.length === 0) {
      bodyHtml = `
        <section class="empty-state">
          <h2>No standings available</h2>
          <p>${state.friendsOnly ? 'None of your friends participated in this contest.' : 'No participants found for this contest.'}</p>
        </section>
      `;
    } else {
      bodyHtml = StandingsPanel.renderTable(state, currentHandle);

      if (hasMore) {
        bodyHtml += `
          <div class="load-more-container">
            <button class="primary" onclick="post('loadMore')">Load More</button>
          </div>
        `;
      }
    }

    if (state.loading && state.rows.length > 0) {
      bodyHtml += `
        <div class="loading-indicator">
          <p>Refreshing...</p>
        </div>
      `;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${cspMeta}
  <title>Standings: ${contestName}</title>
  <style nonce="${nonce}">
    ${themeStyles}

    body {
      background:
        radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 14%, transparent), transparent 35%),
        linear-gradient(180deg, color-mix(in srgb, var(--bg) 82%, black 6%), var(--bg));
    }

    .hero {
      display: grid;
      gap: 16px;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      margin-bottom: 20px;
      padding: 22px;
      border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
      border-radius: 18px;
      background: linear-gradient(160deg, color-mix(in srgb, var(--panel-strong) 95%, transparent), color-mix(in srgb, var(--panel) 88%, transparent));
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.16);
    }

    .hero h1 {
      margin: 8px 0 0;
      font: 600 28px/1.1 var(--serif);
      letter-spacing: 0.01em;
    }

    .hero p {
      margin: 8px 0 0;
      color: var(--muted);
    }

    .hero-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
    }

    .badge-live {
      background: color-mix(in srgb, var(--ok) 18%, transparent);
      color: var(--ok);
    }

    .badge-phase {
      background: color-mix(in srgb, var(--accent) 16%, transparent);
      color: var(--accent);
    }

    .badge-type {
      background: color-mix(in srgb, var(--muted) 14%, transparent);
      color: var(--muted);
    }

    .badge-frozen {
      background: color-mix(in srgb, var(--warn) 18%, transparent);
      color: var(--warn);
    }

    .standings-card {
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 16px;
      overflow: hidden;
      background: color-mix(in srgb, var(--panel) 92%, transparent);
    }

    .standings-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .standings-table thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      padding: 12px 10px;
      text-align: center;
      background: color-mix(in srgb, var(--panel-strong) 96%, transparent);
      font: 600 11px/1 var(--mono);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      border-bottom: 2px solid color-mix(in srgb, var(--border) 80%, transparent);
      white-space: nowrap;
    }

    .standings-table thead th.col-handle {
      text-align: left;
      padding-left: 14px;
    }

    .standings-table tbody td {
      padding: 9px 10px;
      text-align: center;
      border-bottom: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
      vertical-align: middle;
    }

    .standings-table tbody td.col-handle {
      text-align: left;
      padding-left: 14px;
      font-weight: 600;
      white-space: nowrap;
    }

    .standings-table tbody td.col-rank {
      font-weight: 700;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }

    .standings-table tbody tr:hover {
      background: color-mix(in srgb, var(--accent) 6%, transparent);
    }

    .standings-table tbody tr.row-current-user {
      background: color-mix(in srgb, var(--accent) 10%, transparent);
    }

    .standings-table tbody tr.row-current-user:hover {
      background: color-mix(in srgb, var(--accent) 15%, transparent);
    }

    .handle-link {
      text-decoration: none;
      font-weight: 600;
    }

    .handle-link:hover {
      text-decoration: underline;
    }

    .participant-type {
      font-size: 10px;
      color: var(--muted);
      margin-left: 4px;
      font-weight: 400;
    }

    .problem-cell {
      min-width: 64px;
    }

    .problem-accepted {
      color: var(--ok);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .problem-rejected {
      color: var(--bad);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .problem-not-attempted {
      color: color-mix(in srgb, var(--muted) 50%, transparent);
    }

    .problem-time {
      display: block;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }

    .problem-tries {
      display: block;
      font-size: 10px;
      color: var(--muted);
    }

    .score-cell {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .penalty-cell {
      font-variant-numeric: tabular-nums;
      color: var(--muted);
    }

    .hacks-cell {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .hack-plus {
      color: var(--ok);
      font-weight: 600;
    }

    .hack-minus {
      color: var(--bad);
      font-weight: 600;
    }

    .problem-header-index {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
    }

    .problem-header-name {
      display: block;
      font-size: 9px;
      font-weight: 400;
      color: var(--muted);
      max-width: 80px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin: 2px auto 0;
    }

    .load-more-container {
      display: flex;
      justify-content: center;
      padding: 20px 0;
    }

    .loading-indicator {
      text-align: center;
      padding: 14px;
      color: var(--muted);
      font-size: 13px;
    }

    .empty-state {
      padding: 40px 28px;
      border: 1px dashed color-mix(in srgb, var(--border) 78%, transparent);
      border-radius: 16px;
      text-align: center;
      background: color-mix(in srgb, var(--panel) 90%, transparent);
    }

    .empty-state h2 {
      margin: 0 0 8px;
      font: 600 20px/1.2 var(--serif);
    }

    .empty-state p {
      margin: 0;
      color: var(--muted);
    }

    .error-card {
      border-color: color-mix(in srgb, var(--bad) 45%, transparent);
    }

    .error-card h2 {
      color: var(--bad);
      margin: 0 0 8px;
    }

    .error-card p {
      margin: 0;
      color: var(--muted);
    }

    @media (max-width: 900px) {
      .hero {
        grid-template-columns: 1fr;
      }
      .actions {
        justify-content: flex-start;
      }
      .standings-card {
        overflow-x: auto;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    ${heroHtml}
    ${bodyHtml}
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function post(command) {
      vscode.postMessage({ command });
    }
  </script>
</body>
</html>`;
  }

  private static renderTable(state: StandingsState, currentHandle: string | undefined): string {
    const problems = state.problems;

    const headerCells = [
      '<th class="col-rank">#</th>',
      '<th class="col-handle">Handle</th>',
      '<th>Score</th>',
      '<th>Penalty</th>',
      ...problems.map(p =>
        `<th class="problem-cell"><span class="problem-header-index">${escapeHtml(p.index)}</span><span class="problem-header-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span></th>`
      ),
      '<th>Hacks</th>'
    ];

    const rowsHtml = state.rows.map(row => {
      const handle = StandingsPanel.getRowHandle(row);
      const isCurrentUser = currentHandle && handle.toLowerCase() === currentHandle;
      const rowClass = isCurrentUser ? ' class="row-current-user"' : '';
      const rating = state.ratingMap.get(handle);
      const handleColor = rating !== undefined ? getRatingColor(rating) : '';
      const handleStyle = handleColor ? ` style="color: ${handleColor}"` : '';
      const participantSuffix = StandingsPanel.getParticipantSuffix(row.party.participantType);

      const displayName = row.party.teamName
        ? escapeHtml(row.party.teamName)
        : escapeHtml(handle);

      const problemCells = row.problemResults.map(pr => StandingsPanel.renderProblemCell(pr, state.contest?.type)).join('');

      const hacksHtml = StandingsPanel.renderHacksCell(row.successfulHackCount, row.unsuccessfulHackCount);

      const scoreDisplay = state.contest?.type === 'IOI'
        ? row.points.toFixed(0)
        : row.points.toFixed(0);

      return `<tr${rowClass}>
        <td class="col-rank">${row.rank}</td>
        <td class="col-handle"><span class="handle-link"${handleStyle}>${displayName}</span>${participantSuffix}</td>
        <td class="score-cell">${escapeHtml(scoreDisplay)}</td>
        <td class="penalty-cell">${row.penalty}</td>
        ${problemCells}
        <td class="hacks-cell">${hacksHtml}</td>
      </tr>`;
    }).join('');

    return `
      <div class="standings-card">
        <table class="standings-table">
          <thead><tr>${headerCells.join('')}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  private static renderProblemCell(pr: ProblemResult, contestType?: string): string {
    // Not attempted
    if (pr.rejectedAttemptCount === 0 && pr.points === 0 && !pr.bestSubmissionTimeSeconds) {
      return '<td class="problem-cell problem-not-attempted">.</td>';
    }

    // Accepted / has points
    if (pr.points > 0 || (pr.bestSubmissionTimeSeconds !== undefined && pr.bestSubmissionTimeSeconds >= 0 && pr.type !== 'PRELIMINARY')) {
      const timeMinutes = pr.bestSubmissionTimeSeconds !== undefined
        ? Math.floor(pr.bestSubmissionTimeSeconds / 60)
        : undefined;

      let content: string;

      if (contestType === 'IOI') {
        // IOI-style: show points
        content = `<span class="problem-time">${pr.points.toFixed(0)}</span>`;
        if (pr.rejectedAttemptCount > 0) {
          content += `<span class="problem-tries">(-${pr.rejectedAttemptCount})</span>`;
        }
      } else {
        // ICPC/CF-style: show +attempts and time
        const triesLabel = pr.rejectedAttemptCount > 0 ? `+${pr.rejectedAttemptCount}` : '+';
        content = `<span class="problem-time">${escapeHtml(triesLabel)}</span>`;
        if (timeMinutes !== undefined) {
          content += `<span class="problem-tries">${timeMinutes}</span>`;
        }
      }

      return `<td class="problem-cell problem-accepted">${content}</td>`;
    }

    // Only rejected attempts
    if (pr.rejectedAttemptCount > 0) {
      return `<td class="problem-cell problem-rejected"><span class="problem-time">-${pr.rejectedAttemptCount}</span></td>`;
    }

    return '<td class="problem-cell problem-not-attempted">.</td>';
  }

  private static renderHacksCell(successful: number, unsuccessful: number): string {
    if (successful === 0 && unsuccessful === 0) {
      return '<span class="problem-not-attempted">-</span>';
    }

    const parts: string[] = [];
    if (successful > 0) {
      parts.push(`<span class="hack-plus">+${successful}</span>`);
    }
    if (unsuccessful > 0) {
      parts.push(`<span class="hack-minus">-${unsuccessful}</span>`);
    }

    return parts.join(' / ');
  }

  private static getRowHandle(row: RanklistRow): string {
    if (row.party.teamName) {
      return row.party.teamName;
    }

    if (row.party.members.length > 0) {
      return row.party.members[0].handle;
    }

    return 'Unknown';
  }

  private static getParticipantSuffix(type: string): string {
    switch (type) {
      case 'PRACTICE':
        return '<span class="participant-type">*</span>';
      case 'VIRTUAL':
        return '<span class="participant-type">#</span>';
      case 'OUT_OF_COMPETITION':
        return '<span class="participant-type">!</span>';
      case 'MANAGER':
        return '<span class="participant-type">mgr</span>';
      default:
        return '';
    }
  }

  private static getPhaseLabel(phase: string): string {
    switch (phase) {
      case 'BEFORE':
        return 'Not Started';
      case 'CODING':
        return 'Live';
      case 'PENDING_SYSTEM_TEST':
        return 'Pending System Test';
      case 'SYSTEM_TEST':
        return 'System Testing';
      case 'FINISHED':
        return 'Finished';
      default:
        return phase;
    }
  }
}

let standingsPanelInstance: typeof StandingsPanel | undefined;

export function initStandingsPanel(): typeof StandingsPanel {
  standingsPanelInstance = StandingsPanel;
  return standingsPanelInstance;
}

export function getStandingsPanel(): typeof StandingsPanel {
  if (!standingsPanelInstance) {
    throw new Error('Standings panel not initialized');
  }
  return standingsPanelInstance;
}

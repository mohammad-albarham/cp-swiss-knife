import * as vscode from 'vscode';
import { codeforcesApi } from '../api';
import { Contest, Problem, RanklistRow, RatingChange, Hack, Submission, getRatingColor, getRankName } from '../api/types';
import { getAuthService } from '../services/authService';
import { getNonce, getCspMeta, getThemeStyles, escapeHtml, formatDuration, formatAbsoluteDate } from './webviewUtils';

interface ContestDetailState {
  contestId: number;
  contest?: Contest;
  problems?: Problem[];
  userRow?: RanklistRow;
  ratingChange?: RatingChange;
  hacks?: Hack[];
  submissions?: Submission[];
  participated: boolean;
  handle?: string;
  errorMessage?: string;
}

export class ContestDetailPanel {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static currentState: ContestDetailState | undefined;

  static async show(context: vscode.ExtensionContext, contestId: number): Promise<void> {
    const handle = getAuthService().getCurrentUser()?.handle;
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (!this.currentPanel) {
      this.currentPanel = vscode.window.createWebviewPanel(
        'codeforcesContestDetail',
        `Contest ${contestId}`,
        column,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [context.extensionUri]
        }
      );

      this.currentPanel.onDidDispose(() => {
        this.currentPanel = undefined;
        this.currentState = undefined;
      }, null, context.subscriptions);

      this.currentPanel.webview.onDidReceiveMessage(async message => {
        switch (message.command) {
          case 'viewFullStandings':
            await vscode.commands.executeCommand('codeforces.showStandings', message.contestId);
            break;
          case 'openProblem':
            await vscode.commands.executeCommand('codeforces.openProblem', message.contestId, message.index);
            break;
        }
      }, undefined, context.subscriptions);
    } else {
      this.currentPanel.reveal(column);
    }

    this.currentPanel.title = `Contest ${contestId}`;
    this.currentPanel.webview.html = this.getLoadingHtml(this.currentPanel.webview, contestId);

    const state = await this.fetchContestData(contestId, handle);
    this.currentState = state;

    if (state.contest) {
      this.currentPanel.title = state.contest.name;
    }

    this.currentPanel.webview.html = this.getHtml(this.currentPanel.webview, state);

    const autoOpen = vscode.workspace.getConfiguration('codeforces').get<boolean>('autoOpenContestProblems', false);
    if (autoOpen && state.contest?.phase === 'CODING' && state.problems) {
      for (const p of state.problems) {
        await vscode.commands.executeCommand('codeforces.openProblemInVsCode', state.contestId, p.index);
      }
    }
  }

  private static async fetchContestData(contestId: number, handle?: string): Promise<ContestDetailState> {
    const state: ContestDetailState = {
      contestId,
      participated: false,
      handle
    };

    try {
      const standingsPromise = handle
        ? codeforcesApi.getContestStandings(contestId, { handles: [handle] })
        : codeforcesApi.getContestStandings(contestId, { from: 1, count: 1 });

      const ratingPromise = codeforcesApi.getContestRatingChanges(contestId);
      const hacksPromise = codeforcesApi.getContestHacks(contestId);
      const statusPromise = handle
        ? codeforcesApi.getContestStatus(contestId, { handle })
        : Promise.resolve([] as Submission[]);

      const [standingsResult, ratingChanges, hacks, submissions] = await Promise.allSettled([
        standingsPromise,
        ratingPromise,
        hacksPromise,
        statusPromise
      ]);

      if (standingsResult.status === 'fulfilled') {
        state.contest = standingsResult.value.contest;
        state.problems = standingsResult.value.problems;
        if (handle && standingsResult.value.rows.length > 0) {
          state.userRow = standingsResult.value.rows[0];
          state.participated = true;
        }
      }

      if (ratingChanges.status === 'fulfilled' && handle) {
        state.ratingChange = ratingChanges.value.find(rc => rc.handle === handle);
      }

      if (hacks.status === 'fulfilled') {
        state.hacks = hacks.value;
      }

      if (submissions.status === 'fulfilled') {
        state.submissions = submissions.value;
      }
    } catch (error) {
      state.errorMessage = error instanceof Error ? error.message : 'Failed to fetch contest data';
    }

    return state;
  }

  private static getLoadingHtml(webview: vscode.Webview, contestId: number): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${getCspMeta(webview, nonce)}
  <title>Contest ${contestId}</title>
  <style>${getThemeStyles()}
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      gap: 16px;
      color: var(--muted);
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid color-mix(in srgb, var(--border) 60%, transparent);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="shell">
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading contest data...</p>
    </div>
  </div>
</body>
</html>`;
  }

  static getHtml(webview: vscode.Webview, state: ContestDetailState): string {
    const nonce = getNonce();

    if (state.errorMessage) {
      return this.getErrorHtml(webview, nonce, state);
    }

    const contest = state.contest;
    if (!contest) {
      return this.getErrorHtml(webview, nonce, {
        ...state,
        errorMessage: 'Contest data could not be loaded.'
      });
    }

    const heroSection = this.renderHero(contest);
    const contentSection = state.participated
      ? this.renderParticipantView(state, contest)
      : this.renderNonParticipantView(state, contest);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${getCspMeta(webview, nonce)}
  <title>${escapeHtml(contest.name)}</title>
  <style>${getThemeStyles()}
    body {
      background:
        radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 14%, transparent), transparent 35%),
        linear-gradient(180deg, color-mix(in srgb, var(--bg) 82%, black 6%), var(--bg));
    }
    .hero {
      margin-bottom: 20px;
      padding: 22px;
      border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
      border-radius: 18px;
      background: linear-gradient(160deg, color-mix(in srgb, var(--panel-strong) 95%, transparent), color-mix(in srgb, var(--panel) 88%, transparent));
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.16);
    }
    .hero h1 {
      margin: 0 0 8px;
      font: 600 28px/1.15 var(--serif);
      letter-spacing: 0.01em;
    }
    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      color: var(--muted);
      font-size: 13px;
    }
    .hero-meta span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
    .stat-sub {
      font-size: 12px;
      color: var(--muted);
    }
    .problem-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .problem-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 14px 10px;
      border-radius: 12px;
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      background: color-mix(in srgb, var(--panel) 92%, transparent);
      text-align: center;
      cursor: pointer;
      transition: transform 120ms ease, border-color 120ms ease;
    }
    .problem-cell:hover {
      transform: translateY(-2px);
      border-color: var(--accent);
    }
    .problem-cell.solved {
      border-color: color-mix(in srgb, var(--ok) 50%, transparent);
      background: color-mix(in srgb, var(--ok) 8%, transparent);
    }
    .problem-cell.unsolved {
      border-color: color-mix(in srgb, var(--bad) 50%, transparent);
      background: color-mix(in srgb, var(--bad) 8%, transparent);
    }
    .problem-cell.unattempted {
      opacity: 0.6;
    }
    .problem-index {
      font: 700 16px/1 var(--mono);
      margin-bottom: 6px;
    }
    .problem-result {
      font: 600 13px/1 var(--mono);
    }
    .problem-result.positive { color: var(--ok); }
    .problem-result.negative { color: var(--bad); }
    .problem-name {
      font-size: 11px;
      color: var(--muted);
      margin-top: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }
    .rating-delta.positive { color: var(--ok); font-weight: 700; }
    .rating-delta.negative { color: var(--bad); font-weight: 700; }
    .rating-arrow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font: 600 14px/1 var(--mono);
    }
    .submissions-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    .submissions-table th,
    .submissions-table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
      font-size: 13px;
    }
    .submissions-table th {
      background: color-mix(in srgb, var(--panel) 90%, transparent);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    .submissions-table tr:hover td {
      background: color-mix(in srgb, var(--accent) 5%, transparent);
    }
    .verdict-ok { color: var(--ok); font-weight: 600; }
    .verdict-fail { color: var(--bad); font-weight: 600; }
    .verdict-pending { color: var(--warn); font-weight: 600; }
    .non-participant {
      text-align: center;
      padding: 40px 20px;
    }
    .non-participant h2 {
      margin: 0 0 12px;
      font: 600 22px/1.2 var(--serif);
    }
    .non-participant p {
      color: var(--muted);
      margin: 0 0 20px;
      max-width: 50ch;
      margin-left: auto;
      margin-right: auto;
    }
    .section-title {
      margin: 0 0 12px;
      font: 600 16px/1.2 var(--serif);
    }
  </style>
</head>
<body>
  <div class="shell">
    ${heroSection}
    ${contentSection}
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function post(command, data) {
      vscode.postMessage({ command, ...data });
    }
  </script>
</body>
</html>`;
  }

  private static getErrorHtml(webview: vscode.Webview, nonce: string, state: ContestDetailState): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${getCspMeta(webview, nonce)}
  <title>Contest ${state.contestId}</title>
  <style>${getThemeStyles()}
    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      text-align: center;
      gap: 12px;
    }
    .error-container h2 {
      margin: 0;
      font: 600 22px/1.2 var(--serif);
    }
    .error-container p {
      margin: 0;
      color: var(--muted);
      max-width: 50ch;
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="error-container">
      <h2>Failed to Load Contest</h2>
      <p>${escapeHtml(state.errorMessage || 'An unknown error occurred.')}</p>
    </div>
  </div>
</body>
</html>`;
  }

  private static renderHero(contest: Contest): string {
    const contestDate = contest.startTimeSeconds
      ? formatAbsoluteDate(contest.startTimeSeconds)
      : 'Date unknown';
    const duration = formatDuration(contest.durationSeconds);
    const typeLabel = contest.type === 'CF' ? 'Codeforces' : contest.type === 'IOI' ? 'IOI' : 'ICPC';
    const phaseLabel = contest.phase.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    return `
    <section class="hero">
      <h1>${escapeHtml(contest.name)}</h1>
      <div class="hero-meta">
        <span>${escapeHtml(typeLabel)}</span>
        <span>${escapeHtml(contestDate)}</span>
        <span>Duration: ${escapeHtml(duration)}</span>
        <span>Phase: ${escapeHtml(phaseLabel)}</span>
      </div>
      <div class="hero-actions">
        <button class="primary" onclick="post('viewFullStandings', { contestId: ${contest.id} })">View Full Standings</button>
      </div>
    </section>`;
  }

  private static renderParticipantView(state: ContestDetailState, contest: Contest): string {
    const parts: string[] = [];

    parts.push(this.renderPerformanceCard(state));

    if (state.problems && state.userRow) {
      parts.push(this.renderProblemResultsGrid(state.problems, state.userRow, contest.id));
    }

    if (state.hacks) {
      parts.push(this.renderHacksCard(state.hacks));
    }

    if (state.submissions && state.submissions.length > 0) {
      parts.push(this.renderSubmissionsTable(state.submissions));
    }

    return parts.join('\n');
  }

  private static renderNonParticipantView(state: ContestDetailState, contest: Contest): string {
    const handleNote = state.handle
      ? `<p>User <strong>${escapeHtml(state.handle)}</strong> did not participate in this contest.</p>`
      : '<p>Log in to see your performance data for this contest.</p>';

    let content = `
    <div class="card non-participant">
      <h2>No Participation Data</h2>
      ${handleNote}
      <button class="primary" onclick="post('viewFullStandings', { contestId: ${contest.id} })">View Full Standings</button>
    </div>`;

    if (state.hacks && state.hacks.length > 0) {
      content += this.renderHacksCard(state.hacks);
    }

    return content;
  }

  private static renderPerformanceCard(state: ContestDetailState): string {
    const row = state.userRow;
    if (!row) {
      return '';
    }

    const rank = row.rank;
    const totalPoints = row.points;
    const penalty = row.penalty;

    let ratingDeltaHtml = '';
    let ratingTransitionHtml = '';
    if (state.ratingChange) {
      const rc = state.ratingChange;
      const delta = rc.newRating - rc.oldRating;
      const deltaSign = delta >= 0 ? '+' : '';
      const deltaClass = delta >= 0 ? 'positive' : 'negative';
      const oldColor = getRatingColor(rc.oldRating);
      const newColor = getRatingColor(rc.newRating);
      const oldRank = getRankName(rc.oldRating);
      const newRank = getRankName(rc.newRating);

      ratingDeltaHtml = `
        <div class="stat-item">
          <span class="stat-label">Rating Change</span>
          <span class="stat-value rating-delta ${deltaClass}">${deltaSign}${delta}</span>
        </div>`;

      ratingTransitionHtml = `
        <div class="stat-item">
          <span class="stat-label">Rating</span>
          <span class="rating-arrow">
            <span style="color: ${oldColor}">${rc.oldRating}</span>
            &rarr;
            <span style="color: ${newColor}">${rc.newRating}</span>
          </span>
          <span class="stat-sub">${escapeHtml(oldRank)} &rarr; ${escapeHtml(newRank)}</span>
        </div>`;
    }

    const hackStats = row.successfulHackCount > 0 || row.unsuccessfulHackCount > 0
      ? `
        <div class="stat-item">
          <span class="stat-label">Your Hacks</span>
          <span class="stat-value">${row.successfulHackCount}<span style="color: var(--ok);">+</span> / ${row.unsuccessfulHackCount}<span style="color: var(--bad);">-</span></span>
        </div>`
      : '';

    return `
    <div class="card">
      <h3 class="section-title">Your Performance</h3>
      <div class="stat-grid">
        <div class="stat-item">
          <span class="stat-label">Rank</span>
          <span class="stat-value">#${rank}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Score</span>
          <span class="stat-value">${totalPoints}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Penalty</span>
          <span class="stat-value">${penalty}</span>
        </div>
        ${ratingDeltaHtml}
        ${ratingTransitionHtml}
        ${hackStats}
      </div>
    </div>`;
  }

  private static renderProblemResultsGrid(problems: Problem[], row: RanklistRow, contestId: number): string {
    const cells = problems.map((problem, i) => {
      const pr = row.problemResults[i];
      if (!pr) {
        return this.renderProblemCell(problem, 'unattempted', '', contestId);
      }

      if (pr.points > 0 && pr.bestSubmissionTimeSeconds !== undefined) {
        const minutes = Math.floor(pr.bestSubmissionTimeSeconds / 60);
        const rejectedPrefix = pr.rejectedAttemptCount > 0 ? `(-${pr.rejectedAttemptCount}) ` : '';
        const label = `${rejectedPrefix}${minutes}m`;
        return this.renderProblemCell(problem, 'solved', label, contestId);
      }

      if (pr.points > 0) {
        // IOI-style partial or full score without time
        const label = `${pr.points}`;
        return this.renderProblemCell(problem, 'solved', label, contestId);
      }

      if (pr.rejectedAttemptCount > 0) {
        const label = `-${pr.rejectedAttemptCount}`;
        return this.renderProblemCell(problem, 'unsolved', label, contestId);
      }

      return this.renderProblemCell(problem, 'unattempted', '', contestId);
    });

    return `
    <div class="card">
      <h3 class="section-title">Problem Results</h3>
      <div class="problem-grid">
        ${cells.join('\n')}
      </div>
    </div>`;
  }

  private static renderProblemCell(problem: Problem, status: 'solved' | 'unsolved' | 'unattempted', resultLabel: string, contestId: number): string {
    const resultClass = status === 'solved' ? 'positive' : status === 'unsolved' ? 'negative' : '';
    const resultDisplay = resultLabel
      ? `<span class="problem-result ${resultClass}">${escapeHtml(resultLabel)}</span>`
      : '<span class="problem-result" style="opacity:0.4">--</span>';

    return `
      <div class="problem-cell ${status}" onclick="post('openProblem', { contestId: ${contestId}, index: '${escapeHtml(problem.index)}' })">
        <span class="problem-index">${escapeHtml(problem.index)}</span>
        ${resultDisplay}
        <span class="problem-name" title="${escapeHtml(problem.name)}">${escapeHtml(problem.name)}</span>
      </div>`;
  }

  private static renderHacksCard(hacks: Hack[]): string {
    const total = hacks.length;
    const successful = hacks.filter(h => h.verdict === 'HACK_SUCCESSFUL').length;
    const unsuccessful = hacks.filter(h => h.verdict === 'HACK_UNSUCCESSFUL').length;
    const other = total - successful - unsuccessful;

    return `
    <div class="card">
      <h3 class="section-title">Hacks Summary</h3>
      <div class="stat-grid">
        <div class="stat-item">
          <span class="stat-label">Total Hacks</span>
          <span class="stat-value">${total}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Successful</span>
          <span class="stat-value positive">${successful}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Unsuccessful</span>
          <span class="stat-value negative">${unsuccessful}</span>
        </div>
        ${other > 0 ? `
        <div class="stat-item">
          <span class="stat-label">Other</span>
          <span class="stat-value">${other}</span>
        </div>` : ''}
      </div>
    </div>`;
  }

  private static renderSubmissionsTable(submissions: Submission[]): string {
    const sorted = [...submissions].sort((a, b) => b.creationTimeSeconds - a.creationTimeSeconds);

    const rows = sorted.map(sub => {
      const verdictText = this.formatVerdict(sub.verdict);
      const verdictClass = sub.verdict === 'OK' ? 'verdict-ok'
        : sub.verdict === 'TESTING' ? 'verdict-pending'
        : sub.verdict ? 'verdict-fail'
        : 'verdict-pending';
      const timeSec = (sub.timeConsumedMillis / 1000).toFixed(2);
      const memoryMb = (sub.memoryConsumedBytes / (1024 * 1024)).toFixed(1);
      const problemLabel = `${sub.problem.index} - ${escapeHtml(sub.problem.name)}`;

      return `
        <tr>
          <td class="${verdictClass}">${escapeHtml(verdictText)}</td>
          <td>${problemLabel}</td>
          <td>${escapeHtml(sub.programmingLanguage)}</td>
          <td>${timeSec}s</td>
          <td>${memoryMb} MB</td>
          <td>${escapeHtml(formatAbsoluteDate(sub.creationTimeSeconds))}</td>
        </tr>`;
    }).join('\n');

    return `
    <div class="card">
      <h3 class="section-title">Your Submissions</h3>
      <table class="submissions-table">
        <thead>
          <tr>
            <th>Verdict</th>
            <th>Problem</th>
            <th>Language</th>
            <th>Time</th>
            <th>Memory</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
  }

  private static formatVerdict(verdict?: string): string {
    if (!verdict) {
      return 'Pending';
    }

    const map: Record<string, string> = {
      'OK': 'Accepted',
      'WRONG_ANSWER': 'Wrong Answer',
      'TIME_LIMIT_EXCEEDED': 'Time Limit',
      'MEMORY_LIMIT_EXCEEDED': 'Memory Limit',
      'RUNTIME_ERROR': 'Runtime Error',
      'COMPILATION_ERROR': 'Compilation Error',
      'PRESENTATION_ERROR': 'Presentation Error',
      'IDLENESS_LIMIT_EXCEEDED': 'Idleness Limit',
      'SECURITY_VIOLATED': 'Security Violated',
      'CRASHED': 'Crashed',
      'CHALLENGED': 'Challenged',
      'SKIPPED': 'Skipped',
      'TESTING': 'Testing',
      'PARTIAL': 'Partial',
      'FAILED': 'Failed',
      'REJECTED': 'Rejected',
      'INPUT_PREPARATION_CRASHED': 'Input Prep Crashed'
    };

    return map[verdict] || verdict.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }
}

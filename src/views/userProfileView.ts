import * as vscode from 'vscode';
import { codeforcesApi } from '../api';
import { RatingChange, Submission, User } from '../api/types';
import { UserAnalyticsSnapshot } from '../models/userAnalytics';
import { getAuthService } from '../services/authService';
import { getStorageService } from '../services/storageService';
import { getUserStatsService } from '../services/userStatsService';

interface UserTreeItem {
  type: 'header' | 'action' | 'metric' | 'recent-submissions' | 'submission' | 'section' | 'rating-bucket' | 'tag-stat' | 'status';
  label: string;
  description?: string;
  tooltip?: string;
  icon?: string;
  expanded?: boolean;
  section?: 'actions' | 'details' | 'performance' | 'rating' | 'tags';
  command?: vscode.Command;
  data?: unknown;
}

export class UserProfileView implements vscode.TreeDataProvider<UserTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<UserTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private user: User | undefined;
  private ratingHistory: RatingChange[] = [];
  private recentSubmissions: Submission[] = [];
  private analytics: UserAnalyticsSnapshot | undefined;
  private isLoading = false;
  private loadError: string | undefined;

  constructor() {
    const authService = getAuthService();
    authService.onDidChangeSession(() => this.refresh());
    this.refresh();
  }

  refresh(forceRefresh = false): void {
    void this.loadUserData(forceRefresh);
  }

  private async loadUserData(forceRefresh = false): Promise<void> {
    const authService = getAuthService();
    this.user = authService.getCurrentUser();
    this.loadError = undefined;

    if (!this.user) {
      this.analytics = undefined;
      this.recentSubmissions = [];
      this.ratingHistory = [];
      this.isLoading = false;
      this._onDidChangeTreeData.fire();
      return;
    }

    this.isLoading = true;
    this._onDidChangeTreeData.fire();

    try {
      this.ratingHistory = await codeforcesApi.getUserRating(this.user.handle);
      this.analytics = await getUserStatsService().getSnapshot(this.user.handle, forceRefresh);
      this.recentSubmissions = this.analytics.recentSubmissions;

      // Sync API-fetched solved problems into local storage so all views stay consistent
      if (this.analytics.solvedProblems.length > 0) {
        const storage = getStorageService();
        await storage.syncSolvedProblemsFromApi(this.analytics.solvedProblems);

        // Refresh the problems explorer to reflect updated solved status
        try {
          const { getProblemsExplorer } = await import('./problemsExplorer');
          getProblemsExplorer().refreshView();
        } catch {
          // Problems explorer may not be initialized yet
        }
      }
    } catch (error) {
      this.analytics = undefined;
      this.recentSubmissions = [];
      this.loadError = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to load user data:', error);
    } finally {
      this.isLoading = false;
      this._onDidChangeTreeData.fire();
    }
  }

  getTreeItem(element: UserTreeItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.label, this.getCollapsibleState(element));

    treeItem.description = element.description;
    treeItem.command = element.command;
    treeItem.tooltip = element.tooltip;

    if (element.icon) {
      treeItem.iconPath = new vscode.ThemeIcon(element.icon);
    }

    switch (element.type) {
      case 'header':
        treeItem.iconPath = new vscode.ThemeIcon('account');
        break;
      case 'action':
        treeItem.iconPath = new vscode.ThemeIcon(element.icon || 'arrow-right');
        break;
      case 'metric':
        treeItem.iconPath = new vscode.ThemeIcon(element.icon || 'dashboard');
        break;
      case 'recent-submissions':
        treeItem.iconPath = new vscode.ThemeIcon('history');
        break;
      case 'section':
        treeItem.iconPath = new vscode.ThemeIcon(this.getSectionIcon(element.section));
        break;
      case 'rating-bucket':
        treeItem.iconPath = new vscode.ThemeIcon('graph-left');
        break;
      case 'tag-stat':
        treeItem.iconPath = new vscode.ThemeIcon('tag');
        break;
      case 'status':
        treeItem.iconPath = this.loadError
          ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'))
          : new vscode.ThemeIcon(element.icon || 'loading~spin');
        break;
      case 'submission': {
        const submission = element.data as Submission;
        treeItem.iconPath = this.getVerdictIcon(submission.verdict);
        treeItem.tooltip = `${submission.problem.name}\n${submission.programmingLanguage}\n${submission.verdict}`;
        if (submission.problem.contestId) {
          treeItem.command = {
            command: 'codeforces.previewProblem',
            title: 'Preview Problem',
            arguments: [submission.problem.contestId, submission.problem.index, submission.problem.name]
          };
        }
        break;
      }
    }

    return treeItem;
  }

  getChildren(element?: UserTreeItem): UserTreeItem[] {
    if (this.isLoading && !this.analytics && !element) {
      return [{
        type: 'status',
        label: 'Loading profile snapshot...',
        description: 'Fetching rating history and submissions'
      }];
    }

    if (!this.user) {
      if (element) {
        return [];
      }

      return [{
        type: 'status',
        label: 'Login to view your profile',
        description: 'Show rating, solved stats, tags, and recent submissions',
        icon: 'sign-in',
        command: {
          command: 'codeforces.login',
          title: 'Login to Codeforces'
        }
      }];
    }

    if (!element) {
      const rootItems: UserTreeItem[] = [
        {
          type: 'header',
          label: this.user.handle,
          description: `${this.formatRank(this.user.rank)} • ${this.formatRating(this.user.rating)}`,
          tooltip: this.getUserTooltip(this.user)
        },
        {
          type: 'metric',
          label: 'Current Rating',
          description: this.formatRating(this.user.rating),
          icon: 'graph'
        },
        {
          type: 'metric',
          label: 'Solved Problems',
          description: this.analytics ? `${this.analytics.solvedProblemCount}` : 'Loading...',
          icon: 'check'
        },
        {
          type: 'metric',
          label: 'Acceptance Rate',
          description: this.analytics ? `${(this.analytics.acceptanceRate * 100).toFixed(1)}%` : 'Loading...',
          icon: 'pulse'
        },
        {
          type: 'metric',
          label: 'Current Streak',
          description: this.analytics ? `${this.analytics.currentStreak} day${this.analytics.currentStreak !== 1 ? 's' : ''}` : 'Loading...',
          icon: 'flame'
        },
        {
          type: 'metric',
          label: 'Longest Streak',
          description: this.analytics ? `${this.analytics.longestStreak} days` : 'Loading...',
          icon: 'trophy'
        },
        {
          type: 'section',
          label: 'Actions',
          section: 'actions',
          expanded: true
        },
        {
          type: 'section',
          label: 'Profile Details',
          section: 'details'
        },
        {
          type: 'section',
          label: 'Performance Snapshot',
          section: 'performance',
          expanded: true
        }
      ];

      if (this.analytics) {
        rootItems.push({
          type: 'metric',
          label: 'Last Sync',
          description: this.formatRelativeTime(this.analytics.fetchedAt),
          icon: 'history'
        });

        if (this.analytics.ratingBuckets.some(bucket => bucket.count > 0)) {
          rootItems.push({
            type: 'section',
            label: 'Problems by Rating',
            section: 'rating'
          });
        }

        if (this.analytics.topTags.length > 0) {
          rootItems.push({
            type: 'section',
            label: 'Top Tags',
            section: 'tags'
          });
        }
      }

      if (this.loadError) {
        rootItems.push({
          type: 'status',
          label: 'Statistics unavailable',
          description: this.loadError,
          icon: 'warning'
        });
      }

      rootItems.push({
        type: 'recent-submissions',
        label: 'Recent Submissions',
        description: `${this.recentSubmissions.length}`
      });

      return rootItems;
    }

    if (element.type === 'section' && element.section === 'actions') {
      return [
        {
          type: 'action',
          label: 'Show Full Profile Summary',
          description: 'Open the markdown summary view',
          icon: 'open-preview',
          command: {
            command: 'codeforces.showProfile',
            title: 'Show Profile'
          }
        },
        {
          type: 'action',
          label: 'Browse Solved Problems',
          description: 'Open the interactive solved problems browser',
          icon: 'checklist',
          command: {
            command: 'codeforces.showSolvedProblems',
            title: 'Show Solved Problems'
          }
        },
        {
          type: 'action',
          label: 'Refresh Profile Snapshot',
          description: 'Refetch rating history and submission analytics',
          icon: 'refresh',
          command: {
            command: 'codeforces.refreshProfile',
            title: 'Refresh Profile'
          }
        },
        {
          type: 'action',
          label: 'View Rating Graph',
          description: 'Open rating history chart',
          icon: 'graph-line',
          command: {
            command: 'codeforces.showRatingGraph',
            title: 'Show Rating Graph'
          }
        },
        {
          type: 'action',
          label: 'Open Codeforces Profile',
          description: 'Open your public profile in the browser',
          icon: 'globe',
          command: {
            command: 'codeforces.openProfileOnWeb',
            title: 'Open Codeforces Profile'
          }
        },
        {
          type: 'action',
          label: 'Configure API Credentials',
          description: 'Enable authenticated Codeforces features',
          icon: 'key',
          command: {
            command: 'codeforces.configureApiCredentials',
            title: 'Configure API Credentials'
          }
        },
        {
          type: 'action',
          label: 'Logout',
          description: 'Sign out from this extension session',
          icon: 'sign-out',
          command: {
            command: 'codeforces.logout',
            title: 'Logout'
          }
        }
      ];
    }

    if (element.type === 'section' && element.section === 'details') {
      return [
        {
          type: 'metric',
          label: 'Rank',
          description: this.formatRank(this.user.rank),
          icon: 'account'
        },
        {
          type: 'metric',
          label: 'Max Rating',
          description: `${this.formatRating(this.user.maxRating)} • ${this.formatRank(this.user.maxRank)}`,
          icon: 'arrow-up'
        },
        {
          type: 'metric',
          label: 'Contests',
          description: `${this.ratingHistory.length} rated entries`,
          icon: 'trophy'
        },
        {
          type: 'metric',
          label: 'Contribution',
          description: `${this.user.contribution}`,
          icon: 'heart'
        },
        {
          type: 'metric',
          label: 'Friend Of',
          description: `${this.user.friendOfCount}`,
          icon: 'organization'
        },
        {
          type: 'metric',
          label: 'Registered',
          description: this.formatAbsoluteDate(this.user.registrationTimeSeconds),
          icon: 'calendar'
        },
        {
          type: 'metric',
          label: 'Last Online',
          description: this.formatRelativeTime(this.user.lastOnlineTimeSeconds * 1000),
          icon: 'clock'
        },
        {
          type: 'metric',
          label: 'Organization',
          description: this.user.organization || 'Not set',
          icon: 'home'
        },
        {
          type: 'metric',
          label: 'Country',
          description: this.user.country || 'Not set',
          icon: 'location'
        }
      ];
    }

    if (element.type === 'section' && element.section === 'performance') {
      if (!this.analytics) {
        return [{
          type: 'status',
          label: this.isLoading ? 'Computing profile statistics...' : 'Profile statistics unavailable',
          description: this.loadError || 'Use Refresh Profile Snapshot to try again.',
          icon: this.loadError ? 'warning' : 'loading~spin'
        }];
      }

      const performanceItems: UserTreeItem[] = [
        {
          type: 'metric',
          label: 'Solved Problems',
          description: `${this.analytics.solvedProblemCount}`,
          icon: 'check'
        },
        {
          type: 'metric',
          label: 'Attempted Unsolved',
          description: `${this.analytics.attemptedUnsolvedCount}`,
          icon: 'circle-large-outline'
        },
        {
          type: 'metric',
          label: 'Accepted Submissions',
          description: `${this.analytics.acceptedSubmissionCount}/${this.analytics.analyzedSubmissionCount}`,
          icon: 'pass'
        },
        {
          type: 'metric',
          label: 'Snapshot Coverage',
          description: this.analytics.isPartial
            ? `Latest ${this.analytics.analyzedSubmissionCount} submissions`
            : `${this.analytics.analyzedSubmissionCount} submissions analyzed`,
          icon: 'pulse'
        }
      ];

      if (this.analytics.mostDifficultSolved) {
        performanceItems.push({
          type: 'metric',
          label: 'Hardest Solved',
          description: `${this.analytics.mostDifficultSolved.contestId}${this.analytics.mostDifficultSolved.index} • ${this.analytics.mostDifficultSolved.name}${this.analytics.mostDifficultSolved.rating ? ` • ${this.analytics.mostDifficultSolved.rating}` : ''}`,
          icon: 'flame'
        });
      }

      return performanceItems;
    }

    if (element.type === 'section' && element.section === 'rating') {
      return (this.analytics?.ratingBuckets || [])
        .filter(bucket => bucket.count > 0)
        .map(bucket => ({
          type: 'rating-bucket' as const,
          label: bucket.label,
          description: `${bucket.count} solved`
        }));
    }

    if (element.type === 'section' && element.section === 'tags') {
      return (this.analytics?.topTags || []).map(tag => ({
        type: 'tag-stat' as const,
        label: tag.tag,
        description: `${tag.count} solved`
      }));
    }

    if (element.type === 'recent-submissions') {
      return this.recentSubmissions.map(sub => ({
        type: 'submission' as const,
        label: `${sub.problem.contestId}${sub.problem.index}`,
        description: `${sub.verdict || 'TESTING'} • ${sub.programmingLanguage}`,
        data: sub
      }));
    }

    return [];
  }

  private getCollapsibleState(element: UserTreeItem): vscode.TreeItemCollapsibleState {
    if (element.type === 'recent-submissions' || element.type === 'section') {
      return element.expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed;
    }

    return vscode.TreeItemCollapsibleState.None;
  }

  private getSectionIcon(section: UserTreeItem['section']): string {
    switch (section) {
      case 'actions':
        return 'tools';
      case 'details':
        return 'list-tree';
      case 'performance':
        return 'dashboard';
      case 'rating':
        return 'graph';
      case 'tags':
        return 'tag';
      default:
        return 'chevron-right';
    }
  }

  private getUserTooltip(user: User): string {
    return [
      user.handle,
      `${this.formatRank(user.rank)} • ${this.formatRating(user.rating)}`,
      user.organization ? `Organization: ${user.organization}` : undefined,
      user.country ? `Country: ${user.country}` : undefined,
      `Friend of: ${user.friendOfCount}`
    ]
      .filter(Boolean)
      .join('\n');
  }

  private formatRank(rank: string | undefined): string {
    if (!rank) {
      return 'Unrated';
    }

    return rank
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private formatRating(rating: number | undefined): string {
    return typeof rating === 'number' && rating > 0 ? `${rating}` : 'Unrated';
  }

  private formatAbsoluteDate(timestampSeconds: number): string {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(timestampSeconds * 1000));
  }

  private formatRelativeTime(timestampMs: number): string {
    const diffMs = Date.now() - timestampMs;

    if (diffMs < 60_000) {
      return 'Just now';
    }

    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);
    if (days < 30) {
      return `${days}d ago`;
    }

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric'
    }).format(new Date(timestampMs));
  }

  private getVerdictIcon(verdict: string | undefined): vscode.ThemeIcon {
    switch (verdict) {
      case 'OK':
        return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
      case 'WRONG_ANSWER':
        return new vscode.ThemeIcon('x', new vscode.ThemeColor('charts.red'));
      case 'TIME_LIMIT_EXCEEDED':
        return new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.orange'));
      case 'MEMORY_LIMIT_EXCEEDED':
        return new vscode.ThemeIcon('database', new vscode.ThemeColor('charts.orange'));
      case 'RUNTIME_ERROR':
        return new vscode.ThemeIcon('bug', new vscode.ThemeColor('charts.red'));
      case 'COMPILATION_ERROR':
        return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
      case 'TESTING':
        return new vscode.ThemeIcon('loading~spin');
      default:
        return new vscode.ThemeIcon('question');
    }
  }

  async showRatingGraph(): Promise<void> {
    if (!this.user || this.ratingHistory.length === 0) {
      vscode.window.showInformationMessage('No rating history available');
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'codeforcesRatingGraph',
      `Rating Graph - ${this.user.handle}`,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = this.getRatingGraphHtml();
  }

  private getRatingGraphHtml(): string {
    if (!this.user) {
      return '';
    }

    const data = this.ratingHistory.map(r => ({
      contest: r.contestName,
      rating: r.newRating,
      delta: r.newRating - r.oldRating,
      rank: r.rank,
      time: r.ratingUpdateTimeSeconds
    }));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rating Graph</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      font-family: var(--vscode-font-family);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 20px;
    }
    h1 {
      text-align: center;
      color: var(--vscode-textLink-foreground);
    }
    .stats {
      display: flex;
      justify-content: center;
      gap: 40px;
      margin-bottom: 20px;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 2em;
      font-weight: bold;
    }
    .stat-label {
      color: var(--vscode-descriptionForeground);
    }
    .chart-container {
      width: 100%;
      height: 400px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    th {
      background-color: var(--vscode-editor-selectionBackground);
    }
    .positive { color: #4caf50; }
    .negative { color: #f44336; }
  </style>
</head>
<body>
  <h1>${this.user.handle}'s Rating History</h1>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${this.user.rating}</div>
      <div class="stat-label">Current Rating</div>
    </div>
    <div class="stat">
      <div class="stat-value">${this.user.maxRating}</div>
      <div class="stat-label">Max Rating</div>
    </div>
    <div class="stat">
      <div class="stat-value">${this.ratingHistory.length}</div>
      <div class="stat-label">Contests</div>
    </div>
  </div>

  <div class="chart-container">
    <canvas id="ratingChart"></canvas>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Contest</th>
        <th>Rank</th>
        <th>Rating</th>
        <th>Change</th>
      </tr>
    </thead>
    <tbody>
      ${this.ratingHistory.slice().reverse().map((r, i) => `
        <tr>
          <td>${this.ratingHistory.length - i}</td>
          <td>${r.contestName}</td>
          <td>${r.rank}</td>
          <td>${r.newRating}</td>
          <td class="${r.newRating - r.oldRating >= 0 ? 'positive' : 'negative'}">
            ${r.newRating - r.oldRating >= 0 ? '+' : ''}${r.newRating - r.oldRating}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <script>
    const ctx = document.getElementById('ratingChart').getContext('2d');
    const data = ${JSON.stringify(data)};

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i + 1),
        datasets: [{
          label: 'Rating',
          data: data.map(d => d.rating),
          borderColor: '#2196f3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          fill: true,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              title: function(context) {
                return data[context[0].dataIndex].contest;
              },
              label: function(context) {
                const d = data[context.dataIndex];
                return [
                  'Rating: ' + d.rating,
                  'Change: ' + (d.delta >= 0 ? '+' : '') + d.delta,
                  'Rank: ' + d.rank
                ];
              }
            }
          }
        },
        scales: {
          y: {
            min: Math.min(...data.map(d => d.rating)) - 100,
            max: Math.max(...data.map(d => d.rating)) + 100
          }
        }
      }
    });
  </script>
</body>
</html>`;
  }
}

let userProfileViewInstance: UserProfileView | undefined;

export function initUserProfileView(): UserProfileView {
  userProfileViewInstance = new UserProfileView();
  return userProfileViewInstance;
}

export function getUserProfileView(): UserProfileView {
  if (!userProfileViewInstance) {
    throw new Error('User profile view not initialized');
  }
  return userProfileViewInstance;
}

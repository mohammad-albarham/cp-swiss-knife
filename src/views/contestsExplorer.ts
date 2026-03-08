import * as vscode from 'vscode';
import { codeforcesApi } from '../api';
import { Contest } from '../api/types';
import { getStorageService } from '../services/storageService';

type ContestTreeItemType = 'category' | 'contest';

interface ContestTreeItem {
  type: ContestTreeItemType;
  label: string;
  contest?: Contest;
  category?: 'upcoming' | 'running' | 'recent' | 'gym';
}

export class ContestsExplorer implements vscode.TreeDataProvider<ContestTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ContestTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private contests: Contest[] = [];
  private gymContests: Contest[] = [];
  private isLoading = false;
  private statusBarItem: vscode.StatusBarItem;
  private refreshInterval: NodeJS.Timeout | undefined;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.loadContests();
    this.startAutoRefresh();
  }

  refresh(): void {
    this.loadContests(true);
  }

  private async loadContests(forceRefresh = false): Promise<void> {
    if (this.isLoading) { return; }

    this.isLoading = true;

    try {
      const storage = getStorageService();
      const cache = await storage.getContestsCache();

      // Use cache if valid (1 hour) and not forcing refresh
      if (!forceRefresh && cache && storage.isCacheValid(cache.timestamp, 60 * 60 * 1000)) {
        this.contests = cache.contests as Contest[];
      } else {
        // Fetch from API
        this.contests = await codeforcesApi.getContestList(false);

        const config = vscode.workspace.getConfiguration('codeforces');
        if (config.get<boolean>('includeGym')) {
          this.gymContests = await codeforcesApi.getContestList(true);
        }

        // Update cache
        await storage.setContestsCache(this.contests);
      }

      this.updateStatusBar();
      this._onDidChangeTreeData.fire();
      this.checkUpcomingContests();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to load contests: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      this.isLoading = false;
    }
  }

  private startAutoRefresh(): void {
    // Refresh every 5 minutes
    this.refreshInterval = setInterval(() => {
      this.loadContests(true);
    }, 5 * 60 * 1000);
  }

  private updateStatusBar(): void {
    const config = vscode.workspace.getConfiguration('codeforces');
    if (!config.get<boolean>('showStatusBar', true)) {
      this.statusBarItem.hide();
      return;
    }

    const running = this.getRunningContests();
    const upcoming = this.getUpcomingContests().slice(0, 1);

    if (running.length > 0) {
      const contest = running[0];
      const remaining = this.getTimeRemaining(contest);
      this.statusBarItem.text = `$(play) CF: ${remaining}`;
      this.statusBarItem.tooltip = `Running: ${contest.name}`;
      this.statusBarItem.command = 'codeforces.openContest';
    } else if (upcoming.length > 0) {
      const contest = upcoming[0];
      const until = this.getTimeUntil(contest);
      this.statusBarItem.text = `$(clock) CF: ${until}`;
      this.statusBarItem.tooltip = `Next: ${contest.name}`;
      this.statusBarItem.command = 'codeforces.viewContests';
    } else {
      this.statusBarItem.text = '$(code) Codeforces';
      this.statusBarItem.tooltip = 'Codeforces Extension';
      this.statusBarItem.command = 'codeforces.viewContests';
    }

    this.statusBarItem.show();
  }

  private checkUpcomingContests(): void {
    const config = vscode.workspace.getConfiguration('codeforces');
    if (!config.get<boolean>('contestReminders', true)) { return; }

    const reminderMinutes = config.get<number>('reminderMinutesBefore', 15);
    const upcoming = this.getUpcomingContests();

    for (const contest of upcoming) {
      if (!contest.startTimeSeconds) { continue; }

      const now = Math.floor(Date.now() / 1000);
      const startsIn = contest.startTimeSeconds - now;
      const reminderSeconds = reminderMinutes * 60;

      if (startsIn > 0 && startsIn <= reminderSeconds) {
        vscode.window.showInformationMessage(
          `Contest "${contest.name}" starts in ${Math.ceil(startsIn / 60)} minutes!`,
          'Register',
          'Open'
        ).then(choice => {
          if (choice === 'Register') {
            vscode.env.openExternal(
              vscode.Uri.parse(`https://codeforces.com/contestRegistration/${contest.id}`)
            );
          } else if (choice === 'Open') {
            vscode.env.openExternal(
              vscode.Uri.parse(`https://codeforces.com/contest/${contest.id}`)
            );
          }
        });
      }
    }
  }

  private getTimeRemaining(contest: Contest): string {
    if (!contest.startTimeSeconds || contest.relativeTimeSeconds === undefined) {
      return '';
    }

    const elapsed = contest.relativeTimeSeconds;
    const remaining = contest.durationSeconds - elapsed;

    if (remaining <= 0) { return 'Finished'; }

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }
    return `${minutes}m left`;
  }

  private getTimeUntil(contest: Contest): string {
    if (!contest.startTimeSeconds) { return ''; }

    const now = Math.floor(Date.now() / 1000);
    const until = contest.startTimeSeconds - now;

    if (until <= 0) { return 'Started'; }

    const days = Math.floor(until / 86400);
    const hours = Math.floor((until % 86400) / 3600);
    const minutes = Math.floor((until % 3600) / 60);

    if (days > 0) {
      return `in ${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    }
    return `in ${minutes}m`;
  }

  private getUpcomingContests(): Contest[] {
    return this.contests
      .filter(c => c.phase === 'BEFORE')
      .sort((a, b) => (a.startTimeSeconds || 0) - (b.startTimeSeconds || 0));
  }

  private getRunningContests(): Contest[] {
    return this.contests.filter(c => c.phase === 'CODING');
  }

  private getRecentContests(): Contest[] {
    return this.contests
      .filter(c => c.phase === 'FINISHED')
      .sort((a, b) => (b.startTimeSeconds || 0) - (a.startTimeSeconds || 0))
      .slice(0, 20);
  }

  getTreeItem(element: ContestTreeItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.label,
      element.type === 'contest'
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Expanded
    );

    if (element.type === 'contest' && element.contest) {
      const contest = element.contest;

      treeItem.contextValue = contest.phase === 'BEFORE' ? 'upcomingContest' : 'contest';

      // Description
      if (contest.phase === 'BEFORE' && contest.startTimeSeconds) {
        treeItem.description = this.getTimeUntil(contest);
      } else if (contest.phase === 'CODING') {
        treeItem.description = this.getTimeRemaining(contest);
      } else if (contest.startTimeSeconds) {
        const date = new Date(contest.startTimeSeconds * 1000);
        treeItem.description = date.toLocaleDateString();
      }

      // Icon based on phase
      switch (contest.phase) {
        case 'BEFORE':
          treeItem.iconPath = new vscode.ThemeIcon('calendar', new vscode.ThemeColor('charts.blue'));
          break;
        case 'CODING':
          treeItem.iconPath = new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('charts.green'));
          break;
        case 'PENDING_SYSTEM_TEST':
        case 'SYSTEM_TEST':
          treeItem.iconPath = new vscode.ThemeIcon('loading~spin');
          break;
        default:
          treeItem.iconPath = new vscode.ThemeIcon('check');
      }

      // Tooltip
      treeItem.tooltip = new vscode.MarkdownString();
      treeItem.tooltip.appendMarkdown(`**${contest.name}**\n\n`);
      treeItem.tooltip.appendMarkdown(`Type: ${contest.type}\n\n`);
      treeItem.tooltip.appendMarkdown(`Duration: ${Math.floor(contest.durationSeconds / 3600)}h ${Math.floor((contest.durationSeconds % 3600) / 60)}m\n\n`);
      if (contest.startTimeSeconds) {
        const date = new Date(contest.startTimeSeconds * 1000);
        treeItem.tooltip.appendMarkdown(`Start: ${date.toLocaleString()}`);
      }

      // Command to open contest
      treeItem.command = {
        command: 'codeforces.openContest',
        title: 'Open Contest',
        arguments: [contest]
      };
    } else {
      // Category icons
      switch (element.category) {
        case 'running':
          treeItem.iconPath = new vscode.ThemeIcon('play-circle');
          break;
        case 'upcoming':
          treeItem.iconPath = new vscode.ThemeIcon('calendar');
          break;
        case 'recent':
          treeItem.iconPath = new vscode.ThemeIcon('history');
          break;
        case 'gym':
          treeItem.iconPath = new vscode.ThemeIcon('beaker');
          break;
      }
    }

    return treeItem;
  }

  getChildren(element?: ContestTreeItem): ContestTreeItem[] {
    if (!element) {
      // Root level categories
      const categories: ContestTreeItem[] = [];

      const running = this.getRunningContests();
      if (running.length > 0) {
        categories.push({
          type: 'category',
          label: `Running (${running.length})`,
          category: 'running'
        });
      }

      const upcoming = this.getUpcomingContests();
      if (upcoming.length > 0) {
        categories.push({
          type: 'category',
          label: `Upcoming (${upcoming.length})`,
          category: 'upcoming'
        });
      }

      categories.push({
        type: 'category',
        label: 'Recent',
        category: 'recent'
      });

      const config = vscode.workspace.getConfiguration('codeforces');
      if (config.get<boolean>('includeGym') && this.gymContests.length > 0) {
        categories.push({
          type: 'category',
          label: `Gym (${this.gymContests.length})`,
          category: 'gym'
        });
      }

      return categories;
    }

    // Contest list for each category
    let contests: Contest[] = [];

    switch (element.category) {
      case 'running':
        contests = this.getRunningContests();
        break;
      case 'upcoming':
        contests = this.getUpcomingContests();
        break;
      case 'recent':
        contests = this.getRecentContests();
        break;
      case 'gym':
        contests = this.gymContests.slice(0, 50);
        break;
    }

    return contests.map(contest => ({
      type: 'contest' as ContestTreeItemType,
      label: contest.name,
      contest
    }));
  }

  dispose(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.statusBarItem.dispose();
  }
}

let contestsExplorerInstance: ContestsExplorer | undefined;

export function initContestsExplorer(): ContestsExplorer {
  contestsExplorerInstance = new ContestsExplorer();
  return contestsExplorerInstance;
}

export function getContestsExplorer(): ContestsExplorer {
  if (!contestsExplorerInstance) {
    throw new Error('Contests explorer not initialized');
  }
  return contestsExplorerInstance;
}

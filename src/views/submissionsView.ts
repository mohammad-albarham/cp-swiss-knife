import * as vscode from 'vscode';
import { codeforcesApi } from '../api';
import { Submission, Verdict } from '../api/types';
import { getAuthService } from '../services/authService';
import { logger } from '../utils/logger';

interface SubmissionTreeItem {
  type: 'submission' | 'filter' | 'status' | 'header';
  label: string;
  description?: string;
  submission?: Submission;
  filter?: VerdictFilter;
  command?: vscode.Command;
}

export type VerdictFilter = 'all' | 'accepted' | 'wrong-answer' | 'runtime-error' | 'time-limit' | 'memory-limit' | 'compilation-error';

export class SubmissionsView implements vscode.TreeDataProvider<SubmissionTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SubmissionTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private submissions: Submission[] = [];
  private isLoading = false;
  private loadError: string | undefined;
  private currentFilter: VerdictFilter = 'all';

  constructor() {
    const authService = getAuthService();
    authService.onDidChangeSession(() => this.refresh());
    this.refresh();
  }

  refresh(): void {
    this.loadError = undefined;
    void this.loadSubmissions();
  }

  setFilter(filter: VerdictFilter): void {
    this.currentFilter = filter;
    this._onDidChangeTreeData.fire();
  }

  private async loadSubmissions(): Promise<void> {
    const authService = getAuthService();
    const user = authService.getCurrentUser();

    if (!user) {
      this.submissions = [];
      this.isLoading = false;
      this._onDidChangeTreeData.fire();
      return;
    }

    this.isLoading = true;
    this._onDidChangeTreeData.fire();

    try {
      // Load last 100 submissions
      this.submissions = await codeforcesApi.getUserStatus(user.handle, { count: 100 });
      this.loadError = undefined;
    } catch (error) {
      this.submissions = [];
      this.loadError = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to load submissions', error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isLoading = false;
      this._onDidChangeTreeData.fire();
    }
  }

  getTreeItem(element: SubmissionTreeItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.label,
      element.type === 'header' ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
    );

    treeItem.description = element.description;
    treeItem.command = element.command;

    switch (element.type) {
      case 'submission': {
        const submission = element.submission!;
        treeItem.iconPath = this.getVerdictIcon(submission.verdict);
        treeItem.tooltip = this.getSubmissionTooltip(submission);
        treeItem.contextValue = 'submission';
        break;
      }
      case 'filter':
        treeItem.iconPath = new vscode.ThemeIcon('filter');
        treeItem.contextValue = 'filter';
        break;
      case 'status':
        treeItem.iconPath = this.loadError
          ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.red'))
          : new vscode.ThemeIcon('loading~spin');
        break;
      case 'header':
        treeItem.iconPath = new vscode.ThemeIcon('list-tree');
        break;
    }

    return treeItem;
  }

  getChildren(element?: SubmissionTreeItem): SubmissionTreeItem[] {
    if (!element) {
      const authService = getAuthService();
      const user = authService.getCurrentUser();

      if (!user) {
        return [{
          type: 'status',
          label: 'Login to view your submissions',
          description: 'Track your submission history and verdicts',
          command: {
            command: 'codeforces.login',
            title: 'Login to Codeforces'
          }
        }];
      }

      if (this.isLoading && this.submissions.length === 0) {
        return [{
          type: 'status',
          label: 'Loading submissions...',
          description: 'Fetching your submission history'
        }];
      }

      if (this.loadError && this.submissions.length === 0) {
        return [{
          type: 'status',
          label: 'Failed to load submissions',
          description: this.loadError
        }];
      }

      // Root level - show filters header then submissions
      const items: SubmissionTreeItem[] = [];

      // Add filter header (collapsible, contains filter options)
      items.push({
        type: 'header',
        label: 'Filters',
        description: `Current: ${this.getFilterLabel(this.currentFilter)}`
      });

      // Add submissions directly at root level
      const filtered = this.getFilteredSubmissions();
      items.push(...filtered.map(sub => this.createSubmissionItem(sub)));

      return items;
    }

    if (element.type === 'header' && element.label === 'Filters') {
      return this.getFilterItems();
    }

    return [];
  }

  private getFilterItems(): SubmissionTreeItem[] {
    const filters: VerdictFilter[] = [
      'all',
      'accepted',
      'wrong-answer',
      'runtime-error',
      'time-limit',
      'memory-limit',
      'compilation-error'
    ];

    return filters.map(filter => {
      const count = this.getFilteredSubmissionsCount(filter);
      const isActive = this.currentFilter === filter;
      return {
        type: 'filter' as const,
        label: `${isActive ? '● ' : ''}${this.getFilterLabel(filter)}`,
        description: `${count} submissions`,
        filter,
        command: {
          command: 'codeforces.filterSubmissions',
          title: 'Filter Submissions',
          arguments: [filter]
        }
      };
    });
  }

  private getFilteredSubmissions(): Submission[] {
    switch (this.currentFilter) {
      case 'all':
        return this.submissions;
      case 'accepted':
        return this.submissions.filter(s => s.verdict === 'OK');
      case 'wrong-answer':
        return this.submissions.filter(s => s.verdict === 'WRONG_ANSWER');
      case 'runtime-error':
        return this.submissions.filter(s => s.verdict === 'RUNTIME_ERROR');
      case 'time-limit':
        return this.submissions.filter(s => s.verdict === 'TIME_LIMIT_EXCEEDED');
      case 'memory-limit':
        return this.submissions.filter(s => s.verdict === 'MEMORY_LIMIT_EXCEEDED');
      case 'compilation-error':
        return this.submissions.filter(s => s.verdict === 'COMPILATION_ERROR');
      default:
        return this.submissions;
    }
  }

  private getFilteredSubmissionsCount(filter: VerdictFilter): number {
    switch (filter) {
      case 'all':
        return this.submissions.length;
      case 'accepted':
        return this.submissions.filter(s => s.verdict === 'OK').length;
      case 'wrong-answer':
        return this.submissions.filter(s => s.verdict === 'WRONG_ANSWER').length;
      case 'runtime-error':
        return this.submissions.filter(s => s.verdict === 'RUNTIME_ERROR').length;
      case 'time-limit':
        return this.submissions.filter(s => s.verdict === 'TIME_LIMIT_EXCEEDED').length;
      case 'memory-limit':
        return this.submissions.filter(s => s.verdict === 'MEMORY_LIMIT_EXCEEDED').length;
      case 'compilation-error':
        return this.submissions.filter(s => s.verdict === 'COMPILATION_ERROR').length;
      default:
        return this.submissions.length;
    }
  }

  private createSubmissionItem(submission: Submission): SubmissionTreeItem {
    const problem = submission.problem;
    const label = `${problem.contestId}${problem.index} - ${problem.name}`;
    const verdict = this.formatVerdict(submission.verdict);
    const time = this.formatTime(submission.creationTimeSeconds);

    return {
      type: 'submission',
      label,
      description: `${verdict} • ${time}`,
      submission,
      command: {
        command: 'codeforces.previewProblem',
        title: 'Preview Problem',
        arguments: [problem.contestId, problem.index, problem.name]
      }
    };
  }

  private getFilterLabel(filter: VerdictFilter): string {
    switch (filter) {
      case 'all': return 'All Submissions';
      case 'accepted': return 'Accepted';
      case 'wrong-answer': return 'Wrong Answer';
      case 'runtime-error': return 'Runtime Error';
      case 'time-limit': return 'Time Limit Exceeded';
      case 'memory-limit': return 'Memory Limit Exceeded';
      case 'compilation-error': return 'Compilation Error';
      default: return 'All';
    }
  }

  private formatVerdict(verdict?: Verdict): string {
    if (!verdict) { return 'TESTING'; }

    const verdictMap: Record<string, string> = {
      'OK': 'AC',
      'WRONG_ANSWER': 'WA',
      'TIME_LIMIT_EXCEEDED': 'TLE',
      'MEMORY_LIMIT_EXCEEDED': 'MLE',
      'RUNTIME_ERROR': 'RTE',
      'COMPILATION_ERROR': 'CE',
      'TESTING': 'Testing',
      'SKIPPED': 'Skipped'
    };

    return verdictMap[verdict] || verdict;
  }

  private formatTime(timestampSeconds: number): string {
    const date = new Date(timestampSeconds * 1000);
    const now = Date.now();
    const diffMs = now - date.getTime();

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
    }).format(date);
  }

  private getVerdictIcon(verdict?: Verdict): vscode.ThemeIcon {
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

  private getSubmissionTooltip(submission: Submission): string {
    const parts: string[] = [
      `Problem: ${submission.problem.contestId}${submission.problem.index} - ${submission.problem.name}`,
      `Verdict: ${submission.verdict || 'TESTING'}`,
      `Language: ${submission.programmingLanguage}`,
      `Time: ${submission.timeConsumedMillis}ms`,
      `Memory: ${Math.round(submission.memoryConsumedBytes / 1024)}KB`
    ];

    if (submission.passedTestCount) {
      parts.push(`Passed Tests: ${submission.passedTestCount}`);
    }

    return parts.join('\n');
  }
}

let submissionsViewInstance: SubmissionsView | undefined;

export function initSubmissionsView(): SubmissionsView {
  submissionsViewInstance = new SubmissionsView();
  return submissionsViewInstance;
}

export function getSubmissionsView(): SubmissionsView {
  if (!submissionsViewInstance) {
    throw new Error('Submissions view not initialized');
  }
  return submissionsViewInstance;
}

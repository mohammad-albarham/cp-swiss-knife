import * as vscode from 'vscode';
import { codeforcesApi } from '../api';
import { Problem, ProblemStatistics, ProblemFilter, getRatingThemeColor } from '../api/types';
import { getStorageService } from '../services/storageService';
import { getAuthService } from '../services/authService';
import { logger } from '../utils/logger';

type TreeItemType = 'category' | 'rating-category' | 'tag-category' | 'problem' | 'status';

interface ProblemTreeItem {
  type: TreeItemType;
  label: string;
  problem?: Problem;
  statistics?: ProblemStatistics;
  children?: ProblemTreeItem[];
  filter?: Partial<ProblemFilter>;
  description?: string;
}

export class ProblemsExplorer implements vscode.TreeDataProvider<ProblemTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ProblemTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private problems: Problem[] = [];
  private statistics: Map<string, ProblemStatistics> = new Map();
  private filter: ProblemFilter = {};
  private isLoading = false;
  private lastError: string | undefined;

  constructor() {
    this.loadProblems();
  }

  refresh(): void {
    this.lastError = undefined;
    this.loadProblems(true);
  }

  refreshView(): void {
    this._onDidChangeTreeData.fire();
  }

  setFilter(filter: ProblemFilter): void {
    this.filter = filter;
    this._onDidChangeTreeData.fire();
  }

  clearFilter(): void {
    this.filter = {};
    this._onDidChangeTreeData.fire();
  }

  getProblems(): Problem[] {
    return this.problems;
  }

  private async loadProblems(forceRefresh = false): Promise<void> {
    if (this.isLoading) { return; }

    this.isLoading = true;
    this._onDidChangeTreeData.fire();

    try {
      const storage = getStorageService();
      const cache = await storage.getProblemsCache();

      // Use cache if valid (24 hours) and not forcing refresh
      if (!forceRefresh && cache && storage.isCacheValid(cache.timestamp, 24 * 60 * 60 * 1000)) {
        this.problems = cache.problems as Problem[];
        for (const stat of cache.statistics as ProblemStatistics[]) {
          const key = `${stat.contestId}-${stat.index}`;
          this.statistics.set(key, stat);
        }
      } else {
        // Fetch from API
        const result = await codeforcesApi.getProblemsetProblems();
        this.problems = result.problems;

        for (const stat of result.problemStatistics) {
          const key = `${stat.contestId}-${stat.index}`;
          this.statistics.set(key, stat);
        }

        // Update cache
        await storage.setProblemsCache(this.problems, result.problemStatistics);
      }

      this.lastError = undefined;
      this._onDidChangeTreeData.fire();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to load problems', error instanceof Error ? error : new Error(String(error)));
      vscode.window.showErrorMessage(
        `Failed to load problems: ${this.lastError}`
      );
      this._onDidChangeTreeData.fire();
    } finally {
      this.isLoading = false;
      this._onDidChangeTreeData.fire();
    }
  }

  getTreeItem(element: ProblemTreeItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.label,
      element.type === 'problem'
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    if (element.type === 'problem' && element.problem) {
      const problem = element.problem;
      const stat = this.statistics.get(`${problem.contestId}-${problem.index}`);
      const storage = getStorageService();

      // Set context for menu items
      treeItem.contextValue = 'problem';

      // Description with rating and solve count
      const parts: string[] = [];
      if (problem.rating) {
        parts.push(`${problem.rating}`);
      }
      if (stat) {
        parts.push(`solved: ${stat.solvedCount}`);
      }
      treeItem.description = parts.join(' • ');

      // Tooltip
      treeItem.tooltip = new vscode.MarkdownString();
      treeItem.tooltip.appendMarkdown(`**${problem.contestId}${problem.index} - ${problem.name}**\n\n`);
      if (problem.rating) {
        treeItem.tooltip.appendMarkdown(`Rating: ${problem.rating}\n\n`);
      }
      if (problem.tags.length > 0) {
        treeItem.tooltip.appendMarkdown(`Tags: ${problem.tags.join(', ')}\n\n`);
      }
      if (stat) {
        treeItem.tooltip.appendMarkdown(`Solved by: ${stat.solvedCount} users`);
      }

      // Icon based on status
      if (problem.contestId && storage.isSolved(problem.contestId, problem.index)) {
        treeItem.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
      } else if (problem.contestId && storage.isStarred(problem.contestId, problem.index)) {
        treeItem.iconPath = new vscode.ThemeIcon('star-full', new vscode.ThemeColor('charts.yellow'));
      } else {
        // Color based on difficulty
        if (problem.rating) {
          const themeColorId = getRatingThemeColor(problem.rating);
          treeItem.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor(themeColorId));
        } else {
          treeItem.iconPath = new vscode.ThemeIcon('circle-outline');
        }
      }

      // Command to open problem
      treeItem.command = {
        command: 'codeforces.previewProblem',
        title: 'Preview Problem',
        arguments: [problem.contestId, problem.index, problem.name]
      };
    } else if (element.type === 'status') {
      treeItem.description = element.description;
      treeItem.contextValue = 'problem-status';

      if (this.lastError) {
        treeItem.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.red'));
        treeItem.command = {
          command: 'codeforces.refreshProblems',
          title: 'Retry Loading Problems'
        };
      } else {
        treeItem.iconPath = new vscode.ThemeIcon('loading~spin');
      }
    } else {
      // Category icons
      switch (element.type) {
        case 'rating-category':
          treeItem.iconPath = new vscode.ThemeIcon('graph');
          break;
        case 'tag-category':
          treeItem.iconPath = new vscode.ThemeIcon('tag');
          break;
        default:
          treeItem.iconPath = new vscode.ThemeIcon('folder');
      }
    }

    return treeItem;
  }

  getChildren(element?: ProblemTreeItem): ProblemTreeItem[] {
    if (!element) {
      if (this.isLoading && this.problems.length === 0) {
        return [{ type: 'status', label: 'Loading problems...' }];
      }

      if (this.lastError && this.problems.length === 0) {
        return [{
          type: 'status',
          label: 'Failed to load problems',
          description: this.lastError
        }];
      }

      // Root level - show categories
      return this.getRootCategories();
    }

    if (element.type === 'category' && element.label === 'Daily Problem') {
      return this.getDailyProblem();
    }

    if (element.type === 'category' && element.label === 'By Rating') {
      return this.getRatingCategories();
    }

    if (element.type === 'category' && element.label === 'By Tags') {
      return this.getTagCategories();
    }

    if (element.type === 'category' && element.label === 'Solved Problems') {
      return this.getSolvedProblems();
    }

    if (element.type === 'category' && element.label === 'Recommended') {
      return this.getRecommendedProblems();
    }

    if (element.type === 'category' && element.label === 'Starred') {
      return this.getStarredProblems();
    }

    if (element.type === 'rating-category') {
      return this.getProblemsByRating(element.filter!);
    }

    if (element.type === 'tag-category') {
      return this.getProblemsByTag(element.filter!);
    }

    return [];
  }

  private getRootCategories(): ProblemTreeItem[] {
    const storage = getStorageService();
    const authService = getAuthService();
    const solvedCount = storage.getSolvedProblems().length;
    const starredCount = storage.getStarredProblems().length;
    const isLoggedIn = authService.isLoggedIn();

    const categories: ProblemTreeItem[] = [];

    categories.push({
      type: 'category',
      label: 'Daily Problem',
      description: 'Problem of the day'
    });

    if (isLoggedIn) {
      categories.push({
        type: 'category',
        label: 'Recommended',
        description: 'Problems for you'
      });
    }

    categories.push(
      {
        type: 'category',
        label: 'Solved Problems',
        description: `${solvedCount} solved`
      },
      {
        type: 'category',
        label: 'Starred',
        description: `${starredCount} starred`
      },
      { type: 'category', label: 'By Rating' },
      { type: 'category', label: 'By Tags' }
    );

    return categories;
  }

  private getRatingCategories(): ProblemTreeItem[] {
    const ranges = [
      { min: 800, max: 1000 },
      { min: 1000, max: 1200 },
      { min: 1200, max: 1400 },
      { min: 1400, max: 1600 },
      { min: 1600, max: 1800 },
      { min: 1800, max: 2000 },
      { min: 2000, max: 2200 },
      { min: 2200, max: 2400 },
      { min: 2400, max: 2600 },
      { min: 2600, max: 2800 },
      { min: 2800, max: 3000 },
      { min: 3000, max: 3500 }
    ];

    return ranges.map(range => {
      const count = this.problems.filter(
        p => p.rating && p.rating >= range.min && p.rating < range.max
      ).length;

      return {
        type: 'rating-category' as TreeItemType,
        label: `${range.min}-${range.max} (${count})`,
        filter: { ratingMin: range.min, ratingMax: range.max }
      };
    });
  }

  private getTagCategories(): ProblemTreeItem[] {
    const tagCounts = new Map<string, number>();

    for (const problem of this.problems) {
      for (const tag of problem.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([tag, count]) => ({
        type: 'tag-category' as TreeItemType,
        label: `${tag} (${count})`,
        filter: { tags: [tag] }
      }));
  }

  private getDailyProblem(): ProblemTreeItem[] {
    const authService = getAuthService();
    const storage = getStorageService();
    const user = authService.getCurrentUser();
    const userRating = user?.rating ?? 1200;
    const seed = Math.floor(Date.now() / 86400000);
    const solved = new Set(storage.getSolvedProblems().map(p => `${p.contestId}${p.index}`));

    const eligible = this.problems.filter(p => {
      if (!p.rating) { return false; }
      if (solved.has(`${p.contestId}${p.index}`)) { return false; }
      return p.rating >= userRating - 100 && p.rating <= userRating + 300;
    });

    if (eligible.length === 0) {
      return [{ type: 'status', label: 'No eligible daily problem', description: 'Solve more problems to unlock' }];
    }

    const problem = eligible[seed % eligible.length];
    const stat = this.statistics.get(`${problem.contestId}-${problem.index}`);
    return [{
      type: 'problem' as TreeItemType,
      label: `${problem.contestId}${problem.index} - ${problem.name}`,
      description: problem.rating ? `${problem.rating}` : undefined,
      problem,
      statistics: stat
    }];
  }

  private getRecommendedProblems(): ProblemTreeItem[] {
    const authService = getAuthService();
    const storage = getStorageService();
    const user = authService.getCurrentUser();

    if (!user) {
      return [{
        type: 'status',
        label: 'Login to see recommendations',
        description: 'Get personalized problem recommendations'
      }];
    }

    const userRating = user.rating || 800;
    const solved = new Set(
      storage.getSolvedProblems().map(p => `${p.contestId}${p.index}`)
    );

    // Recommend problems within user's rating range (±200)
    const recommendedProblems = this.problems
      .filter(p => {
        if (!p.rating) { return false; }
        if (solved.has(`${p.contestId}${p.index}`)) { return false; }

        const ratingDiff = Math.abs(p.rating - userRating);
        return ratingDiff <= 200;
      })
      .sort((a, b) => {
        // Sort by closeness to user rating
        const aDiff = Math.abs((a.rating || 0) - userRating);
        const bDiff = Math.abs((b.rating || 0) - userRating);
        return aDiff - bDiff;
      })
      .slice(0, 20); // Top 20 recommendations

    if (recommendedProblems.length === 0) {
      return [{
        type: 'status',
        label: 'No recommendations available',
        description: 'Solve more problems to get better recommendations'
      }];
    }

    return recommendedProblems.map(problem => {
      const stat = this.statistics.get(`${problem.contestId}-${problem.index}`);
      return {
        type: 'problem' as TreeItemType,
        label: `${problem.contestId}${problem.index} - ${problem.name}`,
        description: problem.rating ? `${problem.rating}` : undefined,
        problem,
        statistics: stat
      };
    });
  }

  private getSolvedProblems(): ProblemTreeItem[] {
    const storage = getStorageService();
    const solved = storage.getSolvedProblems();
    const result: ProblemTreeItem[] = [];

    // Sort by solve date (most recent first)
    const sortedSolved = [...solved].sort((a, b) => b.solvedAt - a.solvedAt);

    for (const s of sortedSolved) {
      const problem = this.problems.find(
        p => p.contestId === s.contestId && p.index === s.index
      );
      if (!problem) { continue; }

      const stat = this.statistics.get(`${problem.contestId}-${problem.index}`);

      // Format the solved date
      const solvedDate = new Date(s.solvedAt);
      const daysAgo = Math.floor((Date.now() - s.solvedAt) / (1000 * 60 * 60 * 24));
      const dateStr = daysAgo === 0 ? 'Today' :
                      daysAgo === 1 ? 'Yesterday' :
                      daysAgo < 7 ? `${daysAgo}d ago` :
                      solvedDate.toLocaleDateString();

      result.push({
        type: 'problem' as TreeItemType,
        label: `${problem.contestId}${problem.index} - ${problem.name}`,
        description: `${dateStr}${problem.rating ? ` • ${problem.rating}` : ''}`,
        problem,
        statistics: stat
      });
    }

    if (result.length === 0) {
      return [{
        type: 'status',
        label: 'No solved problems yet',
        description: 'Problems marked as solved will appear here'
      }];
    }

    return result;
  }

  private getStarredProblems(): ProblemTreeItem[] {
    const storage = getStorageService();
    const starred = storage.getStarredProblems();
    const result: ProblemTreeItem[] = [];

    for (const s of starred) {
      const problem = this.problems.find(
        p => p.contestId === s.contestId && p.index === s.index
      );
      if (!problem) { continue; }

      const stat = this.statistics.get(`${problem.contestId}-${problem.index}`);
      result.push({
        type: 'problem' as TreeItemType,
        label: `${problem.contestId}${problem.index} - ${problem.name}`,
        problem,
        statistics: stat
      });
    }

    if (result.length === 0) {
      return [{
        type: 'status',
        label: 'No starred problems',
        description: 'Star problems to save them for later'
      }];
    }

    return result;
  }

  private getProblemsByRating(filter: Partial<ProblemFilter>): ProblemTreeItem[] {
    return this.problems
      .filter(p => {
        if (!p.rating) { return false; }
        if (filter.ratingMin && p.rating < filter.ratingMin) { return false; }
        if (filter.ratingMax && p.rating >= filter.ratingMax) { return false; }
        return true;
      })
      .sort((a, b) => (a.rating || 0) - (b.rating || 0))
      .slice(0, 200) // Limit for performance
      .map(problem => {
        const stat = this.statistics.get(`${problem.contestId}-${problem.index}`);
        return {
          type: 'problem' as TreeItemType,
          label: `${problem.contestId}${problem.index} - ${problem.name}`,
          problem,
          statistics: stat
        };
      });
  }

  private getProblemsByTag(filter: Partial<ProblemFilter>): ProblemTreeItem[] {
    if (!filter.tags || filter.tags.length === 0) { return []; }
    const tag = filter.tags[0];

    return this.problems
      .filter(p => p.tags.includes(tag))
      .sort((a, b) => (a.rating || 0) - (b.rating || 0))
      .slice(0, 200) // Limit for performance
      .map(problem => {
        const stat = this.statistics.get(`${problem.contestId}-${problem.index}`);
        return {
          type: 'problem' as TreeItemType,
          label: `${problem.contestId}${problem.index} - ${problem.name}`,
          problem,
          statistics: stat
        };
      });
  }

  async searchProblems(): Promise<void> {
    const query = await vscode.window.showInputBox({
      prompt: 'Search problems by name or ID',
      placeHolder: 'e.g., "watermelon" or "4A"'
    });

    if (!query) { return; }

    const lowerQuery = query.toLowerCase();
    const results = this.problems.filter(p => {
      const id = `${p.contestId}${p.index}`.toLowerCase();
      const name = p.name.toLowerCase();
      return id.includes(lowerQuery) || name.includes(lowerQuery);
    }).slice(0, 50);

    if (results.length === 0) {
      vscode.window.showInformationMessage('No problems found matching your query');
      return;
    }

    const items = results.map(p => ({
      label: `${p.contestId}${p.index} - ${p.name}`,
      description: p.rating ? `Rating: ${p.rating}` : undefined,
      detail: p.tags.join(', '),
      problem: p
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a problem',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      vscode.commands.executeCommand(
        'codeforces.previewProblem',
        selected.problem.contestId,
        selected.problem.index,
        selected.problem.name
      );
    }
  }
}

let problemsExplorerInstance: ProblemsExplorer | undefined;

export function initProblemsExplorer(): ProblemsExplorer {
  problemsExplorerInstance = new ProblemsExplorer();
  return problemsExplorerInstance;
}

export function getProblemsExplorer(): ProblemsExplorer {
  if (!problemsExplorerInstance) {
    throw new Error('Problems explorer not initialized');
  }
  return problemsExplorerInstance;
}

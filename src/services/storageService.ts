import * as vscode from 'vscode';
import { UserSession, StarredProblem, SolvedProblem } from '../api/types';
import { UserAnalyticsSnapshot } from '../models/userAnalytics';

const STORAGE_KEYS = {
  session: 'codeforces.session',
  starred: 'codeforces.starred',
  solved: 'codeforces.solved',
  userAnalytics: 'codeforces.user.analytics',
  problemsCache: 'codeforces.problems.cache',
  contestsCache: 'codeforces.contests.cache',
  lastCacheUpdate: 'codeforces.cache.lastUpdate'
};

export class StorageService {
  private context: vscode.ExtensionContext;
  private secretStorage: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.secretStorage = context.secrets;
  }

  // Session management
  async getSession(): Promise<UserSession | undefined> {
    const sessionStr = await this.secretStorage.get(STORAGE_KEYS.session);
    if (sessionStr) {
      try {
        return JSON.parse(sessionStr) as UserSession;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  async saveSession(session: UserSession): Promise<void> {
    await this.secretStorage.store(STORAGE_KEYS.session, JSON.stringify(session));
  }

  async clearSession(): Promise<void> {
    await this.secretStorage.delete(STORAGE_KEYS.session);
  }

  // Starred problems
  getStarredProblems(): StarredProblem[] {
    return this.context.globalState.get<StarredProblem[]>(STORAGE_KEYS.starred, []);
  }

  async addStarredProblem(contestId: number, index: string): Promise<void> {
    const starred = this.getStarredProblems();
    const exists = starred.some(p => p.contestId === contestId && p.index === index);
    if (!exists) {
      starred.push({ contestId, index, addedAt: Date.now() });
      await this.context.globalState.update(STORAGE_KEYS.starred, starred);
    }
  }

  async removeStarredProblem(contestId: number, index: string): Promise<void> {
    const starred = this.getStarredProblems();
    const filtered = starred.filter(p => !(p.contestId === contestId && p.index === index));
    await this.context.globalState.update(STORAGE_KEYS.starred, filtered);
  }

  isStarred(contestId: number, index: string): boolean {
    const starred = this.getStarredProblems();
    return starred.some(p => p.contestId === contestId && p.index === index);
  }

  // Solved problems tracking
  getSolvedProblems(): SolvedProblem[] {
    return this.context.globalState.get<SolvedProblem[]>(STORAGE_KEYS.solved, []);
  }

  async addSolvedProblem(
    contestId: number,
    index: string,
    submissionId: number,
    source: 'submission' | 'local' = 'submission'
  ): Promise<void> {
    const solved = this.getSolvedProblems();
    const exists = solved.some(p => p.contestId === contestId && p.index === index);
    if (!exists) {
      solved.push({ contestId, index, solvedAt: Date.now(), submissionId, source });
      await this.context.globalState.update(STORAGE_KEYS.solved, solved);
    }
  }

  async addLocallySolvedProblem(contestId: number, index: string): Promise<void> {
    await this.addSolvedProblem(contestId, index, 0, 'local');
  }

  isSolved(contestId: number, index: string): boolean {
    const solved = this.getSolvedProblems();
    return solved.some(p => p.contestId === contestId && p.index === index);
  }

  async syncSolvedProblemsFromApi(problems: { contestId: number; index: string }[]): Promise<void> {
    const solved = this.getSolvedProblems();
    const existing = new Set(solved.map(p => `${p.contestId}-${p.index}`));
    let changed = false;

    for (const problem of problems) {
      const key = `${problem.contestId}-${problem.index}`;
      if (!existing.has(key)) {
        solved.push({
          contestId: problem.contestId,
          index: problem.index,
          solvedAt: Date.now(),
          submissionId: 0,
          source: 'api'
        });
        existing.add(key);
        changed = true;
      }
    }

    if (changed) {
      await this.context.globalState.update(STORAGE_KEYS.solved, solved);
    }
  }

  getUserAnalyticsCache(handle: string): UserAnalyticsSnapshot | undefined {
    const cache = this.context.globalState.get<Record<string, UserAnalyticsSnapshot>>(
      STORAGE_KEYS.userAnalytics,
      {}
    );
    return cache[handle.toLowerCase()];
  }

  async setUserAnalyticsCache(handle: string, analytics: UserAnalyticsSnapshot): Promise<void> {
    const cache = this.context.globalState.get<Record<string, UserAnalyticsSnapshot>>(
      STORAGE_KEYS.userAnalytics,
      {}
    );

    cache[handle.toLowerCase()] = analytics;
    await this.context.globalState.update(STORAGE_KEYS.userAnalytics, cache);
  }

  // Problems cache
  async getProblemsCache(): Promise<{ problems: unknown[]; statistics: unknown[]; timestamp: number } | undefined> {
    return this.context.globalState.get(STORAGE_KEYS.problemsCache);
  }

  async setProblemsCache(problems: unknown[], statistics: unknown[]): Promise<void> {
    await this.context.globalState.update(STORAGE_KEYS.problemsCache, {
      problems,
      statistics,
      timestamp: Date.now()
    });
  }

  // Contests cache
  async getContestsCache(): Promise<{ contests: unknown[]; timestamp: number } | undefined> {
    return this.context.globalState.get(STORAGE_KEYS.contestsCache);
  }

  async setContestsCache(contests: unknown[]): Promise<void> {
    await this.context.globalState.update(STORAGE_KEYS.contestsCache, {
      contests,
      timestamp: Date.now()
    });
  }

  // Cache validation
  isCacheValid(timestamp: number, ttlMs: number): boolean {
    return Date.now() - timestamp < ttlMs;
  }

  getGlobalStoragePath(): string {
    return this.context.globalStorageUri.fsPath;
  }
}

let storageServiceInstance: StorageService | undefined;

export function initStorageService(context: vscode.ExtensionContext): StorageService {
  storageServiceInstance = new StorageService(context);
  return storageServiceInstance;
}

export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    throw new Error('Storage service not initialized');
  }
  return storageServiceInstance;
}

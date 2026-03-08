import * as assert from 'assert';
import { initStorageService, getStorageService, StorageService } from '../../services/storageService';

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
const vscode = require('vscode') as any;
const { createMockExtensionContext } = vscode._test;
/* eslint-enable @typescript-eslint/no-var-requires */

suite('StorageService', () => {
  let service: StorageService;
  let context: any;

  setup(() => {
    context = createMockExtensionContext();
    initStorageService(context);
    service = getStorageService();
  });

  suite('singleton pattern', () => {
    test('initStorageService returns a StorageService instance', () => {
      const ctx = createMockExtensionContext();
      const instance = initStorageService(ctx as any);
      assert.ok(instance instanceof StorageService);
    });

    test('getStorageService returns the same instance after init', () => {
      const s1 = getStorageService();
      const s2 = getStorageService();
      assert.strictEqual(s1, s2);
    });
  });

  suite('Session management', () => {
    test('getSession returns undefined when no session exists', async () => {
      const session = await service.getSession();
      assert.strictEqual(session, undefined);
    });

    test('saveSession and getSession round-trip', async () => {
      const session = { handle: 'tourist', isLoggedIn: true, apiKey: 'key123', apiSecret: 'secret456' };
      await service.saveSession(session);
      const retrieved = await service.getSession();
      assert.deepStrictEqual(retrieved, session);
    });

    test('clearSession removes the session', async () => {
      await service.saveSession({ handle: 'tourist', isLoggedIn: true });
      await service.clearSession();
      const session = await service.getSession();
      assert.strictEqual(session, undefined);
    });

    test('getSession returns undefined when stored value is invalid JSON', async () => {
      // Directly store garbage into the secret storage to simulate corruption
      await context.secrets.store('codeforces.session', 'not-valid-json{{{');
      const session = await service.getSession();
      assert.strictEqual(session, undefined);
    });

    test('saveSession overwrites previous session', async () => {
      await service.saveSession({ handle: 'user1', isLoggedIn: true });
      await service.saveSession({ handle: 'user2', isLoggedIn: false });
      const session = await service.getSession();
      assert.strictEqual(session!.handle, 'user2');
      assert.strictEqual(session!.isLoggedIn, false);
    });
  });

  suite('Starred problems', () => {
    test('getStarredProblems returns empty array initially', () => {
      const starred = service.getStarredProblems();
      assert.deepStrictEqual(starred, []);
    });

    test('addStarredProblem adds a problem', async () => {
      await service.addStarredProblem(1900, 'A');
      const starred = service.getStarredProblems();
      assert.strictEqual(starred.length, 1);
      assert.strictEqual(starred[0].contestId, 1900);
      assert.strictEqual(starred[0].index, 'A');
      assert.ok(typeof starred[0].addedAt === 'number');
    });

    test('addStarredProblem deduplicates same problem', async () => {
      await service.addStarredProblem(1900, 'A');
      await service.addStarredProblem(1900, 'A');
      const starred = service.getStarredProblems();
      assert.strictEqual(starred.length, 1);
    });

    test('addStarredProblem allows different problems', async () => {
      await service.addStarredProblem(1900, 'A');
      await service.addStarredProblem(1900, 'B');
      await service.addStarredProblem(1901, 'A');
      const starred = service.getStarredProblems();
      assert.strictEqual(starred.length, 3);
    });

    test('removeStarredProblem removes the correct problem', async () => {
      await service.addStarredProblem(1900, 'A');
      await service.addStarredProblem(1900, 'B');
      await service.removeStarredProblem(1900, 'A');
      const starred = service.getStarredProblems();
      assert.strictEqual(starred.length, 1);
      assert.strictEqual(starred[0].index, 'B');
    });

    test('removeStarredProblem is a no-op for non-existent problem', async () => {
      await service.addStarredProblem(1900, 'A');
      await service.removeStarredProblem(9999, 'Z');
      assert.strictEqual(service.getStarredProblems().length, 1);
    });

    test('isStarred returns true for starred, false otherwise', async () => {
      await service.addStarredProblem(1900, 'A');
      assert.strictEqual(service.isStarred(1900, 'A'), true);
      assert.strictEqual(service.isStarred(1900, 'B'), false);
    });
  });

  suite('Solved problems', () => {
    test('getSolvedProblems returns empty array initially', () => {
      assert.deepStrictEqual(service.getSolvedProblems(), []);
    });

    test('addSolvedProblem adds a problem with correct fields', async () => {
      await service.addSolvedProblem(100, 'A', 12345, 'submission');
      const solved = service.getSolvedProblems();
      assert.strictEqual(solved.length, 1);
      assert.strictEqual(solved[0].contestId, 100);
      assert.strictEqual(solved[0].index, 'A');
      assert.strictEqual(solved[0].submissionId, 12345);
      assert.strictEqual(solved[0].source, 'submission');
      assert.ok(typeof solved[0].solvedAt === 'number');
    });

    test('addSolvedProblem deduplicates same problem', async () => {
      await service.addSolvedProblem(100, 'A', 111);
      await service.addSolvedProblem(100, 'A', 222);
      assert.strictEqual(service.getSolvedProblems().length, 1);
      // First submission wins
      assert.strictEqual(service.getSolvedProblems()[0].submissionId, 111);
    });

    test('isSolved returns correct results', async () => {
      await service.addSolvedProblem(100, 'A', 111);
      assert.strictEqual(service.isSolved(100, 'A'), true);
      assert.strictEqual(service.isSolved(100, 'B'), false);
    });

    test('addLocallySolvedProblem stores with source "local" and submissionId 0', async () => {
      await service.addLocallySolvedProblem(200, 'B');
      const solved = service.getSolvedProblems();
      assert.strictEqual(solved.length, 1);
      assert.strictEqual(solved[0].source, 'local');
      assert.strictEqual(solved[0].submissionId, 0);
    });

    test('syncSolvedProblemsFromApi merges without duplicating', async () => {
      // Pre-populate one solved problem
      await service.addSolvedProblem(100, 'A', 111, 'submission');

      // Sync from API with one existing and two new
      await service.syncSolvedProblemsFromApi([
        { contestId: 100, index: 'A' },
        { contestId: 200, index: 'B' },
        { contestId: 300, index: 'C' }
      ]);

      const solved = service.getSolvedProblems();
      assert.strictEqual(solved.length, 3);

      // Original should keep its source
      assert.strictEqual(solved[0].source, 'submission');
      // New ones should have source 'api'
      assert.strictEqual(solved[1].source, 'api');
      assert.strictEqual(solved[2].source, 'api');
    });

    test('syncSolvedProblemsFromApi with empty array is a no-op', async () => {
      await service.addSolvedProblem(100, 'A', 111);
      await service.syncSolvedProblemsFromApi([]);
      assert.strictEqual(service.getSolvedProblems().length, 1);
    });

    test('syncSolvedProblemsFromApi deduplicates within the input', async () => {
      await service.syncSolvedProblemsFromApi([
        { contestId: 100, index: 'A' },
        { contestId: 100, index: 'A' }
      ]);
      assert.strictEqual(service.getSolvedProblems().length, 1);
    });
  });

  suite('User analytics cache', () => {
    test('getUserAnalyticsCache returns undefined when empty', () => {
      const result = service.getUserAnalyticsCache('tourist');
      assert.strictEqual(result, undefined);
    });

    test('setUserAnalyticsCache and getUserAnalyticsCache round-trip', async () => {
      const analytics = {
        handle: 'tourist',
        fetchedAt: Date.now(),
        analyzedSubmissionCount: 100,
        acceptedSubmissionCount: 80,
        solvedProblemCount: 60,
        attemptedProblemCount: 70,
        attemptedUnsolvedCount: 10,
        acceptanceRate: 0.8,
        isPartial: false,
        currentStreak: 5,
        longestStreak: 10,
        ratingBuckets: [],
        topTags: [],
        recentSubmissions: [],
        solvedProblems: []
      };

      await service.setUserAnalyticsCache('tourist', analytics);
      const retrieved = service.getUserAnalyticsCache('tourist');
      assert.deepStrictEqual(retrieved, analytics);
    });

    test('getUserAnalyticsCache is case-insensitive on handle', async () => {
      const analytics = {
        handle: 'Tourist',
        fetchedAt: Date.now(),
        analyzedSubmissionCount: 0,
        acceptedSubmissionCount: 0,
        solvedProblemCount: 0,
        attemptedProblemCount: 0,
        attemptedUnsolvedCount: 0,
        acceptanceRate: 0,
        isPartial: false,
        currentStreak: 0,
        longestStreak: 0,
        ratingBuckets: [],
        topTags: [],
        recentSubmissions: [],
        solvedProblems: []
      };

      await service.setUserAnalyticsCache('Tourist', analytics);
      const retrieved = service.getUserAnalyticsCache('TOURIST');
      assert.ok(retrieved);
      assert.strictEqual(retrieved!.handle, 'Tourist');
    });

    test('setUserAnalyticsCache for different handles keeps both', async () => {
      const makeAnalytics = (handle: string) => ({
        handle,
        fetchedAt: Date.now(),
        analyzedSubmissionCount: 0,
        acceptedSubmissionCount: 0,
        solvedProblemCount: 0,
        attemptedProblemCount: 0,
        attemptedUnsolvedCount: 0,
        acceptanceRate: 0,
        isPartial: false,
        currentStreak: 0,
        longestStreak: 0,
        ratingBuckets: [],
        topTags: [],
        recentSubmissions: [],
        solvedProblems: []
      });

      await service.setUserAnalyticsCache('user1', makeAnalytics('user1'));
      await service.setUserAnalyticsCache('user2', makeAnalytics('user2'));

      assert.ok(service.getUserAnalyticsCache('user1'));
      assert.ok(service.getUserAnalyticsCache('user2'));
    });
  });

  suite('Problems cache', () => {
    test('getProblemsCache returns undefined when empty', async () => {
      const result = await service.getProblemsCache();
      assert.strictEqual(result, undefined);
    });

    test('setProblemsCache and getProblemsCache round-trip', async () => {
      const problems = [{ contestId: 1, index: 'A', name: 'Test' }];
      const statistics = [{ contestId: 1, index: 'A', solvedCount: 100 }];
      await service.setProblemsCache(problems, statistics);

      const cache = await service.getProblemsCache();
      assert.ok(cache);
      assert.deepStrictEqual(cache!.problems, problems);
      assert.deepStrictEqual(cache!.statistics, statistics);
      assert.ok(typeof cache!.timestamp === 'number');
    });
  });

  suite('Contests cache', () => {
    test('getContestsCache returns undefined when empty', async () => {
      const result = await service.getContestsCache();
      assert.strictEqual(result, undefined);
    });

    test('setContestsCache and getContestsCache round-trip', async () => {
      const contests = [{ id: 1, name: 'Codeforces Round #1' }];
      await service.setContestsCache(contests);

      const cache = await service.getContestsCache();
      assert.ok(cache);
      assert.deepStrictEqual(cache!.contests, contests);
      assert.ok(typeof cache!.timestamp === 'number');
    });
  });

  suite('Cache validation', () => {
    test('isCacheValid returns true for fresh cache', () => {
      const timestamp = Date.now() - 1000; // 1 second ago
      assert.strictEqual(service.isCacheValid(timestamp, 60000), true);
    });

    test('isCacheValid returns false for expired cache', () => {
      const timestamp = Date.now() - 120000; // 2 minutes ago
      assert.strictEqual(service.isCacheValid(timestamp, 60000), false);
    });

    test('isCacheValid returns false for exactly expired cache', () => {
      const timestamp = Date.now() - 60000; // exactly TTL ago
      assert.strictEqual(service.isCacheValid(timestamp, 60000), false);
    });
  });
});

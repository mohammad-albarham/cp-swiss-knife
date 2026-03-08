import * as assert from 'assert';
import * as sinon from 'sinon';
import { initStorageService, getStorageService } from '../../services/storageService';
import { Submission } from '../../api/types';

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
const proxyquire = require('proxyquire');
const vscode = require('vscode') as any;
const { createMockExtensionContext } = vscode._test;
/* eslint-enable @typescript-eslint/no-var-requires */

function makeSubmission(overrides: Partial<Submission> & { id: number }): Submission {
  return {
    id: overrides.id,
    contestId: overrides.problem?.contestId,
    creationTimeSeconds: overrides.creationTimeSeconds ?? Math.floor(Date.now() / 1000),
    problem: {
      contestId: 100,
      index: 'A',
      name: 'Test Problem',
      type: 'PROGRAMMING',
      tags: [],
      ...overrides.problem
    },
    author: overrides.author ?? {
      members: [{ handle: 'testuser' }],
      participantType: 'CONTESTANT',
      ghost: false
    },
    programmingLanguage: overrides.programmingLanguage ?? 'C++',
    verdict: overrides.verdict ?? 'OK',
    testset: overrides.testset ?? 'TESTS',
    passedTestCount: overrides.passedTestCount ?? 5,
    timeConsumedMillis: overrides.timeConsumedMillis ?? 100,
    memoryConsumedBytes: overrides.memoryConsumedBytes ?? 1024
  };
}

suite('UserStatsService', () => {
  let getUserStatusStub: sinon.SinonStub;
  let UserStatsService: any;
  let context: any;

  setup(() => {
    context = createMockExtensionContext();
    initStorageService(context as any);

    getUserStatusStub = sinon.stub();

    const loaded = proxyquire('../../services/userStatsService', {
      '../api': {
        codeforcesApi: {
          getUserStatus: getUserStatusStub
        },
        '@noCallThru': true
      },
      './storageService': {
        getStorageService,
        '@noCallThru': false
      }
    });

    UserStatsService = loaded.UserStatsService;
  });

  teardown(() => {
    sinon.restore();
  });

  test('empty submissions yield zeroed stats', async () => {
    getUserStatusStub.resolves([]);

    const service = new UserStatsService();
    const snapshot = await service.getSnapshot('testuser');

    assert.strictEqual(snapshot.handle, 'testuser');
    assert.strictEqual(snapshot.analyzedSubmissionCount, 0);
    assert.strictEqual(snapshot.acceptedSubmissionCount, 0);
    assert.strictEqual(snapshot.solvedProblemCount, 0);
    assert.strictEqual(snapshot.attemptedProblemCount, 0);
    assert.strictEqual(snapshot.attemptedUnsolvedCount, 0);
    assert.strictEqual(snapshot.acceptanceRate, 0);
    assert.strictEqual(snapshot.isPartial, false);
    assert.strictEqual(snapshot.currentStreak, 0);
    assert.strictEqual(snapshot.longestStreak, 0);
    assert.strictEqual(snapshot.mostDifficultSolved, undefined);
    assert.deepStrictEqual(snapshot.topTags, []);
  });

  test('mixed verdicts produce correct counts and acceptance rate', async () => {
    const submissions = [
      makeSubmission({ id: 1, verdict: 'OK', problem: { contestId: 100, index: 'A', name: 'P1', type: 'PROGRAMMING', tags: [], rating: 1000 } }),
      makeSubmission({ id: 2, verdict: 'WRONG_ANSWER', problem: { contestId: 100, index: 'A', name: 'P1', type: 'PROGRAMMING', tags: [], rating: 1000 } }),
      makeSubmission({ id: 3, verdict: 'OK', problem: { contestId: 200, index: 'B', name: 'P2', type: 'PROGRAMMING', tags: [], rating: 1500 } }),
      makeSubmission({ id: 4, verdict: 'TIME_LIMIT_EXCEEDED', problem: { contestId: 300, index: 'C', name: 'P3', type: 'PROGRAMMING', tags: [], rating: 2000 } }),
      makeSubmission({ id: 5, verdict: 'RUNTIME_ERROR', problem: { contestId: 300, index: 'C', name: 'P3', type: 'PROGRAMMING', tags: [], rating: 2000 } }),
    ];

    getUserStatusStub.resolves(submissions);

    const service = new UserStatsService();
    const snapshot = await service.getSnapshot('testuser');

    assert.strictEqual(snapshot.analyzedSubmissionCount, 5);
    assert.strictEqual(snapshot.acceptedSubmissionCount, 2);
    assert.strictEqual(snapshot.solvedProblemCount, 2);     // 100-A and 200-B
    assert.strictEqual(snapshot.attemptedProblemCount, 3);   // 100-A, 200-B, 300-C
    assert.strictEqual(snapshot.attemptedUnsolvedCount, 1);  // 300-C
    assert.strictEqual(snapshot.acceptanceRate, 2 / 5);
  });

  test('duplicate solves of the same problem are counted once in solvedProblemCount', async () => {
    const submissions = [
      makeSubmission({ id: 1, verdict: 'OK', problem: { contestId: 100, index: 'A', name: 'P1', type: 'PROGRAMMING', tags: ['dp'], rating: 1500 } }),
      makeSubmission({ id: 2, verdict: 'OK', problem: { contestId: 100, index: 'A', name: 'P1', type: 'PROGRAMMING', tags: ['dp'], rating: 1500 } }),
      makeSubmission({ id: 3, verdict: 'OK', problem: { contestId: 100, index: 'A', name: 'P1', type: 'PROGRAMMING', tags: ['dp'], rating: 1500 } }),
    ];

    getUserStatusStub.resolves(submissions);

    const service = new UserStatsService();
    const snapshot = await service.getSnapshot('testuser');

    assert.strictEqual(snapshot.solvedProblemCount, 1);
    assert.strictEqual(snapshot.acceptedSubmissionCount, 3);
  });

  test('tag counting from solved problems', async () => {
    const submissions = [
      makeSubmission({ id: 1, verdict: 'OK', problem: { contestId: 100, index: 'A', name: 'P1', type: 'PROGRAMMING', tags: ['dp', 'math'], rating: 1500 } }),
      makeSubmission({ id: 2, verdict: 'OK', problem: { contestId: 200, index: 'B', name: 'P2', type: 'PROGRAMMING', tags: ['dp', 'greedy'], rating: 1600 } }),
      makeSubmission({ id: 3, verdict: 'OK', problem: { contestId: 300, index: 'A', name: 'P3', type: 'PROGRAMMING', tags: ['math'], rating: 1200 } }),
    ];

    getUserStatusStub.resolves(submissions);

    const service = new UserStatsService();
    const snapshot = await service.getSnapshot('testuser');

    // dp: 2, math: 2, greedy: 1
    assert.strictEqual(snapshot.topTags.length, 3);
    // dp and math both have count 2; dp comes first alphabetically
    assert.strictEqual(snapshot.topTags[0].tag, 'dp');
    assert.strictEqual(snapshot.topTags[0].count, 2);
    assert.strictEqual(snapshot.topTags[1].tag, 'math');
    assert.strictEqual(snapshot.topTags[1].count, 2);
    assert.strictEqual(snapshot.topTags[2].tag, 'greedy');
    assert.strictEqual(snapshot.topTags[2].count, 1);
  });

  test('tags only count unique solved problems, not duplicate AC submissions', async () => {
    const submissions = [
      makeSubmission({ id: 1, verdict: 'OK', problem: { contestId: 100, index: 'A', name: 'P1', type: 'PROGRAMMING', tags: ['dp'], rating: 1500 } }),
      makeSubmission({ id: 2, verdict: 'OK', problem: { contestId: 100, index: 'A', name: 'P1', type: 'PROGRAMMING', tags: ['dp'], rating: 1500 } }),
    ];

    getUserStatusStub.resolves(submissions);

    const service = new UserStatsService();
    const snapshot = await service.getSnapshot('testuser');

    assert.strictEqual(snapshot.topTags.length, 1);
    assert.strictEqual(snapshot.topTags[0].count, 1);
  });

  test('rating bucket counting', async () => {
    const submissions = [
      makeSubmission({ id: 1, verdict: 'OK', problem: { contestId: 100, index: 'A', name: 'P1', type: 'PROGRAMMING', tags: [], rating: 800 } }),
      makeSubmission({ id: 2, verdict: 'OK', problem: { contestId: 200, index: 'A', name: 'P2', type: 'PROGRAMMING', tags: [], rating: 900 } }),
      makeSubmission({ id: 3, verdict: 'OK', problem: { contestId: 300, index: 'A', name: 'P3', type: 'PROGRAMMING', tags: [], rating: 1500 } }),
      makeSubmission({ id: 4, verdict: 'OK', problem: { contestId: 400, index: 'A', name: 'P4', type: 'PROGRAMMING', tags: [], rating: 2500 } }),
    ];

    getUserStatusStub.resolves(submissions);

    const service = new UserStatsService();
    const snapshot = await service.getSnapshot('testuser');

    // 800-1000 bucket should have 2 (ratings 800, 900)
    const bucket800 = snapshot.ratingBuckets.find((b: any) => b.label === '800-1000');
    assert.strictEqual(bucket800!.count, 2);

    // 1400-1600 bucket should have 1 (rating 1500)
    const bucket1400 = snapshot.ratingBuckets.find((b: any) => b.label === '1400-1600');
    assert.strictEqual(bucket1400!.count, 1);

    // 2400-2600 bucket should have 1 (rating 2500)
    const bucket2400 = snapshot.ratingBuckets.find((b: any) => b.label === '2400-2600');
    assert.strictEqual(bucket2400!.count, 1);

    // 1000-1200 bucket should have 0
    const bucket1000 = snapshot.ratingBuckets.find((b: any) => b.label === '1000-1200');
    assert.strictEqual(bucket1000!.count, 0);
  });

  test('most difficult solved picks highest rating', async () => {
    const submissions = [
      makeSubmission({ id: 1, verdict: 'OK', problem: { contestId: 100, index: 'A', name: 'Easy', type: 'PROGRAMMING', tags: [], rating: 800 } }),
      makeSubmission({ id: 2, verdict: 'OK', problem: { contestId: 200, index: 'B', name: 'Hard', type: 'PROGRAMMING', tags: ['dp'], rating: 2500 } }),
      makeSubmission({ id: 3, verdict: 'OK', problem: { contestId: 300, index: 'C', name: 'Medium', type: 'PROGRAMMING', tags: [], rating: 1500 } }),
    ];

    getUserStatusStub.resolves(submissions);

    const service = new UserStatsService();
    const snapshot = await service.getSnapshot('testuser');

    assert.ok(snapshot.mostDifficultSolved);
    assert.strictEqual(snapshot.mostDifficultSolved.rating, 2500);
    assert.strictEqual(snapshot.mostDifficultSolved.name, 'Hard');
    assert.strictEqual(snapshot.mostDifficultSolved.contestId, 200);
    assert.strictEqual(snapshot.mostDifficultSolved.index, 'B');
  });

  test('streak calculation for consecutive days', async () => {
    const now = new Date();
    // Build 3 consecutive days ending today
    const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day1 = new Date(day0.getTime() - 86400000);
    const day2 = new Date(day0.getTime() - 2 * 86400000);

    const submissions = [
      makeSubmission({ id: 1, verdict: 'OK', creationTimeSeconds: Math.floor(day0.getTime() / 1000), problem: { contestId: 100, index: 'A', name: 'P1', type: 'PROGRAMMING', tags: [] } }),
      makeSubmission({ id: 2, verdict: 'OK', creationTimeSeconds: Math.floor(day1.getTime() / 1000), problem: { contestId: 200, index: 'A', name: 'P2', type: 'PROGRAMMING', tags: [] } }),
      makeSubmission({ id: 3, verdict: 'OK', creationTimeSeconds: Math.floor(day2.getTime() / 1000), problem: { contestId: 300, index: 'A', name: 'P3', type: 'PROGRAMMING', tags: [] } }),
    ];

    getUserStatusStub.resolves(submissions);

    const service = new UserStatsService();
    const snapshot = await service.getSnapshot('testuser');

    assert.strictEqual(snapshot.currentStreak, 3);
    assert.strictEqual(snapshot.longestStreak, 3);
  });

  test('longest streak can differ from current streak', async () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Old streak: 5 consecutive days, 30 days ago
    const oldStreakStart = new Date(today.getTime() - 34 * 86400000);
    const oldStreakDays = [];
    for (let i = 0; i < 5; i++) {
      oldStreakDays.push(new Date(oldStreakStart.getTime() + i * 86400000));
    }

    // Current streak: just today (1 day)
    const submissions = [
      ...oldStreakDays.map((day, i) =>
        makeSubmission({
          id: i + 1,
          verdict: 'OK',
          creationTimeSeconds: Math.floor(day.getTime() / 1000),
          problem: { contestId: 100 + i, index: 'A', name: `P${i}`, type: 'PROGRAMMING', tags: [] }
        })
      ),
      makeSubmission({
        id: 100,
        verdict: 'OK',
        creationTimeSeconds: Math.floor(today.getTime() / 1000),
        problem: { contestId: 999, index: 'A', name: 'Today', type: 'PROGRAMMING', tags: [] }
      })
    ];

    getUserStatusStub.resolves(submissions);

    const service = new UserStatsService();
    const snapshot = await service.getSnapshot('testuser');

    assert.strictEqual(snapshot.currentStreak, 1);
    assert.strictEqual(snapshot.longestStreak, 5);
  });

  test('isPartial is true when all MAX_BATCHES return full BATCH_SIZE', async () => {
    // Each batch call returns exactly 1000 submissions (BATCH_SIZE)
    // The service does MAX_BATCHES=5 calls
    const fullBatch = Array.from({ length: 1000 }, (_, i) =>
      makeSubmission({
        id: i,
        verdict: 'OK',
        problem: { contestId: i + 1, index: 'A', name: `P${i}`, type: 'PROGRAMMING', tags: [] }
      })
    );

    getUserStatusStub.resolves(fullBatch);

    const service = new UserStatsService();
    const snapshot = await service.getSnapshot('testuser');

    assert.strictEqual(snapshot.isPartial, true);
    // Should have been called 5 times (MAX_BATCHES)
    assert.strictEqual(getUserStatusStub.callCount, 5);
    assert.strictEqual(snapshot.analyzedSubmissionCount, 5000);
  });

  test('isPartial is false when a batch returns fewer than BATCH_SIZE', async () => {
    // First call returns 500 (less than 1000), so fetching stops
    const partialBatch = Array.from({ length: 500 }, (_, i) =>
      makeSubmission({
        id: i,
        verdict: 'OK',
        problem: { contestId: i + 1, index: 'A', name: `P${i}`, type: 'PROGRAMMING', tags: [] }
      })
    );

    getUserStatusStub.resolves(partialBatch);

    const service = new UserStatsService();
    const snapshot = await service.getSnapshot('testuser');

    assert.strictEqual(snapshot.isPartial, false);
    assert.strictEqual(getUserStatusStub.callCount, 1);
  });

  test('cache hit: when cache is valid, API is not called', async () => {
    // First call populates the cache
    getUserStatusStub.resolves([
      makeSubmission({ id: 1, verdict: 'OK', problem: { contestId: 100, index: 'A', name: 'P1', type: 'PROGRAMMING', tags: [] } })
    ]);

    const service = new UserStatsService();
    const first = await service.getSnapshot('testuser');
    assert.strictEqual(getUserStatusStub.callCount, 1);

    // Second call should use cache
    const second = await service.getSnapshot('testuser');
    assert.strictEqual(getUserStatusStub.callCount, 1); // Not called again
    assert.deepStrictEqual(second, first);
  });

  test('forceRefresh bypasses cache and calls API again', async () => {
    getUserStatusStub.resolves([
      makeSubmission({ id: 1, verdict: 'OK', problem: { contestId: 100, index: 'A', name: 'P1', type: 'PROGRAMMING', tags: [] } })
    ]);

    const service = new UserStatsService();
    await service.getSnapshot('testuser');
    assert.strictEqual(getUserStatusStub.callCount, 1);

    // Force refresh
    await service.getSnapshot('testuser', true);
    assert.strictEqual(getUserStatusStub.callCount, 2);
  });

  test('submissions without contestId are skipped', async () => {
    const submissions = [
      makeSubmission({ id: 1, verdict: 'OK', problem: { contestId: undefined as any, index: 'A', name: 'No Contest', type: 'PROGRAMMING', tags: ['dp'] } }),
      makeSubmission({ id: 2, verdict: 'OK', problem: { contestId: 100, index: 'A', name: 'Valid', type: 'PROGRAMMING', tags: ['math'], rating: 1500 } }),
    ];

    getUserStatusStub.resolves(submissions);

    const service = new UserStatsService();
    const snapshot = await service.getSnapshot('testuser');

    // Only the submission with contestId=100 should be counted as attempted/solved
    assert.strictEqual(snapshot.solvedProblemCount, 1);
    assert.strictEqual(snapshot.attemptedProblemCount, 1);
  });

  test('topTags are limited to 8 entries', async () => {
    // Create 10 problems with unique tags
    const submissions = Array.from({ length: 10 }, (_, i) =>
      makeSubmission({
        id: i + 1,
        verdict: 'OK',
        problem: { contestId: 100 + i, index: 'A', name: `P${i}`, type: 'PROGRAMMING', tags: [`tag${i}`], rating: 1000 + i * 100 }
      })
    );

    getUserStatusStub.resolves(submissions);

    const service = new UserStatsService();
    const snapshot = await service.getSnapshot('testuser');

    assert.ok(snapshot.topTags.length <= 8);
  });

  test('recentSubmissions contains at most 20 entries', async () => {
    const submissions = Array.from({ length: 30 }, (_, i) =>
      makeSubmission({
        id: i + 1,
        verdict: i % 2 === 0 ? 'OK' : 'WRONG_ANSWER',
        problem: { contestId: 100 + i, index: 'A', name: `P${i}`, type: 'PROGRAMMING', tags: [] }
      })
    );

    getUserStatusStub.resolves(submissions);

    const service = new UserStatsService();
    const snapshot = await service.getSnapshot('testuser');

    assert.ok(snapshot.recentSubmissions.length <= 20);
  });

  test('batch fetching passes correct from and count parameters', async () => {
    // Return full batch first, then partial
    getUserStatusStub.onFirstCall().resolves(
      Array.from({ length: 1000 }, (_, i) =>
        makeSubmission({ id: i, verdict: 'OK', problem: { contestId: i + 1, index: 'A', name: `P${i}`, type: 'PROGRAMMING', tags: [] } })
      )
    );
    getUserStatusStub.onSecondCall().resolves([
      makeSubmission({ id: 9999, verdict: 'OK', problem: { contestId: 9999, index: 'A', name: 'Last', type: 'PROGRAMMING', tags: [] } })
    ]);

    const service = new UserStatsService();
    await service.getSnapshot('testuser');

    // First batch: from=1, count=1000
    assert.deepStrictEqual(getUserStatusStub.firstCall.args, ['testuser', { from: 1, count: 1000 }]);
    // Second batch: from=1001, count=1000
    assert.deepStrictEqual(getUserStatusStub.secondCall.args, ['testuser', { from: 1001, count: 1000 }]);
  });
});

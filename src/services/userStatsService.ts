import { codeforcesApi, Problem, Submission } from '../api';
import { UserAnalyticsSnapshot } from '../models/userAnalytics';
import { RATING_RANGES } from '../utils/constants';
import { getStorageService } from './storageService';

export class UserStatsService {
  private static readonly CACHE_TTL_MS = 15 * 60 * 1000;
  private static readonly BATCH_SIZE = 1000;
  private static readonly MAX_BATCHES = 5;

  async getSnapshot(handle: string, forceRefresh = false): Promise<UserAnalyticsSnapshot> {
    const storage = getStorageService();
    const cached = storage.getUserAnalyticsCache(handle);

    if (
      !forceRefresh &&
      cached &&
      storage.isCacheValid(cached.fetchedAt, UserStatsService.CACHE_TTL_MS)
    ) {
      return cached;
    }

    const { submissions, isPartial } = await this.fetchSubmissions(handle);
    const snapshot = this.buildSnapshot(handle, submissions, isPartial);

    await storage.setUserAnalyticsCache(handle, snapshot);
    return snapshot;
  }

  private async fetchSubmissions(handle: string): Promise<{ submissions: Submission[]; isPartial: boolean }> {
    const submissions: Submission[] = [];

    for (let batchIndex = 0; batchIndex < UserStatsService.MAX_BATCHES; batchIndex++) {
      const batch = await codeforcesApi.getUserStatus(handle, {
        from: batchIndex * UserStatsService.BATCH_SIZE + 1,
        count: UserStatsService.BATCH_SIZE
      });

      submissions.push(...batch);

      if (batch.length < UserStatsService.BATCH_SIZE) {
        return { submissions, isPartial: false };
      }
    }

    return { submissions, isPartial: true };
  }

  private buildSnapshot(
    handle: string,
    submissions: Submission[],
    isPartial: boolean
  ): UserAnalyticsSnapshot {
    const attemptedProblemKeys = new Set<string>();
    const solvedProblems = new Map<string, Problem>();
    const tagCounts = new Map<string, number>();
    let acceptedSubmissionCount = 0;

    for (const submission of submissions) {
      const contestId = submission.problem.contestId;
      if (!contestId) {
        continue;
      }

      const problemKey = `${contestId}-${submission.problem.index}`;
      attemptedProblemKeys.add(problemKey);

      if (submission.verdict !== 'OK') {
        continue;
      }

      acceptedSubmissionCount++;

      if (solvedProblems.has(problemKey)) {
        continue;
      }

      solvedProblems.set(problemKey, submission.problem);

      for (const tag of submission.problem.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Compute solve streaks from AC submissions
    const acDaySet = new Set<string>();
    for (const submission of submissions) {
      if (submission.verdict === 'OK' && submission.creationTimeSeconds) {
        const day = new Date(submission.creationTimeSeconds * 1000).toISOString().slice(0, 10);
        acDaySet.add(day);
      }
    }

    const sortedDays = Array.from(acDaySet).sort().reverse(); // newest first
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    let currentStreak = 0;
    if (sortedDays.length > 0) {
      const streakStart = sortedDays[0] === todayStr || sortedDays[0] === yesterdayStr;
      if (streakStart) {
        currentStreak = 1;
        for (let i = 1; i < sortedDays.length; i++) {
          const prev = new Date(sortedDays[i - 1]);
          const curr = new Date(sortedDays[i]);
          const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
          if (diffDays === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    let longestStreak = 0;
    if (sortedDays.length > 0) {
      const asc = [...sortedDays].reverse(); // oldest first
      let run = 1;
      longestStreak = 1;
      for (let i = 1; i < asc.length; i++) {
        const prev = new Date(asc[i - 1]);
        const curr = new Date(asc[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
        if (diffDays === 1) {
          run++;
          if (run > longestStreak) {
            longestStreak = run;
          }
        } else {
          run = 1;
        }
      }
    }

    const solvedProblemList = Array.from(solvedProblems.values());
    const ratingBuckets = RATING_RANGES.map(range => ({
      ...range,
      count: solvedProblemList.filter(problem => {
        if (!problem.rating) {
          return false;
        }

        return problem.rating >= range.min && problem.rating < range.max;
      }).length
    }));

    const mostDifficultSolved = solvedProblemList.reduce<Problem | undefined>((hardest, problem) => {
      if (!hardest) {
        return problem;
      }

      if ((problem.rating || 0) > (hardest.rating || 0)) {
        return problem;
      }

      return hardest;
    }, undefined);

    return {
      handle,
      fetchedAt: Date.now(),
      analyzedSubmissionCount: submissions.length,
      acceptedSubmissionCount,
      solvedProblemCount: solvedProblems.size,
      attemptedProblemCount: attemptedProblemKeys.size,
      attemptedUnsolvedCount: attemptedProblemKeys.size - solvedProblems.size,
      acceptanceRate: submissions.length === 0 ? 0 : acceptedSubmissionCount / submissions.length,
      isPartial,
      currentStreak,
      longestStreak,
      mostDifficultSolved: mostDifficultSolved && mostDifficultSolved.contestId
        ? {
            contestId: mostDifficultSolved.contestId,
            index: mostDifficultSolved.index,
            name: mostDifficultSolved.name,
            rating: mostDifficultSolved.rating,
            tags: mostDifficultSolved.tags
          }
        : undefined,
      ratingBuckets,
      topTags: Array.from(tagCounts.entries())
        .sort((left, right) => {
          if (right[1] !== left[1]) {
            return right[1] - left[1];
          }

          return left[0].localeCompare(right[0]);
        })
        .slice(0, 8)
        .map(([tag, count]) => ({ tag, count })),
      recentSubmissions: submissions.slice(0, 20),
      solvedProblems: solvedProblemList.map(problem => ({
        contestId: problem.contestId!,
        index: problem.index,
        name: problem.name,
        rating: problem.rating,
        tags: problem.tags
      }))
    };
  }
}

let userStatsServiceInstance: UserStatsService | undefined;

export function getUserStatsService(): UserStatsService {
  if (!userStatsServiceInstance) {
    userStatsServiceInstance = new UserStatsService();
  }

  return userStatsServiceInstance;
}
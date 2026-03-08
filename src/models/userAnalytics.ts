import { Submission } from '../api/types';

export interface UserAnalyticsProblemSummary {
  contestId: number;
  index: string;
  name: string;
  rating?: number;
  tags: string[];
}

export interface UserAnalyticsRatingBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface UserAnalyticsTagStat {
  tag: string;
  count: number;
}

export interface UserAnalyticsSnapshot {
  handle: string;
  fetchedAt: number;
  analyzedSubmissionCount: number;
  acceptedSubmissionCount: number;
  solvedProblemCount: number;
  attemptedProblemCount: number;
  attemptedUnsolvedCount: number;
  acceptanceRate: number;
  isPartial: boolean;
  mostDifficultSolved?: UserAnalyticsProblemSummary;
  ratingBuckets: UserAnalyticsRatingBucket[];
  topTags: UserAnalyticsTagStat[];
  recentSubmissions: Submission[];
  solvedProblems: UserAnalyticsProblemSummary[];
}
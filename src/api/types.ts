// Codeforces API Response Types

export interface ApiResponse<T> {
  status: 'OK' | 'FAILED';
  result?: T;
  comment?: string;
}

export interface User {
  handle: string;
  email?: string;
  vkId?: string;
  openId?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  city?: string;
  organization?: string;
  contribution: number;
  rank: string;
  rating: number;
  maxRank: string;
  maxRating: number;
  lastOnlineTimeSeconds: number;
  registrationTimeSeconds: number;
  friendOfCount: number;
  avatar: string;
  titlePhoto: string;
}

export interface Problem {
  contestId?: number;
  problemsetName?: string;
  index: string;
  name: string;
  type: 'PROGRAMMING' | 'QUESTION';
  points?: number;
  rating?: number;
  tags: string[];
}

export interface ProblemStatistics {
  contestId?: number;
  index: string;
  solvedCount: number;
}

export interface Contest {
  id: number;
  name: string;
  type: 'CF' | 'IOI' | 'ICPC';
  phase: 'BEFORE' | 'CODING' | 'PENDING_SYSTEM_TEST' | 'SYSTEM_TEST' | 'FINISHED';
  frozen: boolean;
  durationSeconds: number;
  startTimeSeconds?: number;
  relativeTimeSeconds?: number;
  preparedBy?: string;
  websiteUrl?: string;
  description?: string;
  difficulty?: number;
  kind?: string;
  icpcRegion?: string;
  country?: string;
  city?: string;
  season?: string;
}

export interface Party {
  contestId?: number;
  members: Member[];
  participantType: 'CONTESTANT' | 'PRACTICE' | 'VIRTUAL' | 'MANAGER' | 'OUT_OF_COMPETITION';
  teamId?: number;
  teamName?: string;
  ghost: boolean;
  room?: number;
  startTimeSeconds?: number;
}

export interface Member {
  handle: string;
  name?: string;
}

export interface Submission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  relativeTimeSeconds?: number;
  problem: Problem;
  author: Party;
  programmingLanguage: string;
  verdict?: Verdict;
  testset: string;
  passedTestCount: number;
  timeConsumedMillis: number;
  memoryConsumedBytes: number;
  points?: number;
}

export type Verdict =
  | 'FAILED'
  | 'OK'
  | 'PARTIAL'
  | 'COMPILATION_ERROR'
  | 'RUNTIME_ERROR'
  | 'WRONG_ANSWER'
  | 'PRESENTATION_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'IDLENESS_LIMIT_EXCEEDED'
  | 'SECURITY_VIOLATED'
  | 'CRASHED'
  | 'INPUT_PREPARATION_CRASHED'
  | 'CHALLENGED'
  | 'SKIPPED'
  | 'TESTING'
  | 'REJECTED';

export interface RatingChange {
  contestId: number;
  contestName: string;
  handle: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

export interface Hack {
  id: number;
  creationTimeSeconds: number;
  hacker: Party;
  defender: Party;
  verdict?: 'HACK_SUCCESSFUL' | 'HACK_UNSUCCESSFUL' | 'INVALID_INPUT' | 'GENERATOR_INCOMPILABLE' | 'GENERATOR_CRASHED' | 'IGNORED' | 'TESTING' | 'OTHER';
  problem: Problem;
  test?: string;
  judgeProtocol?: JudgeProtocol;
}

export interface JudgeProtocol {
  manual: boolean;
  protocol: string;
  verdict: string;
}

export interface RanklistRow {
  party: Party;
  rank: number;
  points: number;
  penalty: number;
  successfulHackCount: number;
  unsuccessfulHackCount: number;
  problemResults: ProblemResult[];
  lastSubmissionTimeSeconds?: number;
}

export interface ProblemResult {
  points: number;
  penalty?: number;
  rejectedAttemptCount: number;
  type: 'PRELIMINARY' | 'FINAL';
  bestSubmissionTimeSeconds?: number;
}

export interface BlogEntry {
  id: number;
  originalLocale: string;
  creationTimeSeconds: number;
  authorHandle: string;
  title: string;
  content?: string;
  locale: string;
  modificationTimeSeconds: number;
  allowViewHistory: boolean;
  tags: string[];
  rating: number;
}

export interface Comment {
  id: number;
  creationTimeSeconds: number;
  commentatorHandle: string;
  locale: string;
  text: string;
  parentCommentId?: number;
  rating: number;
}

export interface RecentAction {
  timeSeconds: number;
  blogEntry?: BlogEntry;
  comment?: Comment;
}

// Problem with full details (parsed from HTML)
export interface ProblemDetails {
  contestId: number;
  index: string;
  name: string;
  timeLimit: string;
  memoryLimit: string;
  inputType: string;
  outputType: string;
  statement: string;
  inputSpecification: string;
  outputSpecification: string;
  sampleTests: TestCase[];
  notes?: string;
  tags: string[];
  rating?: number;
}

export interface TestCase {
  input: string;
  output: string;
}

// Extension-specific types
export interface ProblemFile {
  contestId: number;
  index: string;
  name: string;
  filePath: string;
  language: SupportedLanguage;
  testCases: TestCase[];
}

export type SupportedLanguage =
  | 'cpp'
  | 'python'
  | 'java'
  | 'kotlin'
  | 'rust'
  | 'go'
  | 'csharp'
  | 'javascript';

export interface LanguageConfig {
  extension: string;
  compileCommand?: string;
  runCommand: string;
  codeforcesId: string;
  displayName: string;
}

export interface UserSession {
  handle: string;
  isLoggedIn: boolean;
  apiKey?: string;
  apiSecret?: string;
  cookies?: string;
  csrf?: string;
}

export interface StarredProblem {
  contestId: number;
  index: string;
  addedAt: number;
}

export interface SolvedProblem {
  contestId: number;
  index: string;
  solvedAt: number;
  submissionId: number;
  source?: 'submission' | 'local' | 'api';
}

export interface ProblemWorkspaceMetadata {
  contestId: number;
  index: string;
  name?: string;
  testCases?: number;
}

export interface ProblemFilter {
  tags?: string[];
  ratingMin?: number;
  ratingMax?: number;
  contestId?: number;
  showSolved?: boolean;
  showStarred?: boolean;
}

export interface ContestFilter {
  phase?: Contest['phase'][];
  type?: Contest['type'][];
  includeGym?: boolean;
}

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  cpp: {
    extension: '.cpp',
    compileCommand: 'g++ -std=c++17 -O2 -Wall -Wextra',
    runCommand: './a.out',
    codeforcesId: '54', // GNU G++17 7.3.0
    displayName: 'C++17 (G++ 7.3.0)'
  },
  python: {
    extension: '.py',
    runCommand: 'python3',
    codeforcesId: '31', // Python 3
    displayName: 'Python 3'
  },
  java: {
    extension: '.java',
    compileCommand: 'javac',
    runCommand: 'java',
    codeforcesId: '36', // Java 8
    displayName: 'Java 8'
  },
  kotlin: {
    extension: '.kt',
    compileCommand: 'kotlinc',
    runCommand: 'kotlin',
    codeforcesId: '48', // Kotlin 1.4
    displayName: 'Kotlin 1.4'
  },
  rust: {
    extension: '.rs',
    compileCommand: 'rustc -O',
    runCommand: './main',
    codeforcesId: '49', // Rust
    displayName: 'Rust'
  },
  go: {
    extension: '.go',
    runCommand: 'go run',
    codeforcesId: '32', // Go
    displayName: 'Go'
  },
  csharp: {
    extension: '.cs',
    compileCommand: 'mcs',
    runCommand: 'mono',
    codeforcesId: '9', // C# Mono
    displayName: 'C# Mono'
  },
  javascript: {
    extension: '.js',
    runCommand: 'node',
    codeforcesId: '34', // Node.js
    displayName: 'Node.js'
  }
};

export const RATING_COLORS: Record<string, string> = {
  'newbie': '#808080',
  'pupil': '#008000',
  'specialist': '#03a89e',
  'expert': '#0000ff',
  'candidate master': '#aa00aa',
  'master': '#ff8c00',
  'international master': '#ff8c00',
  'grandmaster': '#ff0000',
  'international grandmaster': '#ff0000',
  'legendary grandmaster': '#ff0000'
};

export function getRatingColor(rating: number): string {
  if (rating < 1200) { return RATING_COLORS['newbie']; }
  if (rating < 1400) { return RATING_COLORS['pupil']; }
  if (rating < 1600) { return RATING_COLORS['specialist']; }
  if (rating < 1900) { return RATING_COLORS['expert']; }
  if (rating < 2100) { return RATING_COLORS['candidate master']; }
  if (rating < 2300) { return RATING_COLORS['master']; }
  if (rating < 2400) { return RATING_COLORS['international master']; }
  if (rating < 2600) { return RATING_COLORS['grandmaster']; }
  if (rating < 3000) { return RATING_COLORS['international grandmaster']; }
  return RATING_COLORS['legendary grandmaster'];
}

/** Maps a Codeforces rating to a VS Code theme color ID for use with ThemeIcon. */
export function getRatingThemeColor(rating: number): string {
  if (rating < 1200) { return 'charts.foreground'; }
  if (rating < 1600) { return 'charts.green'; }
  if (rating < 1900) { return 'charts.blue'; }
  if (rating < 2100) { return 'charts.purple'; }
  if (rating < 2400) { return 'charts.orange'; }
  return 'charts.red';
}

export function getRankName(rating: number): string {
  if (rating < 1200) { return 'Newbie'; }
  if (rating < 1400) { return 'Pupil'; }
  if (rating < 1600) { return 'Specialist'; }
  if (rating < 1900) { return 'Expert'; }
  if (rating < 2100) { return 'Candidate Master'; }
  if (rating < 2300) { return 'Master'; }
  if (rating < 2400) { return 'International Master'; }
  if (rating < 2600) { return 'Grandmaster'; }
  if (rating < 3000) { return 'International Grandmaster'; }
  return 'Legendary Grandmaster';
}

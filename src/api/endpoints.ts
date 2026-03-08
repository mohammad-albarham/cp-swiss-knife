// Codeforces API Endpoints

export const API_BASE_URL = 'https://codeforces.com/api';
export const WEB_BASE_URL = 'https://codeforces.com';

export const ENDPOINTS = {
  // Contest methods
  contestList: '/contest.list',
  contestStandings: '/contest.standings',
  contestRatingChanges: '/contest.ratingChanges',
  contestHacks: '/contest.hacks',
  contestStatus: '/contest.status',

  // Problemset methods
  problemsetProblems: '/problemset.problems',
  problemsetRecentStatus: '/problemset.recentStatus',

  // User methods
  userInfo: '/user.info',
  userRating: '/user.rating',
  userStatus: '/user.status',
  userRatedList: '/user.ratedList',
  userBlogEntries: '/user.blogEntries',
  userFriends: '/user.friends',

  // Blog methods
  blogEntryComments: '/blogEntry.comments',
  blogEntryView: '/blogEntry.view',

  // Other methods
  recentActions: '/recentActions',
} as const;

export const WEB_ENDPOINTS = {
  // Authentication
  enter: '/enter',
  logout: '/logout',

  // Problems
  problem: (contestId: number, index: string) => `/contest/${contestId}/problem/${index}`,
  contestProblem: (contestId: number, index: string) => `/contest/${contestId}/problem/${index}`,

  // Submission
  submit: '/problemset/submit',
  contestSubmit: (contestId: number) => `/contest/${contestId}/submit`,

  // Standings
  standings: (contestId: number) => `/contest/${contestId}/standings`,

  // User
  userProfile: (handle: string) => `/profile/${handle}`,

  // Contest
  contest: (contestId: number) => `/contest/${contestId}`,
  contestRegister: (contestId: number) => `/contestRegistration/${contestId}`,

  // Submissions
  submissions: (handle: string) => `/submissions/${handle}`,
  submissionStatus: (contestId: number, submissionId: number) => `/contest/${contestId}/submission/${submissionId}`,

  // Editorial
  editorial: (contestId: number) => `/blog/entry/${contestId}`, // This is approximate, editorials vary
} as const;

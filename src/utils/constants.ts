export const EXTENSION_ID = 'vscode-codeforces';
export const EXTENSION_NAME = 'Codeforces';

export const CODEFORCES_URL = 'https://codeforces.com';
export const API_BASE_URL = 'https://codeforces.com/api';

export const CACHE_TTL = {
  PROBLEMS: 24 * 60 * 60 * 1000, // 24 hours
  CONTESTS: 60 * 60 * 1000, // 1 hour
  USER: 15 * 60 * 1000, // 15 minutes
  SUBMISSIONS: 5 * 60 * 1000 // 5 minutes
};

export const PROBLEM_TAGS = [
  '2-sat',
  'binary search',
  'bitmasks',
  'brute force',
  'chinese remainder theorem',
  'combinatorics',
  'constructive algorithms',
  'data structures',
  'dfs and similar',
  'divide and conquer',
  'dp',
  'dsu',
  'expression parsing',
  'fft',
  'flows',
  'games',
  'geometry',
  'graph matchings',
  'graphs',
  'greedy',
  'hashing',
  'implementation',
  'interactive',
  'math',
  'matrices',
  'meet-in-the-middle',
  'number theory',
  'probabilities',
  'schedules',
  'shortest paths',
  'sortings',
  'string suffix structures',
  'strings',
  'ternary search',
  'trees',
  'two pointers'
];

export const RATING_RANGES = [
  { min: 800, max: 1000, label: '800-1000', color: '#808080' },
  { min: 1000, max: 1200, label: '1000-1200', color: '#008000' },
  { min: 1200, max: 1400, label: '1200-1400', color: '#03a89e' },
  { min: 1400, max: 1600, label: '1400-1600', color: '#03a89e' },
  { min: 1600, max: 1800, label: '1600-1800', color: '#0000ff' },
  { min: 1800, max: 2000, label: '1800-2000', color: '#0000ff' },
  { min: 2000, max: 2200, label: '2000-2200', color: '#aa00aa' },
  { min: 2200, max: 2400, label: '2200-2400', color: '#ff8c00' },
  { min: 2400, max: 2600, label: '2400-2600', color: '#ff8c00' },
  { min: 2600, max: 2800, label: '2600-2800', color: '#ff0000' },
  { min: 2800, max: 3000, label: '2800-3000', color: '#ff0000' },
  { min: 3000, max: 4000, label: '3000+', color: '#ff0000' }
];

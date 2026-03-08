import axios, { AxiosInstance, AxiosError } from 'axios';
import * as crypto from 'crypto';
import { API_BASE_URL, ENDPOINTS } from './endpoints';
import {
  ApiResponse,
  User,
  Problem,
  ProblemStatistics,
  Contest,
  Submission,
  RatingChange,
  Hack,
  RanklistRow,
  BlogEntry,
  Comment,
  RecentAction
} from './types';

export class CodeforcesApi {
  private client: AxiosInstance;
  private apiKey?: string;
  private apiSecret?: string;
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'User-Agent': 'VSCode-Codeforces-Extension/0.1.0'
      }
    });
  }

  setCredentials(apiKey: string, apiSecret: string): void {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  clearCredentials(): void {
    this.apiKey = undefined;
    this.apiSecret = undefined;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve =>
        setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
  }

  private generateApiSig(method: string, params: Record<string, string>): string {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API credentials not set');
    }

    const rand = Math.random().toString(36).substring(2, 8);
    const time = Math.floor(Date.now() / 1000).toString();

    const allParams: Record<string, string> = {
      ...params,
      apiKey: this.apiKey,
      time
    };

    // Sort parameters alphabetically
    const sortedParams = Object.keys(allParams)
      .sort()
      .map(key => `${key}=${allParams[key]}`)
      .join('&');

    const toHash = `${rand}/${method}?${sortedParams}#${this.apiSecret}`;
    const hash = crypto.createHash('sha512').update(toHash).digest('hex');

    return `${rand}${hash}`;
  }

  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | boolean> = {},
    requiresAuth: boolean = false
  ): Promise<T> {
    await this.rateLimit();

    const stringParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      stringParams[key] = String(value);
    }

    if (requiresAuth && this.apiKey && this.apiSecret) {
      const time = Math.floor(Date.now() / 1000).toString();
      stringParams.apiKey = this.apiKey;
      stringParams.time = time;
      stringParams.apiSig = this.generateApiSig(endpoint, stringParams);
    }

    try {
      const response = await this.client.get<ApiResponse<T>>(endpoint, {
        params: stringParams
      });

      if (response.data.status === 'FAILED') {
        throw new Error(response.data.comment || 'API request failed');
      }

      return response.data.result as T;
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 429) {
          // Rate limited, wait and retry
          await new Promise(resolve => setTimeout(resolve, 5000));
          return this.request<T>(endpoint, params, requiresAuth);
        }
        throw new Error(`API Error: ${error.message}`);
      }
      throw error;
    }
  }

  // Contest methods
  async getContestList(gym: boolean = false): Promise<Contest[]> {
    return this.request<Contest[]>(ENDPOINTS.contestList, { gym });
  }

  async getContestStandings(
    contestId: number,
    options: {
      from?: number;
      count?: number;
      handles?: string[];
      room?: number;
      showUnofficial?: boolean;
    } = {}
  ): Promise<{ contest: Contest; problems: Problem[]; rows: RanklistRow[] }> {
    const params: Record<string, string | number | boolean> = { contestId };
    if (options.from !== undefined) { params.from = options.from; }
    if (options.count !== undefined) { params.count = options.count; }
    if (options.handles?.length) { params.handles = options.handles.join(';'); }
    if (options.room !== undefined) { params.room = options.room; }
    if (options.showUnofficial !== undefined) { params.showUnofficial = options.showUnofficial; }

    return this.request(ENDPOINTS.contestStandings, params);
  }

  async getContestRatingChanges(contestId: number): Promise<RatingChange[]> {
    return this.request<RatingChange[]>(ENDPOINTS.contestRatingChanges, { contestId });
  }

  async getContestHacks(contestId: number): Promise<Hack[]> {
    return this.request<Hack[]>(ENDPOINTS.contestHacks, { contestId });
  }

  async getContestStatus(
    contestId: number,
    options: { handle?: string; from?: number; count?: number } = {}
  ): Promise<Submission[]> {
    const params: Record<string, string | number> = { contestId };
    if (options.handle) { params.handle = options.handle; }
    if (options.from !== undefined) { params.from = options.from; }
    if (options.count !== undefined) { params.count = options.count; }

    return this.request<Submission[]>(ENDPOINTS.contestStatus, params);
  }

  // Problemset methods
  async getProblemsetProblems(
    options: { tags?: string[]; problemsetName?: string } = {}
  ): Promise<{ problems: Problem[]; problemStatistics: ProblemStatistics[] }> {
    const params: Record<string, string> = {};
    if (options.tags?.length) { params.tags = options.tags.join(';'); }
    if (options.problemsetName) { params.problemsetName = options.problemsetName; }

    return this.request(ENDPOINTS.problemsetProblems, params);
  }

  async getProblemsetRecentStatus(
    count: number,
    problemsetName?: string
  ): Promise<Submission[]> {
    const params: Record<string, string | number> = { count };
    if (problemsetName) { params.problemsetName = problemsetName; }

    return this.request<Submission[]>(ENDPOINTS.problemsetRecentStatus, params);
  }

  // User methods
  async getUserInfo(handles: string[]): Promise<User[]> {
    return this.request<User[]>(ENDPOINTS.userInfo, { handles: handles.join(';') });
  }

  async getUserRating(handle: string): Promise<RatingChange[]> {
    return this.request<RatingChange[]>(ENDPOINTS.userRating, { handle });
  }

  async getUserStatus(
    handle: string,
    options: { from?: number; count?: number } = {}
  ): Promise<Submission[]> {
    const params: Record<string, string | number> = { handle };
    if (options.from !== undefined) { params.from = options.from; }
    if (options.count !== undefined) { params.count = options.count; }

    return this.request<Submission[]>(ENDPOINTS.userStatus, params);
  }

  async getUserRatedList(
    activeOnly: boolean = false,
    includeRetired: boolean = false,
    contestId?: number
  ): Promise<User[]> {
    const params: Record<string, string | number | boolean> = {
      activeOnly,
      includeRetired
    };
    if (contestId !== undefined) { params.contestId = contestId; }

    return this.request<User[]>(ENDPOINTS.userRatedList, params);
  }

  async getUserBlogEntries(handle: string): Promise<BlogEntry[]> {
    return this.request<BlogEntry[]>(ENDPOINTS.userBlogEntries, { handle });
  }

  async getUserFriends(onlyOnline: boolean = false): Promise<string[]> {
    return this.request<string[]>(ENDPOINTS.userFriends, { onlyOnline }, true);
  }

  // Blog methods
  async getBlogEntryComments(blogEntryId: number): Promise<Comment[]> {
    return this.request<Comment[]>(ENDPOINTS.blogEntryComments, { blogEntryId });
  }

  async getBlogEntryView(blogEntryId: number): Promise<BlogEntry> {
    return this.request<BlogEntry>(ENDPOINTS.blogEntryView, { blogEntryId });
  }

  // Other methods
  async getRecentActions(maxCount: number = 100): Promise<RecentAction[]> {
    return this.request<RecentAction[]>(ENDPOINTS.recentActions, { maxCount });
  }
}

// Export singleton instance
export const codeforcesApi = new CodeforcesApi();

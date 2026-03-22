import * as vscode from 'vscode';
import { codeforcesApi } from '../api';
import { User, UserSession } from '../api/types';
import { getUserStatsService } from './userStatsService';
import { getStorageService } from './storageService';

export class AuthService {
  private _onDidChangeSession = new vscode.EventEmitter<UserSession | undefined>();
  readonly onDidChangeSession = this._onDidChangeSession.event;

  private currentUser: User | undefined;
  private session: UserSession | undefined;

  async initialize(): Promise<void> {
    const storage = getStorageService();
    this.session = await storage.getSession();

    if (this.session?.isLoggedIn && this.session.apiKey && this.session.apiSecret) {
      codeforcesApi.setCredentials(this.session.apiKey, this.session.apiSecret);
    }

    if (this.session?.isLoggedIn && this.session.handle) {
      await this.refreshUserInfo();
    }
  }

  isLoggedIn(): boolean {
    return this.session?.isLoggedIn ?? false;
  }

  getCurrentUser(): User | undefined {
    return this.currentUser;
  }

  getCurrentSession(): UserSession | undefined {
    return this.session;
  }

  async login(): Promise<boolean> {
    const handle = await vscode.window.showInputBox({
      prompt: 'Enter your Codeforces handle',
      placeHolder: 'tourist',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Handle cannot be empty';
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
          return 'Invalid handle format';
        }
        return null;
      }
    });

    if (!handle) {
      return false;
    }

    const authChoice = await vscode.window.showQuickPick(
      [
        {
          label: 'Enter API key and secret',
          value: 'with-api',
          description: 'Recommended for authenticated API features'
        },
        {
          label: 'Continue without API credentials',
          value: 'without-api',
          description: 'Public problems, contests, and profile only'
        },
        {
          label: 'Cancel login',
          value: 'cancel',
          description: 'Abort login without changing the current session'
        }
      ],
      {
        placeHolder: 'Choose how to sign in to Codeforces',
        title: 'Codeforces Authentication'
      }
    );

    if (!authChoice || authChoice.value === 'cancel') {
      return false;
    }

    let apiKey: string | undefined;
    let apiSecret: string | undefined;

    if (authChoice.value === 'with-api') {
      const credentials = await this.promptForApiCredentials();
      if (!credentials) {
        return false;
      }

      apiKey = credentials.apiKey;
      apiSecret = credentials.apiSecret;
    }

    try {
      // Verify the handle exists
      const users = await codeforcesApi.getUserInfo([handle]);
      if (!users || users.length === 0) {
        vscode.window.showErrorMessage(`User '${handle}' not found on Codeforces`);
        return false;
      }

      this.currentUser = users[0];

      // Set API credentials if provided
      if (apiKey && apiSecret) {
        codeforcesApi.setCredentials(apiKey, apiSecret);
      }

      // Save session
      const newHandle = handle.trim();
      const isSameUser = this.session?.handle?.toLowerCase() === newHandle.toLowerCase();

      this.session = {
        ...this.session,
        handle: newHandle,
        isLoggedIn: true,
        apiKey: apiKey ?? (isSameUser ? this.session?.apiKey : undefined),
        apiSecret: apiSecret ?? (isSameUser ? this.session?.apiSecret : undefined)
      };

      const storage = getStorageService();
      await storage.saveSession(this.session);

      // Update VS Code config
      await vscode.workspace.getConfiguration('codeforces').update('handle', handle, true);

      this._onDidChangeSession.fire(this.session);
      vscode.window.showInformationMessage(`Logged in as ${this.currentUser.handle} (${this.currentUser.rank})`);

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async logout(): Promise<void> {
    const storage = getStorageService();
    await storage.clearSession();

    codeforcesApi.clearCredentials();
    this.currentUser = undefined;
    this.session = undefined;

    this._onDidChangeSession.fire(undefined);
    vscode.window.showInformationMessage('Logged out from Codeforces');
  }

  async configureApiCredentials(): Promise<boolean> {
    if (!this.session?.isLoggedIn || !this.session.handle) {
      vscode.window.showWarningMessage('Login with your Codeforces handle first.');
      return false;
    }

    const credentials = await this.promptForApiCredentials();
    if (!credentials) {
      return false;
    }

    this.session = {
      ...this.session,
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret
    };

    codeforcesApi.setCredentials(credentials.apiKey, credentials.apiSecret);

    const storage = getStorageService();
    await storage.saveSession(this.session);
    this._onDidChangeSession.fire(this.session);
    vscode.window.showInformationMessage('Codeforces API credentials saved.');

    return true;
  }

  private async promptForApiCredentials(): Promise<{ apiKey: string; apiSecret: string } | undefined> {
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Codeforces API Key',
      placeHolder: 'Get it from https://codeforces.com/settings/api',
      password: false,
      ignoreFocusOut: true,
      validateInput: value => value.trim().length === 0 ? 'API Key cannot be empty' : null
    });

    if (!apiKey) {
      vscode.window.showWarningMessage('API credential setup canceled.');
      return undefined;
    }

    const apiSecret = await vscode.window.showInputBox({
      prompt: 'Enter your Codeforces API Secret',
      password: true,
      ignoreFocusOut: true,
      validateInput: value => value.trim().length === 0 ? 'API Secret cannot be empty' : null
    });

    if (!apiSecret) {
      vscode.window.showWarningMessage('API credential setup canceled.');
      return undefined;
    }

    return {
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim()
    };
  }

  async refreshUserInfo(): Promise<void> {
    if (!this.session?.handle) {
      return;
    }

    try {
      const users = await codeforcesApi.getUserInfo([this.session.handle]);
      if (users && users.length > 0) {
        this.currentUser = users[0];
      }
    } catch (error) {
      console.error('Failed to refresh user info:', error);
    }
  }

  async showProfile(): Promise<void> {
    if (!this.currentUser) {
      vscode.window.showWarningMessage('Not logged in. Please login first.');
      return;
    }

    const ratingHistory = await codeforcesApi.getUserRating(this.currentUser.handle);
    const analytics = await getUserStatsService().getSnapshot(this.currentUser.handle);
    const ratingBreakdown = analytics.ratingBuckets
      .filter(bucket => bucket.count > 0)
      .map(bucket => `- ${bucket.label}: ${bucket.count}`)
      .join('\n');
    const topTags = analytics.topTags.length > 0
      ? analytics.topTags.map(tag => `- ${tag.tag}: ${tag.count}`).join('\n')
      : '- No solved tag data yet';
    const hardestSolved = analytics.mostDifficultSolved
      ? `**Hardest Solved:** ${analytics.mostDifficultSolved.contestId}${analytics.mostDifficultSolved.index} - ${analytics.mostDifficultSolved.name}${analytics.mostDifficultSolved.rating ? ` (${analytics.mostDifficultSolved.rating})` : ''}`
      : '';
    const snapshotSummary = analytics.isPartial
      ? `Latest ${analytics.analyzedSubmissionCount} submissions analyzed`
      : `${analytics.analyzedSubmissionCount} submissions analyzed`;

    const info = `
# ${this.currentUser.handle}

**Rank:** ${this.currentUser.rank}
**Rating:** ${this.currentUser.rating} (max: ${this.currentUser.maxRating})
**Contribution:** ${this.currentUser.contribution}
**Friend of:** ${this.currentUser.friendOfCount}
**Contests:** ${ratingHistory.length}
**Solved Problems:** ${analytics.solvedProblemCount}
**Attempted Unsolved:** ${analytics.attemptedUnsolvedCount}
**Acceptance Rate:** ${(analytics.acceptanceRate * 100).toFixed(1)}% (${analytics.acceptedSubmissionCount}/${analytics.analyzedSubmissionCount})
**Snapshot:** ${snapshotSummary}

${this.currentUser.organization ? `**Organization:** ${this.currentUser.organization}` : ''}
${this.currentUser.country ? `**Country:** ${this.currentUser.country}` : ''}
${hardestSolved}

## Problems By Rating

${ratingBreakdown || '- No solved problems with rating data yet'}

## Top Tags

${topTags}
    `.trim();

    const doc = await vscode.workspace.openTextDocument({
      content: info,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc, { preview: true });
  }
}

let authServiceInstance: AuthService | undefined;

export function initAuthService(): AuthService {
  authServiceInstance = new AuthService();
  return authServiceInstance;
}

export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    throw new Error('Auth service not initialized');
  }
  return authServiceInstance;
}

import * as vscode from 'vscode';
import { initStorageService } from './services/storageService';
import { initAuthService } from './services/authService';
import { initTemplateService } from './services/templateService';
import { initTestService, getTestService } from './services/testService';
import { initSubmissionService, getSubmissionService } from './services/submissionService';
import { initProblemsExplorer } from './views/problemsExplorer';
import { initContestsExplorer, getContestsExplorer } from './views/contestsExplorer';
import { initSubmissionsView } from './views/submissionsView';
import { ProfileWebviewProvider } from './views/profileWebviewProvider';
import { registerCommands } from './commands';
import { logger } from './utils/logger';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger.info('Activating Codeforces extension...');

  try {
    // Initialize services
    initStorageService(context);
    const authService = initAuthService();
    initTemplateService();
    initTestService();
    initSubmissionService();

    // Initialize auth (restore session)
    await authService.initialize();
    await updateAuthContext(authService.isLoggedIn());

    // Initialize views
    const problemsExplorer = initProblemsExplorer();
    const contestsExplorer = initContestsExplorer();
    const submissionsView = initSubmissionsView();

    // Register tree data providers
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('codeforcesProblems', problemsExplorer),
      vscode.window.registerTreeDataProvider('codeforcesContests', contestsExplorer),
      vscode.window.registerTreeDataProvider('codeforcesSubmissions', submissionsView)
    );

    const profileWebviewProvider = new ProfileWebviewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('codeforcesUserDashboard', profileWebviewProvider)
    );

    // Register commands
    registerCommands(context);

    // Register CodeLens provider for Codeforces files
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { pattern: '**/cf_*' },
        new CodeforcesCodeLensProvider()
      )
    );

    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    statusBarItem.command = 'codeforces.showProfile';
    updateStatusBar(statusBarItem, authService.isLoggedIn(), authService.getCurrentUser()?.handle);
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Listen for auth changes
    authService.onDidChangeSession(async session => {
      await updateAuthContext(!!session);
      updateStatusBar(statusBarItem, !!session, session?.handle);
    });

    // Cleanup on deactivate
    context.subscriptions.push({
      dispose: () => {
        getTestService().dispose();
        getSubmissionService().dispose();
        getContestsExplorer().dispose();
        logger.dispose();
      }
    });

    logger.info('Codeforces extension activated successfully');
    vscode.window.showInformationMessage('Codeforces extension activated!');

  } catch (error) {
    logger.error('Failed to activate extension', error instanceof Error ? error : new Error(String(error)));
    vscode.window.showErrorMessage('Failed to activate Codeforces extension');
    throw error;
  }
}

export function deactivate(): void {
  logger.info('Deactivating Codeforces extension...');
}

function updateStatusBar(
  statusBarItem: vscode.StatusBarItem,
  isLoggedIn: boolean,
  handle?: string
): void {
  if (isLoggedIn && handle) {
    statusBarItem.text = `$(account) CF: ${handle}`;
    statusBarItem.tooltip = `Logged in as ${handle}`;
    statusBarItem.command = 'codeforces.showProfile';
  } else {
    statusBarItem.text = '$(account) Codeforces: Login';
    statusBarItem.tooltip = 'Click to login to Codeforces';
    statusBarItem.command = 'codeforces.login';
  }
}

async function updateAuthContext(isLoggedIn: boolean): Promise<void> {
  await vscode.commands.executeCommand('setContext', 'codeforces.isLoggedIn', isLoggedIn);
}

class CodeforcesCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const topOfDocument = new vscode.Range(0, 0, 0, 0);
    const filePath = document.uri.fsPath;

    // Submit button
    codeLenses.push(
      new vscode.CodeLens(topOfDocument, {
        title: '$(cloud-upload)  Submit',
        command: 'codeforces.submit',
        tooltip: 'Submit solution to Codeforces',
        arguments: [filePath]
      })
    );

    // Run tests button
    codeLenses.push(
      new vscode.CodeLens(topOfDocument, {
        title: '$(play-circle)  Run Tests',
        command: 'codeforces.runTests',
        tooltip: 'Run all sample test cases',
        arguments: [filePath]
      })
    );

    // Custom test button
    codeLenses.push(
      new vscode.CodeLens(topOfDocument, {
        title: '$(beaker)  Custom Test',
        command: 'codeforces.customTest',
        tooltip: 'Run with custom input',
        arguments: [filePath]
      })
    );

    // Preview problem
    codeLenses.push(
      new vscode.CodeLens(topOfDocument, {
        title: '$(preview)  Preview',
        command: 'codeforces.previewProblem',
        tooltip: 'Open problem statement'
      })
    );

    return codeLenses;
  }
}

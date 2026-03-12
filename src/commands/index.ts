import * as vscode from 'vscode';
import { getAuthService } from '../services/authService';
import { getStorageService } from '../services/storageService';
import { getTemplateService } from '../services/templateService';
import { getTestService } from '../services/testService';
import { getSubmissionService } from '../services/submissionService';
import { getProblemsExplorer } from '../views/problemsExplorer';
import { getContestsExplorer } from '../views/contestsExplorer';
import { getSubmissionsView, type VerdictFilter } from '../views/submissionsView';
import { TestResultsPanel } from '../views/testResultsPanel';
import { ProblemPreview } from '../views/problemPreview';
import { SolvedProblemsPanel } from '../views/solvedProblemsPanel';
import { ContestDetailPanel } from '../views/contestDetailPanel';
import { StandingsPanel } from '../views/standingsPanel';
import { ProfileSummaryPanel } from '../views/profileSummaryPanel';
import { getProfileWebviewProvider } from '../views/profileWebviewProvider';
import { Problem, Contest, SupportedLanguage, LANGUAGE_CONFIGS, TestCase } from '../api/types';
import { WEB_BASE_URL, WEB_ENDPOINTS } from '../api/endpoints';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export function registerCommands(context: vscode.ExtensionContext): void {
  // Authentication commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.login', async () => {
      const authService = getAuthService();
      await authService.login();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.logout', async () => {
      const authService = getAuthService();
      await authService.logout();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.configureApiCredentials', async () => {
      const authService = getAuthService();
      await authService.configureApiCredentials();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.showProfile', async () => {
      const authService = getAuthService();
      if (!authService.isLoggedIn()) {
        vscode.window.showWarningMessage('Please login first to view your profile.');
        return;
      }
      await ProfileSummaryPanel.show(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.refreshProfile', async () => {
      const provider = getProfileWebviewProvider();
      await provider.refreshForced();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.showRatingGraph', async () => {
      const provider = getProfileWebviewProvider();
      await provider.showRatingGraph();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.openProfileOnWeb', async () => {
      const authService = getAuthService();
      const handle = authService.getCurrentUser()?.handle;

      if (!handle) {
        vscode.window.showWarningMessage('Not logged in. Please login first.');
        return;
      }

      await vscode.env.openExternal(vscode.Uri.parse(`https://codeforces.com/profile/${encodeURIComponent(handle)}`));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.viewProfile', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.codeforces');

      const availableCommands = await vscode.commands.getCommands(true);
      if (availableCommands.includes('codeforcesUser.focus')) {
        await vscode.commands.executeCommand('codeforcesUser.focus');
      }
    })
  );

  // Problem commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.refreshProblems', () => {
      const explorer = getProblemsExplorer();
      explorer.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.searchProblem', () => {
      const explorer = getProblemsExplorer();
      explorer.searchProblems();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.openProblem', async (contestId?: number, index?: string) => {
      if (!contestId || !index) {
        const input = await vscode.window.showInputBox({
          prompt: 'Enter problem ID (e.g., 1A, 1900A)',
          placeHolder: '1A'
        });

        if (!input) { return; }

        const match = input.match(/^(\d+)([A-Z]\d?)$/i);
        if (!match) {
          vscode.window.showErrorMessage('Invalid problem ID format. Use format like "1A" or "1900B"');
          return;
        }

        contestId = parseInt(match[1]);
        index = match[2].toUpperCase();
      }

      vscode.commands.executeCommand('codeforces.previewProblem', contestId, index, '');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.previewProblem', async (
      contestIdOrUri: number | vscode.Uri,
      index?: string,
      name?: string
    ) => {
      let contestId: number;
      if (contestIdOrUri instanceof vscode.Uri || contestIdOrUri === undefined) {
        const filePath = contestIdOrUri instanceof vscode.Uri
          ? contestIdOrUri.fsPath
          : vscode.window.activeTextEditor?.document.uri.fsPath;
        if (!filePath) {
          vscode.window.showErrorMessage('No active file');
          return;
        }
        const metadataPath = path.join(path.dirname(filePath), '.problem.json');
        if (!fs.existsSync(metadataPath)) {
          vscode.window.showErrorMessage('No problem metadata found. Open the problem from the Problems view first.');
          return;
        }
        const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        contestId = meta.contestId;
        index = meta.index;
        name = meta.name;
      } else {
        contestId = contestIdOrUri;
      }
      await ProblemPreview.show(context, contestId, index!, name!);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.openProblemInVsCode', async (contestId: number, index: string) => {
      const problemUrl = `${WEB_BASE_URL}${WEB_ENDPOINTS.problem(contestId, index)}`;

      await vscode.commands.executeCommand(
        'setContext',
        'codeforces.lastOpenedProblemUrl',
        problemUrl
      );

      try {
        await vscode.commands.executeCommand('simpleBrowser.show', problemUrl);
        return;
      } catch {
        // Fall through to generic URL opening for environments without Simple Browser.
      }

      try {
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(problemUrl));
        return;
      } catch {
        // Final fallback for environments where URLs cannot open as editors.
      }

      await vscode.env.openExternal(vscode.Uri.parse(problemUrl));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.starProblem', async (item: { problem: Problem }) => {
      if (!item?.problem?.contestId) { return; }
      const storage = getStorageService();
      await storage.addStarredProblem(item.problem.contestId, item.problem.index);
      vscode.window.showInformationMessage(`Starred ${item.problem.contestId}${item.problem.index}`);
      getProblemsExplorer().refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.unstarProblem', async (item: { problem: Problem }) => {
      if (!item?.problem?.contestId) { return; }
      const storage = getStorageService();
      await storage.removeStarredProblem(item.problem.contestId, item.problem.index);
      vscode.window.showInformationMessage(`Unstarred ${item.problem.contestId}${item.problem.index}`);
      getProblemsExplorer().refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.markProblemAsSolved', async (item: { problem: Problem }) => {
      if (!item?.problem?.contestId) { return; }
      const storage = getStorageService();

      if (storage.isSolved(item.problem.contestId, item.problem.index)) {
        vscode.window.showInformationMessage(`${item.problem.contestId}${item.problem.index} is already marked as solved`);
        return;
      }

      await storage.addLocallySolvedProblem(item.problem.contestId, item.problem.index);
      vscode.window.showInformationMessage(`Marked ${item.problem.contestId}${item.problem.index} as solved`);
      getProblemsExplorer().refreshView();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.unmarkProblemAsSolved', async (item: { problem: Problem }) => {
      if (!item?.problem?.contestId) { return; }
      const storage = getStorageService();

      // Remove from solved list
      const solved = storage.getSolvedProblems().filter(
        p => !(p.contestId === item.problem.contestId && p.index === item.problem.index)
      );
      await context.globalState.update('codeforces.solved', solved);

      vscode.window.showInformationMessage(`Unmarked ${item.problem.contestId}${item.problem.index} as solved`);
      getProblemsExplorer().refreshView();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.openProblemOnWeb', async (item: { problem: Problem }) => {
      if (!item?.problem?.contestId) { return; }
      const url = `https://codeforces.com/problemset/problem/${item.problem.contestId}/${item.problem.index}`;
      await vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.viewProblemSubmissions', async (item: { problem: Problem }) => {
      if (!item?.problem?.contestId) { return; }
      const authService = getAuthService();
      const user = authService.getCurrentUser();

      if (!user) {
        vscode.window.showWarningMessage('Please login to view your submissions');
        return;
      }

      const url = `https://codeforces.com/problemset/status/${item.problem.contestId}/problem/${item.problem.index}?friends=on`;
      await vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );

  // Test commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.runTests', async (target?: string | { contestId: number; index: string }) => {
      const filePath = await resolveSolutionFilePath(target);
      if (!filePath) {
        vscode.window.showErrorMessage(getRunTestsMissingFileMessage(target));
        return;
      }

      const editor = vscode.window.visibleTextEditors.find(candidate => candidate.document.uri.fsPath === filePath)
        ?? vscode.window.activeTextEditor;

      if (editor && editor.document.uri.fsPath === filePath) {
        await editor.document.save();
      }

      const testService = getTestService();
      try {
        const results = await testService.runTests(filePath, {
          revealOutput: false,
          showNotifications: false
        });
        TestResultsPanel.show(context, {
          filePath,
          results,
          problem: testService.getProblemMetadata(filePath)
        });
      } catch (error) {
        TestResultsPanel.show(context, {
          filePath,
          results: [],
          problem: testService.getProblemMetadata(filePath),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
        vscode.window.showErrorMessage(
          `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.customTest', async (targetFilePath?: string | vscode.Uri) => {
      const filePath = (targetFilePath instanceof vscode.Uri ? targetFilePath.fsPath : targetFilePath) ?? vscode.window.activeTextEditor?.document.uri.fsPath;
      if (!filePath) {
        vscode.window.showErrorMessage('No active file');
        return;
      }

      const input = await vscode.window.showInputBox({
        prompt: 'Enter custom input (use \\n for newlines)',
        placeHolder: '5\\n1 2 3 4 5'
      });

      if (!input) { return; }

      const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === filePath)
        ?? vscode.window.activeTextEditor;
      if (editor && editor.document.uri.fsPath === filePath) {
        await editor.document.save();
      }

      const testService = getTestService();
      const formattedInput = input.replace(/\\n/g, '\n');

      try {
        const output = await testService.runCustomTest(filePath, formattedInput);
        const outputChannel = vscode.window.createOutputChannel('Codeforces Custom Test');
        outputChannel.clear();
        outputChannel.appendLine('--- Input ---');
        outputChannel.appendLine(formattedInput);
        outputChannel.appendLine('\n--- Output ---');
        outputChannel.appendLine(output);
        outputChannel.show();
      } catch (error) {
        vscode.window.showErrorMessage(
          `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.importSamplesFromClipboard', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active file');
        return;
      }

      const templateService = getTemplateService();
      const language = templateService.getLanguageFromExtension(editor.document.uri.fsPath);
      if (!language) {
        vscode.window.showErrorMessage('Open a supported Codeforces solution file first');
        return;
      }

      const clipboardText = await vscode.env.clipboard.readText();
      const testCases = parseSampleTests(clipboardText);

      if (testCases.length === 0) {
        vscode.window.showErrorMessage(
          'No sample tests found in clipboard. Copy the Examples section from the Codeforces page and try again.'
        );
        return;
      }

      const problemFolder = path.dirname(editor.document.uri.fsPath);
      await templateService.saveTestCases(problemFolder, testCases);

      const action = await vscode.window.showInformationMessage(
        `Imported ${testCases.length} sample test(s) from clipboard.`,
        'Run Tests'
      );

      if (action === 'Run Tests') {
        await vscode.commands.executeCommand('codeforces.runTests');
      }
    })
  );

  // Submission command
  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.submit', async (target?: string | vscode.Uri) => {
      const filePath = (target instanceof vscode.Uri ? target.fsPath : target) ?? vscode.window.activeTextEditor?.document.uri.fsPath;
      if (!filePath) {
        vscode.window.showErrorMessage('No active file');
        return;
      }

      const fileName = path.basename(filePath);

      // Try to extract problem info from filename or metadata
      const match = fileName.match(/cf_(\d+)([A-Z]\d?)/i);
      let contestId: number | undefined;
      let index: string | undefined;

      if (match) {
        contestId = parseInt(match[1]);
        index = match[2].toUpperCase();
      } else {
        // Try to read from .problem.json
        const metadataPath = path.join(path.dirname(filePath), '.problem.json');
        if (fs.existsSync(metadataPath)) {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          contestId = metadata.contestId;
          index = metadata.index;
        }
      }

      if (!contestId || !index) {
        const input = await vscode.window.showInputBox({
          prompt: 'Enter problem ID (e.g., 1A)',
          placeHolder: '1A'
        });

        if (!input) { return; }

        const inputMatch = input.match(/^(\d+)([A-Z]\d?)$/i);
        if (!inputMatch) {
          vscode.window.showErrorMessage('Invalid problem ID format');
          return;
        }

        contestId = parseInt(inputMatch[1]);
        index = inputMatch[2].toUpperCase();
      }

      // Detect language
      const templateService = getTemplateService();
      const language = templateService.getLanguageFromExtension(filePath);

      if (!language) {
        vscode.window.showErrorMessage('Unsupported file type for submission');
        return;
      }

      // Save and submit
      const editor = vscode.window.visibleTextEditors.find(candidate => candidate.document.uri.fsPath === filePath)
        ?? vscode.window.activeTextEditor;

      if (editor && editor.document.uri.fsPath === filePath) {
        await editor.document.save();
      }

      const submissionService = getSubmissionService();
      try {
        await submissionService.submit(filePath, contestId, index, language);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    })
  );

  // Contest commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.refreshContests', () => {
      const explorer = getContestsExplorer();
      explorer.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.openContest', async (contest?: Contest) => {
      if (contest) {
        await ContestDetailPanel.show(context, contest.id);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.showStandings', async (...args: unknown[]) => {
      const contestId = args[0] as number;
      if (contestId) {
        await StandingsPanel.show(context, contestId);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.registerContest', (item?: { contest: Contest }) => {
      if (item?.contest) {
        vscode.env.openExternal(
          vscode.Uri.parse(`https://codeforces.com/contestRegistration/${item.contest.id}`)
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.viewStandings', (item?: { contest: Contest }) => {
      if (item?.contest) {
        vscode.env.openExternal(
          vscode.Uri.parse(`https://codeforces.com/contest/${item.contest.id}/standings`)
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.virtualContest', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter contest ID for virtual participation',
        placeHolder: '1900'
      });

      if (!input) { return; }

      const contestId = parseInt(input);
      if (isNaN(contestId)) {
        vscode.window.showErrorMessage('Invalid contest ID');
        return;
      }

      vscode.env.openExternal(
        vscode.Uri.parse(`https://codeforces.com/contest/${contestId}/virtual`)
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.viewContests', async () => {
      await vscode.commands.executeCommand('codeforcesContests.focus');
    })
  );

  // User commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.viewSubmissions', async () => {
      const authService = getAuthService();
      const user = authService.getCurrentUser();

      if (!user) {
        vscode.window.showWarningMessage('Please login first');
        return;
      }

      vscode.env.openExternal(
        vscode.Uri.parse(`https://codeforces.com/submissions/${user.handle}`)
      );
    })
  );

  // Settings commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.setLanguage', async () => {
      const languages = Object.entries(LANGUAGE_CONFIGS).map(([key, config]) => ({
        label: config.displayName,
        value: key as SupportedLanguage
      }));

      const selected = await vscode.window.showQuickPick(
        languages.map(l => ({ label: l.label, value: l.value })),
        { placeHolder: 'Select default programming language' }
      );

      if (selected) {
        await vscode.workspace.getConfiguration('codeforces')
          .update('defaultLanguage', selected.value, true);
        vscode.window.showInformationMessage(`Default language set to ${selected.label}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.openEditorial', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter problem or contest ID',
        placeHolder: '1900 or 1900A'
      });

      if (!input) { return; }

      const match = input.match(/^(\d+)/);
      if (!match) {
        vscode.window.showErrorMessage('Invalid ID format');
        return;
      }

      const contestId = match[1];
      vscode.env.openExternal(
        vscode.Uri.parse(`https://codeforces.com/blog/entry/${contestId}`)
      );
    })
  );

  // Filter commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.filterByTag', async () => {
      const tags = [
        'implementation', 'math', 'greedy', 'dp', 'data structures',
        'brute force', 'constructive algorithms', 'graphs', 'sortings',
        'binary search', 'dfs and similar', 'trees', 'strings', 'number theory',
        'geometry', 'combinatorics', 'two pointers', 'bitmasks', 'probabilities'
      ];

      const selected = await vscode.window.showQuickPick(tags, {
        placeHolder: 'Select tag to filter by'
      });

      if (selected) {
        const explorer = getProblemsExplorer();
        explorer.setFilter({ tags: [selected] });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.filterByRating', async () => {
      const ratings = [
        '800-1000', '1000-1200', '1200-1400', '1400-1600',
        '1600-1800', '1800-2000', '2000-2200', '2200-2400',
        '2400-2600', '2600-3000', '3000+'
      ];

      const selected = await vscode.window.showQuickPick(ratings, {
        placeHolder: 'Select rating range'
      });

      if (selected) {
        const [min, max] = selected.split('-').map(s => parseInt(s.replace('+', '')));
        const explorer = getProblemsExplorer();
        explorer.setFilter({
          ratingMin: min,
          ratingMax: max || 4000
        });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.clearFilters', () => {
      const explorer = getProblemsExplorer();
      explorer.clearFilter();
      vscode.window.showInformationMessage('Filters cleared');
    })
  );

  // Submission commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.refreshSubmissions', () => {
      const submissionsView = getSubmissionsView();
      submissionsView.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.filterSubmissions', (filter: VerdictFilter) => {
      const submissionsView = getSubmissionsView();
      submissionsView.setFilter(filter);
    })
  );

  // Solved problems browser
  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.showSolvedProblems', async () => {
      const authService = getAuthService();
      if (!authService.isLoggedIn()) {
        vscode.window.showWarningMessage('Please login first to view solved problems.');
        return;
      }
      SolvedProblemsPanel.show(context);
    })
  );

  // Template management
  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.editTemplate', async () => {
      const templateService = getTemplateService();

      const languages = Object.entries(LANGUAGE_CONFIGS).map(([key, config]) => ({
        label: config.displayName,
        value: key as SupportedLanguage,
        extension: config.extension
      }));

      const selected = await vscode.window.showQuickPick(
        languages.map(l => ({ label: l.label, value: l.value, extension: l.extension })),
        { placeHolder: 'Select language to edit template' }
      );

      if (!selected) { return; }

      const workspaceFolder = vscode.workspace.getConfiguration('codeforces')
        .get<string>('workspaceFolder', '').trim() || path.join(os.homedir(), '.codeforces');
      const expandedFolder = workspaceFolder.replace(/^~(?=$|\/)/, os.homedir());
      const templatesFolder = path.join(expandedFolder, 'templates');

      if (!fs.existsSync(templatesFolder)) {
        fs.mkdirSync(templatesFolder, { recursive: true });
      }

      const configKey = `template.${selected.value}`;
      const existingPath = vscode.workspace.getConfiguration('codeforces').get<string>(configKey, '').trim();
      const expandedExisting = existingPath.replace(/^~(?=$|\/)/, os.homedir());

      let templatePath: string;
      if (existingPath && fs.existsSync(expandedExisting)) {
        templatePath = expandedExisting;
      } else {
        templatePath = path.join(templatesFolder, `template${selected.extension}`);
        if (!fs.existsSync(templatePath)) {
          fs.writeFileSync(templatePath, templateService.getDefaultTemplate(selected.value), 'utf-8');
        }
        await vscode.workspace.getConfiguration('codeforces').update(configKey, templatePath, true);
      }

      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(templatePath));
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(
        `Editing ${selected.label} template. Save the file — it will be used for all new ${selected.label} solution files.`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.resetTemplate', async () => {
      const templateService = getTemplateService();

      const languages = Object.entries(LANGUAGE_CONFIGS).map(([key, config]) => ({
        label: config.displayName,
        value: key as SupportedLanguage
      }));

      const selected = await vscode.window.showQuickPick(
        languages.map(l => ({ label: l.label, value: l.value })),
        { placeHolder: 'Select language to reset template to built-in default' }
      );

      if (!selected) { return; }

      const confirmed = await vscode.window.showWarningMessage(
        `Reset ${selected.label} template to the built-in default? Any custom template file will be kept on disk but the setting will be cleared.`,
        { modal: true },
        'Reset'
      );

      if (confirmed !== 'Reset') { return; }

      await vscode.workspace.getConfiguration('codeforces')
        .update(`template.${selected.value}`, undefined, true);

      vscode.window.showInformationMessage(
        `${selected.label} template reset to built-in default. New solution files will use the default template.`
      );

      void templateService; // service available if needed in future
    })
  );

  // Daily problem
  context.subscriptions.push(
    vscode.commands.registerCommand('codeforces.dailyProblem', async () => {
      const explorer = getProblemsExplorer();
      const problems = explorer.getProblems();

      if (problems.length === 0) {
        vscode.window.showInformationMessage('Problems not loaded yet. Please wait and try again.');
        return;
      }

      const authService = getAuthService();
      const storage = getStorageService();
      const userRating = authService.getCurrentUser()?.rating ?? 1200;
      const seed = Math.floor(Date.now() / 86400000);
      const today = new Date().toISOString().slice(0, 10);

      const cached = context.globalState.get<{ date: string; contestId: number; index: string; name: string }>('codeforces.dailyProblem');
      if (cached && cached.date === today) {
        await vscode.commands.executeCommand('codeforces.previewProblem', cached.contestId, cached.index, cached.name);
        return;
      }

      const solved = new Set(storage.getSolvedProblems().map(p => `${p.contestId}${p.index}`));
      const eligible = problems.filter(p => {
        if (!p.rating || !p.contestId) { return false; }
        if (solved.has(`${p.contestId}${p.index}`)) { return false; }
        return p.rating >= userRating - 100 && p.rating <= userRating + 300;
      });

      if (eligible.length === 0) {
        vscode.window.showInformationMessage('No eligible problems found for today. Try adjusting your rating range.');
        return;
      }

      const problem = eligible[seed % eligible.length];
      await context.globalState.update('codeforces.dailyProblem', {
        date: today,
        contestId: problem.contestId,
        index: problem.index,
        name: problem.name
      });

      await vscode.commands.executeCommand('codeforces.previewProblem', problem.contestId!, problem.index, problem.name);
    })
  );
}

async function resolveSolutionFilePath(
  target?: string | { contestId: number; index: string } | vscode.Uri
): Promise<string | undefined> {
  if (target instanceof vscode.Uri) {
    target = target.fsPath;
  }
  if (typeof target === 'string') {
    return target;
  }

  const activePath = getSupportedEditorPath(vscode.window.activeTextEditor, target);
  if (activePath) {
    return activePath;
  }

  const visibleCandidates: string[] = [];
  for (const editor of vscode.window.visibleTextEditors) {
    const candidate = getSupportedEditorPath(editor, target);
    if (candidate) {
      visibleCandidates.push(candidate);
    }
  }

  const uniqueVisibleCandidates = Array.from(new Set(visibleCandidates));
  if (uniqueVisibleCandidates.length === 1) {
    return uniqueVisibleCandidates[0];
  }

  if (uniqueVisibleCandidates.length > 1) {
    return pickSolutionFile(uniqueVisibleCandidates, target, 'Select a solution file to run sample tests');
  }

  if (target) {
    const existingCandidates = findExistingSolutionFiles(target.contestId, target.index);
    if (existingCandidates.length === 0) {
      return undefined;
    }

    if (existingCandidates.length === 1) {
      return existingCandidates[0];
    }

    return pickSolutionFile(existingCandidates, target, 'Multiple language solutions found. Select which one to test');
  }

  return undefined;
}

function getSupportedEditorPath(
  editor: vscode.TextEditor | undefined,
  target?: { contestId: number; index: string }
): string | undefined {
  if (!editor) {
    return undefined;
  }

  const templateService = getTemplateService();
  if (!templateService.getLanguageFromExtension(editor.document.uri.fsPath)) {
    return undefined;
  }

  if (target && !doesFileMatchProblem(editor.document.uri.fsPath, target)) {
    return undefined;
  }

  return editor.document.uri.fsPath;
}

function findExistingSolutionFiles(contestId: number, index: string): string[] {
  const baseFolder = getSolutionsBaseFolder();
  const problemsetFolder = path.join(baseFolder, 'problemset');
  if (!fs.existsSync(problemsetFolder)) {
    return [];
  }

  const prefix = `${contestId}${index}-`;
  const languageExtensions = Object.values(LANGUAGE_CONFIGS).map(config => config.extension);
  const candidates: string[] = [];

  for (const entry of fs.readdirSync(problemsetFolder, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(prefix)) {
      continue;
    }

    const folderPath = path.join(problemsetFolder, entry.name);
    for (const extension of languageExtensions) {
      const solutionPath = path.join(folderPath, `cf_${contestId}${index}${extension}`);
      if (fs.existsSync(solutionPath)) {
        candidates.push(solutionPath);
      }
    }
  }

  return candidates.sort((left, right) => left.localeCompare(right));
}

function doesFileMatchProblem(
  filePath: string,
  target: { contestId: number; index: string }
): boolean {
  const testService = getTestService();
  const metadata = testService.getProblemMetadata(filePath);

  return metadata?.contestId === target.contestId && metadata.index === target.index;
}

async function pickSolutionFile(
  candidates: string[],
  target: { contestId: number; index: string } | undefined,
  placeHolder: string
): Promise<string | undefined> {
  const templateService = getTemplateService();
  const defaultLanguage = vscode.workspace.getConfiguration('codeforces').get<SupportedLanguage>('defaultLanguage', 'cpp');

  const items = candidates.map(candidate => {
    const language = templateService.getLanguageFromExtension(candidate);
    const isDefault = language === defaultLanguage;

    return {
      label: language ? LANGUAGE_CONFIGS[language].displayName : path.basename(candidate),
      description: isDefault ? 'default language' : undefined,
      detail: target
        ? `${target.contestId}${target.index} • ${path.basename(candidate)}`
        : candidate,
      candidate,
      isDefault
    };
  }).sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    return left.label.localeCompare(right.label);
  });

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder,
    matchOnDescription: true,
    matchOnDetail: true
  });

  return selected?.candidate;
}

function getSolutionsBaseFolder(): string {
  const configured = vscode.workspace.getConfiguration('codeforces').get<string>('workspaceFolder', '').trim();
  if (!configured) {
    return path.join(os.homedir(), '.codeforces');
  }

  return configured.replace(/^~(?=$|\/)/, os.homedir());
}

function getRunTestsMissingFileMessage(target?: string | { contestId: number; index: string } | vscode.Uri): string {
  if (target && typeof target !== 'string' && !(target instanceof vscode.Uri) && target.contestId) {
    return `No generated solution file was found for ${target.contestId}${target.index}. Use Open in Editor first.`;
  }

  return 'No supported solution file is open. Open a generated Codeforces solution and try again.';
}

function parseSampleTests(text: string): TestCase[] {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '');

  const lines = normalized.split('\n');
  const testCases: TestCase[] = [];
  let currentInput: string[] = [];
  let currentOutput: string[] = [];
  let mode: 'input' | 'output' | undefined;

  const pushCurrentCase = () => {
    const input = trimSampleBlock(currentInput);
    const output = trimSampleBlock(currentOutput);

    if (input.length === 0 || output.length === 0) {
      currentInput = [];
      currentOutput = [];
      mode = undefined;
      return;
    }

    testCases.push({
      input: `${input.join('\n')}\n`,
      output: `${output.join('\n')}\n`
    });
    currentInput = [];
    currentOutput = [];
    mode = undefined;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (isInputHeading(trimmed)) {
      if (currentInput.length > 0 || currentOutput.length > 0) {
        pushCurrentCase();
      }
      mode = 'input';
      continue;
    }

    if (isOutputHeading(trimmed)) {
      mode = 'output';
      continue;
    }

    if (isIgnorableExampleHeading(trimmed)) {
      continue;
    }

    if (mode === 'input') {
      currentInput.push(line);
    } else if (mode === 'output') {
      currentOutput.push(line);
    }
  }

  if (currentInput.length > 0 || currentOutput.length > 0) {
    pushCurrentCase();
  }

  return testCases;
}

function trimSampleBlock(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim() === '') {
    start++;
  }

  while (end > start && lines[end - 1].trim() === '') {
    end--;
  }

  return lines.slice(start, end);
}

function isInputHeading(text: string): boolean {
  return /^(input|sample input)(\s+\d+)?(\s+copy)?$/i.test(text);
}

function isOutputHeading(text: string): boolean {
  return /^(output|sample output)(\s+\d+)?(\s+copy)?$/i.test(text);
}

function isIgnorableExampleHeading(text: string): boolean {
  return /^(examples?|sample tests?)$/i.test(text);
}

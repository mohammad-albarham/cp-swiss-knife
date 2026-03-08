import * as path from 'path';
import * as vscode from 'vscode';
import { ProblemWorkspaceMetadata } from '../api/types';
import { getAuthService } from '../services/authService';
import { TestResult, getTestService } from '../services/testService';
import { getStorageService } from '../services/storageService';
import { getProblemsExplorer } from './problemsExplorer';

interface TestResultsPanelState {
  filePath: string;
  results: TestResult[];
  problem?: ProblemWorkspaceMetadata;
  errorMessage?: string;
}

export class TestResultsPanel {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static currentState: TestResultsPanelState | undefined;

  static show(context: vscode.ExtensionContext, state: TestResultsPanelState): void {
    this.currentState = state;

    const title = this.getTitle(state);
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.Beside;

    if (!this.currentPanel) {
      this.currentPanel = vscode.window.createWebviewPanel(
        'codeforcesLocalTests',
        title,
        column,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [context.extensionUri]
        }
      );

      this.currentPanel.onDidDispose(() => {
        this.currentPanel = undefined;
        this.currentState = undefined;
      }, null, context.subscriptions);

      this.currentPanel.webview.onDidReceiveMessage(async message => {
        const activeState = this.currentState;
        if (!activeState) {
          return;
        }

        switch (message.command) {
          case 'rerunTests':
            await vscode.commands.executeCommand('codeforces.runTests', activeState.filePath);
            break;
          case 'openOutput':
            getTestService().showOutput();
            break;
          case 'confirmLocalSuccess':
            await this.confirmLocalSuccess(activeState);
            break;
          case 'submitSolution':
            await this.submitSolution(activeState);
            break;
          case 'copyText':
            if (typeof message.text === 'string') {
              await vscode.env.clipboard.writeText(message.text);
              void vscode.window.showInformationMessage('Copied test content to clipboard.');
            }
            break;
        }
      }, undefined, context.subscriptions);
    } else {
      this.currentPanel.reveal(column);
    }

    this.currentPanel.title = title;
    this.currentPanel.webview.html = this.getHtml(state);
  }

  private static async confirmLocalSuccess(state: TestResultsPanelState): Promise<void> {
    if (!state.problem) {
      void vscode.window.showWarningMessage('Problem metadata is missing, so this run cannot be confirmed.');
      return;
    }

    const allPassed = state.results.length > 0 && state.results.every(result => result.passed);
    if (!allPassed) {
      void vscode.window.showWarningMessage('Only fully passing sample runs can be confirmed locally.');
      return;
    }

    const storage = getStorageService();
    if (storage.isSolved(state.problem.contestId, state.problem.index)) {
      void vscode.window.showInformationMessage(`Problem ${state.problem.contestId}${state.problem.index} is already marked as solved.`);
      return;
    }

    await storage.addLocallySolvedProblem(state.problem.contestId, state.problem.index);
    getProblemsExplorer().refreshView();

    void vscode.window.showInformationMessage(
      `Marked ${state.problem.contestId}${state.problem.index} as locally confirmed.`
    );

    if (this.currentPanel && this.currentState) {
      this.currentPanel.webview.html = this.getHtml(this.currentState);
    }
  }

  private static async submitSolution(state: TestResultsPanelState): Promise<void> {
    if (!state.problem) {
      void vscode.window.showWarningMessage('Problem metadata is missing, so this file cannot be submitted from the test panel.');
      return;
    }

    const allPassed = state.results.length > 0 && state.results.every(result => result.passed);
    if (!allPassed || state.errorMessage) {
      void vscode.window.showWarningMessage('Submit is only available after all local samples pass.');
      return;
    }

    if (!getAuthService().isLoggedIn()) {
      const action = await vscode.window.showWarningMessage(
        'Login is required before submitting to Codeforces.',
        'Login'
      );

      if (action === 'Login') {
        await vscode.commands.executeCommand('codeforces.login');
      }
      return;
    }

    const action = await vscode.window.showWarningMessage(
      `Submit ${state.problem.contestId}${state.problem.index} to Codeforces using ${path.basename(state.filePath)}?`,
      { modal: true },
      'Submit'
    );

    if (action !== 'Submit') {
      return;
    }

    await vscode.commands.executeCommand('codeforces.submit', state.filePath);
  }

  private static getTitle(state: TestResultsPanelState): string {
    if (state.problem) {
      const nameSuffix = state.problem.name ? ` - ${state.problem.name}` : '';
      return `Tests: ${state.problem.contestId}${state.problem.index}${nameSuffix}`;
    }

    return `Tests: ${path.basename(state.filePath)}`;
  }

  private static getHtml(state: TestResultsPanelState): string {
    const total = state.results.length;
    const passed = state.results.filter(result => result.passed).length;
    const hasFailure = total > 0 && passed !== total;
    const hasError = !!state.errorMessage;
    const storage = state.problem
      ? getStorageService().isSolved(state.problem.contestId, state.problem.index)
      : false;

    const summaryTone = hasError ? 'error' : hasFailure ? 'warning' : 'success';
    const summaryTitle = hasError
      ? 'Run failed before completion'
      : total === 0
        ? 'No test results yet'
        : hasFailure
          ? `${passed}/${total} samples passed`
          : `All ${total} samples passed`;
    const summaryDetails = hasError
      ? this.escapeHtml(state.errorMessage || 'Unknown error')
      : state.problem?.testCases
        ? `Loaded ${state.problem.testCases} sample test${state.problem.testCases === 1 ? '' : 's'} from the problem folder.`
        : 'Results are based on the current local sample files.';

    const actions = [`
      <button class="secondary" onclick="post('rerunTests')">Rerun</button>
      <button class="secondary" onclick="post('openOutput')">Open Raw Log</button>
    `];

    if (!hasError && total > 0 && passed === total && state.problem) {
      if (storage) {
        actions.push('<button class="confirmed" disabled>Already Confirmed</button>');
      } else {
        actions.push('<button class="primary" onclick="post(\'confirmLocalSuccess\')">Confirm Local Success</button>');
      }

      actions.push(`<button class="primary" onclick="post('submitSolution')">${getAuthService().isLoggedIn() ? 'Submit to Codeforces' : 'Login to Submit'}</button>`);
    }

    const problemHeading = state.problem
      ? `<div class="problem-id">${state.problem.contestId}${state.problem.index}</div><h1>${this.escapeHtml(state.problem.name || path.basename(state.filePath))}</h1>`
      : `<h1>${this.escapeHtml(path.basename(state.filePath))}</h1>`;

    const resultCards = state.results.length > 0
      ? state.results.map(result => this.renderResultCard(result)).join('')
      : `
        <section class="empty-state">
          <h2>No sample run was produced</h2>
          <p>Open a generated Codeforces solution file with sample inputs and run the tests again.</p>
        </section>
      `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(this.getTitle(state))}</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --panel: color-mix(in srgb, var(--vscode-sideBar-background) 86%, transparent);
      --panel-strong: color-mix(in srgb, var(--vscode-editorWidget-background) 92%, transparent);
      --border: var(--vscode-panel-border);
      --text: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --accent: var(--vscode-textLink-foreground);
      --ok: #2f8f4e;
      --warn: #d48a1d;
      --bad: #c74a4a;
      --mono: "SFMono-Regular", "Cascadia Mono", "Consolas", monospace;
      --serif: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: var(--text);
      background:
        radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 14%, transparent), transparent 35%),
        linear-gradient(180deg, color-mix(in srgb, var(--bg) 82%, black 6%), var(--bg));
      font: 14px/1.5 var(--vscode-font-family);
    }

    .shell {
      max-width: 1120px;
      margin: 0 auto;
      padding: 24px;
    }

    .hero {
      display: grid;
      gap: 16px;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      margin-bottom: 20px;
      padding: 22px;
      border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
      border-radius: 18px;
      background: linear-gradient(160deg, color-mix(in srgb, var(--panel-strong) 95%, transparent), color-mix(in srgb, var(--panel) 88%, transparent));
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.16);
    }

    .hero h1 {
      margin: 4px 0 0;
      font: 600 30px/1.1 var(--serif);
      letter-spacing: 0.01em;
    }

    .problem-id {
      display: inline-flex;
      width: fit-content;
      margin-bottom: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent) 16%, transparent);
      color: var(--accent);
      font: 700 12px/1 var(--mono);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .hero p {
      margin: 8px 0 0;
      color: var(--muted);
      max-width: 62ch;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
    }

    button {
      border: 1px solid transparent;
      border-radius: 999px;
      padding: 10px 14px;
      font: 600 13px/1 var(--vscode-font-family);
      cursor: pointer;
      transition: transform 120ms ease, opacity 120ms ease, border-color 120ms ease;
    }

    button:hover:not(:disabled) {
      transform: translateY(-1px);
    }

    button:disabled {
      cursor: default;
      opacity: 0.65;
    }

    button.primary {
      background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 92%, white 10%), color-mix(in srgb, var(--accent) 76%, black 8%));
      color: white;
    }

    button.secondary {
      background: transparent;
      color: var(--text);
      border-color: color-mix(in srgb, var(--border) 80%, transparent);
    }

    button.confirmed {
      background: color-mix(in srgb, var(--ok) 16%, transparent);
      color: var(--ok);
      border-color: color-mix(in srgb, var(--ok) 40%, transparent);
    }

    .summary {
      margin-bottom: 18px;
      padding: 18px 20px;
      border-radius: 16px;
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      background: color-mix(in srgb, var(--panel) 92%, transparent);
    }

    .summary.success {
      border-color: color-mix(in srgb, var(--ok) 45%, transparent);
    }

    .summary.warning {
      border-color: color-mix(in srgb, var(--warn) 45%, transparent);
    }

    .summary.error {
      border-color: color-mix(in srgb, var(--bad) 45%, transparent);
    }

    .summary h2 {
      margin: 0 0 6px;
      font-size: 18px;
    }

    .summary p {
      margin: 0;
      color: var(--muted);
    }

    .grid {
      display: grid;
      gap: 14px;
    }

    .result-card {
      border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
      border-radius: 16px;
      overflow: hidden;
      background: color-mix(in srgb, var(--panel) 94%, transparent);
    }

    .result-head {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
    }

    .result-head h3 {
      margin: 0;
      font-size: 15px;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      color: var(--muted);
      font: 12px/1.4 var(--mono);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      font: 700 12px/1 var(--mono);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .badge.pass {
      background: color-mix(in srgb, var(--ok) 16%, transparent);
      color: var(--ok);
    }

    .badge.fail {
      background: color-mix(in srgb, var(--bad) 16%, transparent);
      color: var(--bad);
    }

    .result-body {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      padding: 16px;
    }

    .pane {
      min-width: 0;
    }

    .pane-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .copy-link {
      background: none;
      border: 0;
      padding: 0;
      color: var(--accent);
      font: 600 12px/1 var(--vscode-font-family);
    }

    pre {
      margin: 0;
      min-height: 108px;
      max-height: 320px;
      overflow: auto;
      padding: 12px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--bg) 84%, black 6%);
      border: 1px solid color-mix(in srgb, var(--border) 62%, transparent);
      font: 12px/1.5 var(--mono);
      white-space: pre-wrap;
      word-break: break-word;
    }

    .error-note {
      grid-column: 1 / -1;
      padding: 12px 14px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--bad) 12%, transparent);
      color: var(--text);
      font: 13px/1.5 var(--vscode-font-family);
    }

    .empty-state {
      padding: 28px;
      border: 1px dashed color-mix(in srgb, var(--border) 78%, transparent);
      border-radius: 16px;
      text-align: center;
      background: color-mix(in srgb, var(--panel) 90%, transparent);
    }

    .empty-state h2 {
      margin: 0 0 8px;
      font: 600 20px/1.2 var(--serif);
    }

    .empty-state p {
      margin: 0;
      color: var(--muted);
    }

    @media (max-width: 900px) {
      .hero {
        grid-template-columns: 1fr;
      }

      .actions {
        justify-content: flex-start;
      }

      .result-body {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div>
        ${problemHeading}
        <p>Run local samples, inspect mismatches, and explicitly confirm the problem once the sample suite passes on your machine.</p>
      </div>
      <div class="actions">
        ${actions.join('')}
      </div>
    </section>

    <section class="summary ${summaryTone}">
      <h2>${this.escapeHtml(summaryTitle)}</h2>
      <p>${summaryDetails}</p>
    </section>

    <div class="grid">
      ${resultCards}
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function post(command, text) {
      vscode.postMessage({ command, text });
    }
  </script>
</body>
</html>`;
  }

  private static renderResultCard(result: TestResult): string {
    const statusClass = result.passed ? 'pass' : 'fail';
    const statusLabel = result.passed ? 'PASS' : 'FAIL';
    const executionTime = typeof result.executionTime === 'number'
      ? `${result.executionTime} ms`
      : 'n/a';

    return `
      <section class="result-card">
        <div class="result-head">
          <div>
            <h3>Sample ${result.testNumber}</h3>
            <div class="meta">
              <span>Time: ${this.escapeHtml(executionTime)}</span>
              <span>Expected lines: ${this.escapeHtml(String(this.countLines(result.expectedOutput)))}</span>
              <span>Output lines: ${this.escapeHtml(String(this.countLines(result.actualOutput)))}</span>
            </div>
          </div>
          <span class="badge ${statusClass}">${statusLabel}</span>
        </div>
        <div class="result-body">
          ${this.renderPane('Input', result.input)}
          ${this.renderPane('Expected', result.expectedOutput)}
          ${this.renderPane('Actual', result.actualOutput)}
          ${result.error ? `<div class="error-note"><strong>Runtime note:</strong> ${this.escapeHtml(result.error)}</div>` : ''}
        </div>
      </section>
    `;
  }

  private static renderPane(label: string, text: string): string {
    const escapedText = this.escapeHtml(text || '');
    const payload = JSON.stringify(text || '');

    return `
      <div class="pane">
        <div class="pane-header">
          <span>${this.escapeHtml(label)}</span>
          <button class="copy-link" onclick='post("copyText", ${payload})'>Copy</button>
        </div>
        <pre>${escapedText || '&nbsp;'}</pre>
      </div>
    `;
  }

  private static countLines(text: string): number {
    if (!text) {
      return 0;
    }

    return text.replace(/\n$/, '').split(/\r?\n/).length;
  }

  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
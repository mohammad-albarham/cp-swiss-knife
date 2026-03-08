import * as vscode from 'vscode';
import { ProblemDetails, SupportedLanguage, LANGUAGE_CONFIGS } from '../api/types';
import { WEB_BASE_URL, WEB_ENDPOINTS } from '../api/endpoints';
import { getSubmissionService } from '../services/submissionService';
import { getTemplateService } from '../services/templateService';

export class ProblemPreview {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static currentProblem: ProblemDetails | undefined;

  static async show(
    context: vscode.ExtensionContext,
    contestId: number,
    index: string,
    problemName: string
  ): Promise<void> {
    const submissionService = getSubmissionService();

    // Show loading message
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Loading problem ${contestId}${index}...`,
      cancellable: false
    }, async () => {
      try {
        const problem = await submissionService.fetchProblemDetails(contestId, index);
        this.currentProblem = problem;
        this.createOrShowPanel(context, problem);
      } catch (error) {
        if (this.isCodeforcesHtmlBlocked(error)) {
          const fallbackProblem = this.createFallbackProblem(contestId, index, problemName);
          this.currentProblem = fallbackProblem;
          this.createOrShowPanel(context, fallbackProblem);
          vscode.window.showWarningMessage(
            'Codeforces blocked in-extension problem scraping. Open in Browser remains available.'
          );
          return;
        }

        vscode.window.showErrorMessage(
          `Failed to load problem: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  private static isCodeforcesHtmlBlocked(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return error.message.includes('status code 403');
  }

  private static createFallbackProblem(
    contestId: number,
    index: string,
    problemName: string
  ): ProblemDetails {
    const name = problemName.trim() || `Problem ${contestId}${index}`;

    return {
      contestId,
      index,
      name,
      timeLimit: 'See Codeforces page',
      memoryLimit: 'See Codeforces page',
      inputType: 'standard input',
      outputType: 'standard output',
      statement: `
        <p>Codeforces is currently blocking automated HTML fetching for this problem preview with a Cloudflare challenge.</p>
        <p>You can still use <strong>Open in Browser</strong> to read the full statement, and <strong>Open in Editor</strong> to generate a solution file immediately.</p>
      `.trim(),
      inputSpecification: '<p>Open the problem in your browser to view the full input specification.</p>',
      outputSpecification: '<p>Open the problem in your browser to view the full output specification.</p>',
      sampleTests: [],
      notes: 'This fallback preview is shown because Codeforces rejected the extension request with HTTP 403.',
      tags: ['browser fallback']
    };
  }

  private static createOrShowPanel(
    context: vscode.ExtensionContext,
    problem: ProblemDetails
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (this.currentPanel) {
      this.currentPanel.reveal(column);
      this.updateContent(problem);
      return;
    }

    this.currentPanel = vscode.window.createWebviewPanel(
      'codeforcesProblem',
      `${problem.contestId}${problem.index} - ${problem.name}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'webview')]
      }
    );

    this.updateContent(problem);

    // Handle messages from webview
    this.currentPanel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'openInEditor':
            await this.openInEditor(problem);
            break;
          case 'openInVsCode':
            await vscode.commands.executeCommand(
              'codeforces.openProblemInVsCode',
              problem.contestId,
              problem.index
            );
            break;
          case 'openInBrowser':
            vscode.env.openExternal(
              vscode.Uri.parse(`${WEB_BASE_URL}${WEB_ENDPOINTS.problem(problem.contestId, problem.index)}`)
            );
            break;
          case 'runTests':
            await vscode.commands.executeCommand('codeforces.runTests', {
              contestId: problem.contestId,
              index: problem.index
            });
            break;
          case 'submit':
            vscode.commands.executeCommand('codeforces.submit');
            break;
          case 'copyInput':
            vscode.env.clipboard.writeText(message.text);
            vscode.window.showInformationMessage('Copied to clipboard!');
            break;
        }
      },
      undefined,
      context.subscriptions
    );

    this.currentPanel.onDidDispose(
      () => {
        this.currentPanel = undefined;
      },
      null,
      context.subscriptions
    );
  }

  private static updateContent(problem: ProblemDetails): void {
    if (!this.currentPanel) { return; }

    this.currentPanel.title = `${problem.contestId}${problem.index} - ${problem.name}`;
    this.currentPanel.webview.html = this.getHtmlContent(problem);
  }

  private static async openInEditor(problem: ProblemDetails): Promise<void> {
    const config = vscode.workspace.getConfiguration('codeforces');
    const defaultLang = config.get<SupportedLanguage>('defaultLanguage', 'cpp');

    const languages = Object.entries(LANGUAGE_CONFIGS).map(([key, config]) => ({
      label: config.displayName,
      value: key as SupportedLanguage
    }));

    const selectedLang = await vscode.window.showQuickPick(
      languages.map(l => ({ label: l.label, description: l.value === defaultLang ? '(default)' : '', value: l.value })),
      { placeHolder: 'Select programming language' }
    );

    if (!selectedLang) { return; }

    const templateService = getTemplateService();
    const filePath = await templateService.createSolutionFile(problem, selectedLang.value);

    const document = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  }

  static getHtmlContent(problem: ProblemDetails): string {
    const sampleTestsHtml = problem.sampleTests.length > 0
      ? problem.sampleTests.map((test, i) => `
      <div class="test-case">
        <div class="test-header">
          <span>Sample ${i + 1}</span>
        </div>
        <div class="test-content">
          <div class="test-input">
            <div class="test-label">
              Input
              <button class="copy-btn" onclick="copyToClipboard('input-${i}')">[Copy]</button>
            </div>
            <pre id="input-${i}">${this.escapeHtml(test.input)}</pre>
          </div>
          <div class="test-output">
            <div class="test-label">
              Output
              <button class="copy-btn" onclick="copyToClipboard('output-${i}')">[Copy]</button>
            </div>
            <pre id="output-${i}">${this.escapeHtml(test.output)}</pre>
          </div>
        </div>
      </div>
    `).join('')
      : '<p>No sample tests are available in the fallback preview.</p>';

    const tagsHtml = problem.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${problem.contestId}${problem.index} - ${problem.name}</title>
  <style>
    :root {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-sideBar-background);
      --text-primary: var(--vscode-editor-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --border-color: var(--vscode-panel-border);
      --accent-color: var(--vscode-textLink-foreground);
      --success-color: #4caf50;
      --warning-color: #ff9800;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--text-primary);
      background-color: var(--bg-primary);
      padding: 20px;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
    }

    h1 {
      color: var(--accent-color);
      font-size: 1.5em;
      margin-bottom: 10px;
    }

    .header {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 15px;
      margin-bottom: 20px;
    }

    .limits {
      color: var(--text-secondary);
      font-size: 0.9em;
      margin-bottom: 10px;
    }

    .limits span {
      margin-right: 20px;
    }

    .actions {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }

    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 4px;
      font-size: 0.9em;
    }

    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    button.primary {
      background-color: var(--accent-color);
    }

    .section {
      margin-bottom: 20px;
    }

    .section-title {
      font-weight: bold;
      color: var(--accent-color);
      margin-bottom: 10px;
      font-size: 1.1em;
    }

    /* Aggressively hide any nested or duplicate section titles */
    .section-title .section-title,
    .statement .section-title,
    .note .section-title,
    .section-title + .section-title {
      display: none !important;
    }

    /* Hide standard headers that might be parsed from raw HTML */
    .statement h1, .statement h2, .statement h3,
    .section div h1, .section div h2, .section div h3,
    .section div .section-title {
      display: none !important;
    }

    .statement {
      text-align: justify;
    }

    .statement p {
      margin-bottom: 10px;
    }

    .test-case {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      margin-bottom: 15px;
      overflow: hidden;
    }

    .test-header {
      background-color: var(--vscode-editor-selectionBackground);
      padding: 8px 12px;
      font-weight: bold;
    }

    .test-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 10px;
    }

    @media (max-width: 600px) {
      .test-content {
        grid-template-columns: 1fr;
      }
    }

    .test-label {
      font-size: 0.85em;
      color: var(--text-secondary);
      margin-bottom: 5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .copy-btn {
      background: none;
      border: none;
      color: var(--accent-color);
      cursor: pointer;
      font-size: 0.8em;
      padding: 2px 6px;
    }

    .copy-btn:hover {
      text-decoration: underline;
    }

    pre {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 0;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
      white-space: pre-wrap;
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .tag {
      display: inline-block;
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.8em;
    }

    .rating {
      display: inline-block;
      background-color: var(--warning-color);
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.8em;
    }

    .note {
      background-color: var(--bg-secondary);
      padding: 15px;
      border-left: 3px solid var(--accent-color);
      margin-top: 15px;
    }

    .mathjax {
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${problem.contestId}${problem.index}. ${problem.name}</h1>
    <div class="tags" style="margin-top: 5px; margin-bottom: 10px;">
      ${tagsHtml}
    </div>
    <div class="limits">
      <span>⏱️ ${problem.timeLimit}</span>
      <span>💾 ${problem.memoryLimit}</span>
      ${problem.rating ? `<span class="rating">★ ${problem.rating}</span>` : ''}
    </div>
    <div class="actions">
      <button class="primary" onclick="openInEditor()">Open in Editor</button>
      <button onclick="runTests()">Run Local Tests</button>
      <button onclick="openInVsCode()">Open Full Problem in VS Code</button>
      <button onclick="openInBrowser()">Open in Browser</button>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Problem Statement</div>
    <div class="statement">${problem.statement}</div>
  </div>

  <div class="section">
    <div class="section-title">Input</div>
    <div>${problem.inputSpecification}</div>
  </div>

  <div class="section">
    <div class="section-title">Output</div>
    <div>${problem.outputSpecification}</div>
  </div>

  <div class="section">
    <div class="section-title">Examples</div>
    ${sampleTestsHtml}
  </div>

  ${problem.notes ? `
  <div class="section">
    <div class="section-title">Note</div>
    <div class="note">${problem.notes}</div>
  </div>
  ` : ''}


  <script>
    const vscode = acquireVsCodeApi();

    function openInEditor() {
      vscode.postMessage({ command: 'openInEditor' });
    }

    function openInVsCode() {
      vscode.postMessage({ command: 'openInVsCode' });
    }

    function runTests() {
      vscode.postMessage({ command: 'runTests' });
    }

    function openInBrowser() {
      vscode.postMessage({ command: 'openInBrowser' });
    }

    function copyToClipboard(elementId) {
      const text = document.getElementById(elementId).textContent;
      vscode.postMessage({ command: 'copyInput', text: text });
    }
  </script>
</body>
</html>`;
  }

  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

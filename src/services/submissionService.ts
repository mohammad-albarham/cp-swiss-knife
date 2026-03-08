import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import type { BrowserContext, Page } from 'playwright-core';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WEB_BASE_URL, WEB_ENDPOINTS } from '../api/endpoints';
import { ProblemDetails, TestCase, Submission, SupportedLanguage, LANGUAGE_CONFIGS } from '../api/types';
import { getAuthService } from './authService';
import { getStorageService } from './storageService';
import { codeforcesApi } from '../api';
import { logger } from '../utils/logger';

export class SubmissionService {
  private client: AxiosInstance;
  private outputChannel: vscode.OutputChannel;
  private cookies: string = '';
  private csrf: string = '';

  constructor() {
    this.client = axios.create({
      baseURL: WEB_BASE_URL,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      withCredentials: true
    });

    this.outputChannel = vscode.window.createOutputChannel('Codeforces Submissions');
  }

  async fetchProblemDetails(contestId: number, index: string): Promise<ProblemDetails> {
    const url = `${WEB_BASE_URL}${WEB_ENDPOINTS.problem(contestId, index)}`;

    try {
      const response = await this.client.get(url);
      return this.parseProblemDetails(response.data, contestId, index);
    } catch (error) {
      logger.warn('Direct problem fetch failed, attempting browser-assisted extraction', error);

      if (this.shouldTryBrowserExtraction(error)) {
        return this.fetchProblemDetailsFromBrowser(contestId, index);
      }

      throw new Error(`Failed to fetch problem: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private shouldTryBrowserExtraction(error: unknown): boolean {
    if (!vscode.workspace.getConfiguration('codeforces').get<boolean>('enableBrowserExtraction', true)) {
      return false;
    }

    return error instanceof Error && /status code 403/i.test(error.message);
  }

  private parseProblemDetails(html: string, contestId: number, index: string): ProblemDetails {
    const $ = cheerio.load(html);

    const problemStatement = $('.problem-statement');
    if (problemStatement.length === 0) {
      throw new Error('Problem statement not found in page content');
    }

    const header = problemStatement.find('.header');
    const name = header.find('.title').text().replace(/^[A-Z]\d*\.\s*/, '').trim() || `${contestId}${index}`;

    const timeLimit = header.find('.time-limit').text().replace('time limit per test', '').trim() || 'See Codeforces page';
    const memoryLimit = header.find('.memory-limit').text().replace('memory limit per test', '').trim() || 'See Codeforces page';
    const inputType = header.find('.input-file').text().replace('input', '').trim() || 'standard input';
    const outputType = header.find('.output-file').text().replace('output', '').trim() || 'standard output';

    let statement = '';
    problemStatement.children('div').each((_, elem) => {
      const $elem = $(elem);
      if (!$elem.hasClass('header') &&
          !$elem.hasClass('input-specification') &&
          !$elem.hasClass('output-specification') &&
          !$elem.hasClass('sample-tests') &&
          !$elem.hasClass('note')) {
        statement += $elem.html() || '';
      }
    });

    const inputSpecification = problemStatement.find('.input-specification').html() || '';
    const outputSpecification = problemStatement.find('.output-specification').html() || '';

    const sampleTests: TestCase[] = [];
    const inputs = problemStatement.find('.sample-test .input pre');
    const outputs = problemStatement.find('.sample-test .output pre');

    inputs.each((sampleIndex, elem) => {
      const input = this.cleanSampleText($(elem).html() || '');
      const output = this.cleanSampleText($(outputs.eq(sampleIndex)).html() || '');
      sampleTests.push({ input, output });
    });

    const notes = problemStatement.find('.note').html() || undefined;

    const tags: string[] = [];
    $('.tag-box').each((_, elem) => {
      const tag = $(elem).text().trim();
      if (tag) {
        tags.push(tag);
      }
    });

    let rating: number | undefined;
    const ratingSpan = $('.tag-box[title="Difficulty"]');
    if (ratingSpan.length) {
      const ratingText = ratingSpan.text().replace('*', '').trim();
      const parsedRating = parseInt(ratingText, 10);
      rating = Number.isNaN(parsedRating) ? undefined : parsedRating;
    }

    return {
      contestId,
      index,
      name,
      timeLimit,
      memoryLimit,
      inputType,
      outputType,
      statement,
      inputSpecification,
      outputSpecification,
      sampleTests,
      notes,
      tags,
      rating
    };
  }

  private async fetchProblemDetailsFromBrowser(contestId: number, index: string): Promise<ProblemDetails> {
    const executablePath = this.resolveChromeExecutablePath();
    if (!executablePath) {
      throw new Error('Problem fetch received HTTP 403 and no local Chrome executable was found for browser extraction');
    }

    const problemUrl = `${WEB_BASE_URL}${WEB_ENDPOINTS.problem(contestId, index)}`;
    const { chromium } = await import('playwright-core');
    const browser = await chromium.launch({
      headless: false,
      executablePath
    });

    try {
      const page = await browser.newPage();
      await page.goto(problemUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      let hasStatement = await this.waitForProblemStatement(page, 4000);
      while (!hasStatement) {
        const choice = await vscode.window.showInformationMessage(
          'Complete any Codeforces verification in the opened Chrome window, then click Continue to import the statement.',
          'Continue',
          'Cancel'
        );

        if (choice !== 'Continue') {
          throw new Error('Browser-assisted extraction canceled');
        }

        hasStatement = await this.waitForProblemStatement(page, 10000);
      }

      const html = await page.content();
      return this.parseProblemDetails(html, contestId, index);
    } catch (error) {
      throw new Error(`Failed to fetch problem through browser session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await browser.close();
    }
  }

  private async waitForProblemStatement(page: Page, timeoutMs = 5000): Promise<boolean> {
    try {
      await page.waitForSelector('.problem-statement', { timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  private resolveChromeExecutablePath(): string | undefined {
    const configuredPath = vscode.workspace.getConfiguration('codeforces').get<string>('chromeExecutablePath', '').trim();
    if (configuredPath && fs.existsSync(configuredPath)) {
      return configuredPath;
    }

    const candidates = process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium'
        ]
      : process.platform === 'win32'
        ? [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files\\Chromium\\Application\\chrome.exe'
          ]
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser'
          ];

    return candidates.find(candidate => fs.existsSync(candidate));
  }

  private cleanSampleText(html: string): string {
    // Replace <br> tags with newlines
    let text = html.replace(/<br\s*\/?>/gi, '\n');
    // Remove all other HTML tags
    text = text.replace(/<[^>]+>/g, '');
    // Decode HTML entities
    text = text.replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'")
               .replace(/&nbsp;/g, ' ');
    return text.trim();
  }

  async submit(
    filePath: string,
    contestId: number,
    index: string,
    language: SupportedLanguage
  ): Promise<void> {
    const authService = getAuthService();

    if (!authService.isLoggedIn()) {
      throw new Error('Please login first to submit solutions');
    }

    const code = fs.readFileSync(filePath, 'utf-8');
    const langConfig = LANGUAGE_CONFIGS[language];

    this.outputChannel.clear();
    this.outputChannel.show(true);
    this.outputChannel.appendLine(`Submitting ${path.basename(filePath)} to problem ${contestId}${index}...`);

    try {
      const handle = authService.getCurrentUser()?.handle ?? authService.getCurrentSession()?.handle;
      if (!handle) {
        throw new Error('Missing Codeforces handle in the current session');
      }

      const previousLatestSubmissionId = await this.getLatestSubmissionId(handle);

      await this.submitCode(contestId, index, langConfig.codeforcesId, code);

      this.outputChannel.appendLine('Solution submitted successfully!');
      this.outputChannel.appendLine('Waiting for verdict...\n');

      await this.pollVerdict(contestId, index, handle, previousLatestSubmissionId);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.outputChannel.appendLine(`Submission failed: ${message}`);
      throw error;
    }
  }

  private async submitCode(
    contestId: number,
    index: string,
    languageId: string,
    code: string
  ): Promise<void> {
    this.outputChannel.appendLine(`Language: ${languageId}`);
    this.outputChannel.appendLine(`Problem: ${contestId}${index}`);
    this.outputChannel.appendLine(`Code length: ${code.length} characters`);

    const executablePath = this.resolveChromeExecutablePath();
    if (!executablePath) {
      throw new Error('No local Chrome/Chromium executable was found. Configure codeforces.chromeExecutablePath to enable direct submission.');
    }

    const { context, page } = await this.createSubmissionBrowserContext(executablePath, contestId, index);

    try {
      await this.ensureSubmissionFormReady(page, contestId, index);
      await this.fillSubmissionForm(page, contestId, index, languageId, code);
      await this.submitForm(page);
      this.outputChannel.appendLine('Codeforces submission request sent from browser session.');
    } finally {
      await context.close();
    }
  }

  private async pollVerdict(
    contestId: number,
    index: string,
    handle: string,
    previousLatestSubmissionId?: number
  ): Promise<void> {
    const maxAttempts = 60; // 2 minutes max
    let attempts = 0;
    let trackedSubmissionId = previousLatestSubmissionId;

    while (attempts < maxAttempts) {
      try {
        const submissions = await codeforcesApi.getUserStatus(handle, { count: 10 });

        if (submissions.length > 0) {
          const relevantSubmission = submissions.find(submission => {
            if (submission.problem.contestId !== contestId || submission.problem.index !== index) {
              return false;
            }

            if (typeof previousLatestSubmissionId === 'number') {
              return submission.id > previousLatestSubmissionId;
            }

            return true;
          });

          if (relevantSubmission) {
            if (!trackedSubmissionId || relevantSubmission.id !== trackedSubmissionId) {
              trackedSubmissionId = relevantSubmission.id;
              this.outputChannel.appendLine(`Submission created: #${relevantSubmission.id}`);
            }

            if (relevantSubmission.verdict) {
              this.displayVerdict(relevantSubmission);
              return;
            }

            this.outputChannel.appendLine(`Testing submission #${relevantSubmission.id}... (passed tests: ${relevantSubmission.passedTestCount})`);
          } else if (attempts === 0) {
            this.outputChannel.appendLine('Waiting for Codeforces to create the new submission entry...');
          }
        }
      } catch (error) {
        // Ignore polling errors
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    if (trackedSubmissionId && previousLatestSubmissionId !== trackedSubmissionId) {
      this.outputChannel.appendLine(`Verdict polling timed out. Check submission #${trackedSubmissionId} on Codeforces.`);
      return;
    }

    throw new Error('Timed out waiting for Codeforces to create a new submission. Make sure you are logged into the opened browser window and that the submit form completed successfully.');
  }

  private async getLatestSubmissionId(handle: string): Promise<number | undefined> {
    try {
      const submissions = await codeforcesApi.getUserStatus(handle, { count: 1 });
      return submissions[0]?.id;
    } catch {
      return undefined;
    }
  }

  private async createSubmissionBrowserContext(
    executablePath: string,
    contestId: number,
    index: string
  ): Promise<{ context: BrowserContext; page: Page }> {
    const { chromium } = await import('playwright-core');
    const storageRoot = path.join(getStorageService().getGlobalStoragePath(), 'browser-submit');
    fs.mkdirSync(storageRoot, { recursive: true });

    const context = await chromium.launchPersistentContext(storageRoot, {
      headless: false,
      executablePath,
      viewport: { width: 1440, height: 960 },
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    await context.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
    `);

    const page = context.pages()[0] ?? await context.newPage();
    const submitUrl = `${WEB_BASE_URL}/problemset/submit`;

    this.outputChannel.appendLine(`Opening ${submitUrl}...`);
    await page.goto(submitUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.bringToFront();
    await this.navigateToProblemSubmissionPage(page, contestId, index);

    return { context, page };
  }

  private async navigateToProblemSubmissionPage(page: Page, contestId: number, index: string): Promise<void> {
    const specificUrl = `${WEB_BASE_URL}/problemset/submit/${contestId}/${index}`;
    await page.goto(specificUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }

  private async ensureSubmissionFormReady(page: Page, contestId: number, index: string): Promise<void> {
    let formReady = await this.hasSubmissionForm(page);
    while (!formReady) {
      const blockedByVerification = await this.isAntiBotVerificationPage(page);
      const loginChoice = await vscode.window.showInformationMessage(
        blockedByVerification
          ? 'Codeforces is showing a human-verification page in the opened browser window. Complete it there, then click Continue.'
          : `Log into Codeforces in the opened browser window and open the submit form for ${contestId}${index}, then click Continue.`,
        'Continue',
        'Cancel'
      );

      if (loginChoice !== 'Continue') {
        throw new Error('Browser-based submission canceled');
      }

      await page.goto(`${WEB_BASE_URL}/problemset/submit/${contestId}/${index}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      if (await this.isAntiBotVerificationPage(page)) {
        this.outputChannel.appendLine('Codeforces anti-bot verification is active in the browser window. Waiting for manual completion...');
      }

      formReady = await this.hasSubmissionForm(page);
    }
  }

  private async hasSubmissionForm(page: Page): Promise<boolean> {
    const selector = 'form textarea[name="source"], form select[name="programTypeId"]';
    try {
      await page.waitForSelector(selector, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  private async isAntiBotVerificationPage(page: Page): Promise<boolean> {
    try {
      const bodyText = await page.locator('body').innerText({ timeout: 3000 });
      return /verifying you are human|security service to protect against malicious bots|just a moment/i.test(bodyText);
    } catch {
      return false;
    }
  }

  private async fillSubmissionForm(
    page: Page,
    contestId: number,
    index: string,
    languageId: string,
    code: string
  ): Promise<void> {
    await this.fillProblemCode(page, `${contestId}${index}`);

    const languageSelector = await this.locateFirstSelector(page, [
      'select[name="programTypeId"]',
      'select[name="submittedLanguage"]',
      'select[name="programTypeForInvoker"]'
    ]);

    if (!languageSelector) {
      throw new Error('Could not find the Codeforces language selector on the submit page');
    }

    await page.selectOption(languageSelector, languageId).catch(async () => {
      throw new Error(`Could not select Codeforces language ${languageId}. The available submit options may differ on the page.`);
    });

    const sourceSelector = await this.locateFirstSelector(page, [
      'textarea[name="source"]',
      'textarea[name="sourceCode"]',
      'textarea.submit-source'
    ]);

    if (!sourceSelector) {
      throw new Error('Could not find the source code editor on the Codeforces submit page');
    }

    await page.locator(sourceSelector).fill(code);
    this.outputChannel.appendLine('Submission form populated.');
  }

  private async fillProblemCode(page: Page, problemCode: string): Promise<void> {
    const problemSelector = await this.locateFirstSelector(page, [
      'input[name="submittedProblemIndex"]',
      'input[name="submittedProblemCode"]',
      'input[name="problemIndex"]'
    ]);

    if (!problemSelector) {
      return;
    }

    await page.locator(problemSelector).fill(problemCode);
  }

  private async submitForm(page: Page): Promise<void> {
    const submitSelector = await this.locateFirstSelector(page, [
      'input[type="submit"][value*="Submit"]',
      'button[type="submit"]',
      'input.submit'
    ]);

    if (!submitSelector) {
      throw new Error('Could not find the submit button on the Codeforces page');
    }

    await Promise.allSettled([
      page.waitForLoadState('domcontentloaded', { timeout: 15000 }),
      page.locator(submitSelector).click()
    ]);

    const content = await page.content();
    if (/csrf|not allowed|error occurred|invalid/i.test(content) && !(await this.hasSubmissionForm(page))) {
      this.outputChannel.appendLine('Submit page reported an issue; check the opened browser window for details.');
    }
  }

  private async locateFirstSelector(page: Page, selectors: string[]): Promise<string | undefined> {
    for (const selector of selectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        return selector;
      }
    }

    return undefined;
  }

  private displayVerdict(submission: Submission): void {
    const verdictEmoji: Record<string, string> = {
      'OK': '✅',
      'WRONG_ANSWER': '❌',
      'TIME_LIMIT_EXCEEDED': '⏱️',
      'MEMORY_LIMIT_EXCEEDED': '💾',
      'RUNTIME_ERROR': '💥',
      'COMPILATION_ERROR': '🔧',
      'TESTING': '⏳'
    };

    const emoji = submission.verdict ? (verdictEmoji[submission.verdict] || '❓') : '⏳';
    const verdict = submission.verdict || 'TESTING';

    this.outputChannel.appendLine('\n=== VERDICT ===');
    this.outputChannel.appendLine(`${emoji} ${verdict}`);

    if (submission.verdict === 'OK') {
      this.outputChannel.appendLine(`Time: ${submission.timeConsumedMillis}ms`);
      this.outputChannel.appendLine(`Memory: ${Math.round(submission.memoryConsumedBytes / 1024)}KB`);
      vscode.window.showInformationMessage('✅ Accepted!');
    } else {
      if (submission.passedTestCount > 0) {
        this.outputChannel.appendLine(`Failed on test ${submission.passedTestCount + 1}`);
      }
      this.outputChannel.appendLine(`Time: ${submission.timeConsumedMillis}ms`);
      this.outputChannel.appendLine(`Memory: ${Math.round(submission.memoryConsumedBytes / 1024)}KB`);
      vscode.window.showErrorMessage(`${emoji} ${verdict} on test ${submission.passedTestCount + 1}`);
    }
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

let submissionServiceInstance: SubmissionService | undefined;

export function initSubmissionService(): SubmissionService {
  submissionServiceInstance = new SubmissionService();
  return submissionServiceInstance;
}

export function getSubmissionService(): SubmissionService {
  if (!submissionServiceInstance) {
    throw new Error('Submission service not initialized');
  }
  return submissionServiceInstance;
}

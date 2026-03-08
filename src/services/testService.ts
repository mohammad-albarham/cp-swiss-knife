import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { ProblemWorkspaceMetadata, SupportedLanguage, LANGUAGE_CONFIGS, TestCase } from '../api/types';
import { getTemplateService } from './templateService';

export interface TestResult {
  testNumber: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  error?: string;
  executionTime?: number;
  memoryUsed?: number;
}

interface RunTestsOptions {
  revealOutput?: boolean;
  showNotifications?: boolean;
}

export class TestService {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Codeforces Tests');
  }

  async runTests(filePath: string, options: RunTestsOptions = {}): Promise<TestResult[]> {
    const { revealOutput = true, showNotifications = true } = options;
    const templateService = getTemplateService();
    const language = templateService.getLanguageFromExtension(filePath);

    if (!language) {
      throw new Error('Unsupported file type');
    }

    const problemFolder = path.dirname(filePath);
    const testCases = this.loadTestCases(problemFolder);

    if (testCases.length === 0) {
      throw new Error('No test cases found');
    }

    this.outputChannel.clear();
    if (revealOutput) {
      this.outputChannel.show(true);
    }
    this.outputChannel.appendLine(`Running ${testCases.length} test(s) for ${path.basename(filePath)}...\n`);

    // Compile if necessary
    const executablePath = await this.compile(filePath, language);

    const results: TestResult[] = [];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      this.outputChannel.appendLine(`--- Test ${i + 1} ---`);
      this.outputChannel.appendLine(`Input:\n${testCase.input}`);

      try {
        const result = await this.runSingleTest(
          executablePath,
          language,
          testCase,
          i + 1,
          problemFolder
        );
        results.push(result);

        if (result.passed) {
          this.outputChannel.appendLine(`✓ PASSED (${result.executionTime}ms)`);
        } else {
          this.outputChannel.appendLine(`✗ FAILED`);
          this.outputChannel.appendLine(`Expected:\n${result.expectedOutput}`);
          this.outputChannel.appendLine(`Got:\n${result.actualOutput}`);
          if (result.error) {
            this.outputChannel.appendLine(`Error: ${result.error}`);
          }
        }
        this.outputChannel.appendLine('');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          testNumber: i + 1,
          passed: false,
          input: testCase.input,
          expectedOutput: testCase.output,
          actualOutput: '',
          error: errorMessage
        });
        this.outputChannel.appendLine(`✗ ERROR: ${errorMessage}\n`);
      }
    }

    // Summary
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    this.outputChannel.appendLine(`\n=== Results: ${passed}/${total} tests passed ===`);

    if (showNotifications && passed === total) {
      vscode.window.showInformationMessage(`All ${total} tests passed!`);
    } else if (showNotifications) {
      vscode.window.showWarningMessage(`${passed}/${total} tests passed`);
    }

    return results;
  }

  async runCustomTest(filePath: string, input: string): Promise<string> {
    const templateService = getTemplateService();
    const language = templateService.getLanguageFromExtension(filePath);

    if (!language) {
      throw new Error('Unsupported file type');
    }

    const problemFolder = path.dirname(filePath);
    const executablePath = await this.compile(filePath, language);

    const result = await this.executeCode(executablePath, language, input, problemFolder);
    return result.stdout;
  }

  private loadTestCases(problemFolder: string): TestCase[] {
    const testCases: TestCase[] = [];
    let i = 1;
    let hasMoreTestCases = true;

    while (hasMoreTestCases) {
      const inputPath = path.join(problemFolder, `input${i}.txt`);
      const outputPath = path.join(problemFolder, `output${i}.txt`);

      hasMoreTestCases = fs.existsSync(inputPath) && fs.existsSync(outputPath);
      if (!hasMoreTestCases) {
        break;
      }

      testCases.push({
        input: fs.readFileSync(inputPath, 'utf-8'),
        output: fs.readFileSync(outputPath, 'utf-8')
      });
      i++;
    }

    return testCases;
  }

  getProblemMetadata(filePath: string): ProblemWorkspaceMetadata | undefined {
    const metadataPath = path.join(path.dirname(filePath), '.problem.json');

    if (fs.existsSync(metadataPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as Record<string, unknown>;
        const contestId = Number(raw.contestId);
        const index = typeof raw.index === 'string' ? raw.index : undefined;

        if (!Number.isNaN(contestId) && index) {
          return {
            contestId,
            index,
            name: typeof raw.name === 'string' ? raw.name : undefined,
            testCases: typeof raw.testCases === 'number' ? raw.testCases : undefined
          };
        }
      } catch {
        // Fall back to filename parsing when metadata is invalid.
      }
    }

    const match = path.basename(filePath).match(/cf_(\d+)([A-Z]\d?)/i);
    if (!match) {
      return undefined;
    }

    return {
      contestId: parseInt(match[1], 10),
      index: match[2].toUpperCase()
    };
  }

  showOutput(): void {
    this.outputChannel.show(true);
  }

  private async compile(filePath: string, language: SupportedLanguage): Promise<string> {
    const config = LANGUAGE_CONFIGS[language];
    const vsConfig = vscode.workspace.getConfiguration('codeforces');

    if (!config.compileCommand) {
      return filePath; // Interpreted language
    }

    const dir = path.dirname(filePath);
    let outputPath: string;
    let compileCmd: string;

    switch (language) {
      case 'cpp': {
        outputPath = path.join(dir, 'solution');
        const cppCompiler = vsConfig.get<string>('cppCompiler', 'g++');
        const cppFlags = vsConfig.get<string>('cppFlags', '-std=c++17 -O2 -Wall -Wextra');
        compileCmd = `${cppCompiler} ${cppFlags} -o "${outputPath}" "${filePath}"`;
        break;
      }

      case 'java':
        outputPath = filePath.replace('.java', '');
        compileCmd = `javac "${filePath}"`;
        break;

      case 'kotlin':
        outputPath = filePath.replace('.kt', '.jar');
        compileCmd = `kotlinc "${filePath}" -include-runtime -d "${outputPath}"`;
        break;

      case 'rust':
        outputPath = path.join(dir, 'solution');
        compileCmd = `rustc -O -o "${outputPath}" "${filePath}"`;
        break;

      case 'csharp':
        outputPath = path.join(dir, 'solution.exe');
        compileCmd = `mcs -out:"${outputPath}" "${filePath}"`;
        break;

      default:
        return filePath;
    }

    this.outputChannel.appendLine(`Compiling: ${compileCmd}`);

    return new Promise((resolve, reject) => {
      cp.exec(compileCmd, { cwd: dir, timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          this.outputChannel.appendLine(`Compilation Error:\n${stderr}`);
          reject(new Error(`Compilation failed: ${stderr}`));
        } else {
          this.outputChannel.appendLine('Compilation successful\n');
          resolve(outputPath);
        }
      });
    });
  }

  private async runSingleTest(
    executablePath: string,
    language: SupportedLanguage,
    testCase: TestCase,
    testNumber: number,
    workingDir: string
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const result = await this.executeCode(
        executablePath,
        language,
        testCase.input,
        workingDir
      );

      const executionTime = Date.now() - startTime;
      const actualOutput = result.stdout.trim();
      const expectedOutput = testCase.output.trim();

      return {
        testNumber,
        passed: this.compareOutputs(actualOutput, expectedOutput),
        input: testCase.input,
        expectedOutput: testCase.output,
        actualOutput: result.stdout,
        executionTime,
        error: result.stderr || undefined
      };
    } catch (error) {
      return {
        testNumber,
        passed: false,
        input: testCase.input,
        expectedOutput: testCase.output,
        actualOutput: '',
        error: error instanceof Error ? error.message : 'Execution failed'
      };
    }
  }

  private executeCode(
    executablePath: string,
    language: SupportedLanguage,
    input: string,
    workingDir: string
  ): Promise<{ stdout: string; stderr: string }> {
    const vsConfig = vscode.workspace.getConfiguration('codeforces');

    let command: string;

    switch (language) {
      case 'cpp':
      case 'rust':
        command = `"${executablePath}"`;
        break;
      case 'python': {
        const pythonCmd = vsConfig.get<string>('pythonCommand', 'python3');
        command = `${pythonCmd} "${executablePath}"`;
        break;
      }
      case 'java': {
        const javaCmd = vsConfig.get<string>('javaCommand', 'java');
        const className = path.basename(executablePath, '.java');
        command = `${javaCmd} -cp "${path.dirname(executablePath)}" ${className}`;
        break;
      }
      case 'kotlin':
        command = `kotlin "${executablePath}"`;
        break;
      case 'go':
        command = `go run "${executablePath}"`;
        break;
      case 'csharp':
        command = `mono "${executablePath}"`;
        break;
      case 'javascript':
        command = `node "${executablePath}"`;
        break;
      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    return new Promise((resolve, reject) => {
      const child = cp.exec(
        command,
        {
          cwd: workingDir,
          timeout: 10000, // 10 second timeout
          maxBuffer: 1024 * 1024 * 10 // 10MB
        },
        (error, stdout, stderr) => {
          if (error && error.killed) {
            reject(new Error('Time Limit Exceeded'));
          } else if (error && !stderr) {
            reject(new Error(`Runtime Error: ${error.message}`));
          } else {
            resolve({ stdout, stderr });
          }
        }
      );

      // Send input
      if (child.stdin) {
        child.stdin.write(input);
        child.stdin.end();
      }
    });
  }

  private compareOutputs(actual: string, expected: string): boolean {
    // Normalize line endings and trailing whitespace
    const normalizeOutput = (s: string) =>
      s.split('\n').map(line => line.trimEnd()).join('\n').trimEnd();

    return normalizeOutput(actual) === normalizeOutput(expected);
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

let testServiceInstance: TestService | undefined;

export function initTestService(): TestService {
  testServiceInstance = new TestService();
  return testServiceInstance;
}

export function getTestService(): TestService {
  if (!testServiceInstance) {
    throw new Error('Test service not initialized');
  }
  return testServiceInstance;
}

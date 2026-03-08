import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SupportedLanguage, LANGUAGE_CONFIGS, ProblemDetails, TestCase } from '../api/types';

const DEFAULT_TEMPLATES: Record<SupportedLanguage, string> = {
  cpp: `// Problem: {problemName}
// Contest: {contestId}
// URL: https://codeforces.com/contest/{contestId}/problem/{index}
// Memory Limit: {memoryLimit}
// Time Limit: {timeLimit}

#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Your solution here

    return 0;
}
`,

  python: `# Problem: {problemName}
# Contest: {contestId}
# URL: https://codeforces.com/contest/{contestId}/problem/{index}
# Memory Limit: {memoryLimit}
# Time Limit: {timeLimit}

# Your solution here
`,

  java: `// Problem: {problemName}
// Contest: {contestId}
// URL: https://codeforces.com/contest/{contestId}/problem/{index}
// Memory Limit: {memoryLimit}
// Time Limit: {timeLimit}

import java.util.*;
import java.io.*;

public class Main {
  public static void main(String[] args) throws Exception {
    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
    PrintWriter out = new PrintWriter(new BufferedOutputStream(System.out));

    // Your solution here

        out.close();
    }
}
`,

  kotlin: `// Problem: {problemName}
// Contest: {contestId}
// URL: https://codeforces.com/contest/{contestId}/problem/{index}
// Memory Limit: {memoryLimit}
// Time Limit: {timeLimit}

fun main() {
    // Your solution here
}
`,

  rust: `// Problem: {problemName}
// Contest: {contestId}
// URL: https://codeforces.com/contest/{contestId}/problem/{index}
// Memory Limit: {memoryLimit}
// Time Limit: {timeLimit}

use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();

    // Your solution here
}
`,

  go: `// Problem: {problemName}
// Contest: {contestId}
// URL: https://codeforces.com/contest/{contestId}/problem/{index}
// Memory Limit: {memoryLimit}
// Time Limit: {timeLimit}

package main

import (
    "bufio"
    "os"
)

var reader = bufio.NewReader(os.Stdin)
var writer = bufio.NewWriter(os.Stdout)

func main() {
    defer writer.Flush()

    _ = reader

    // Your solution here
}
`,

  csharp: `// Problem: {problemName}
// Contest: {contestId}
// URL: https://codeforces.com/contest/{contestId}/problem/{index}
// Memory Limit: {memoryLimit}
// Time Limit: {timeLimit}

using System;

class Program {
    static void Main() {
        // Your solution here
    }
}
`,

  javascript: `// Problem: {problemName}
// Contest: {contestId}
// URL: https://codeforces.com/contest/{contestId}/problem/{index}
// Memory Limit: {memoryLimit}
// Time Limit: {timeLimit}

'use strict';

const fs = require('fs');
const input = fs.readFileSync(0, 'utf8');

// Your solution here
`
};

const LEGACY_DEFAULT_TEMPLATES: Partial<Record<SupportedLanguage, string[]>> = {
  cpp: [`// Problem: {problemName}
// Contest: {contestId}
// URL: https://codeforces.com/contest/{contestId}/problem/{index}
// Memory Limit: {memoryLimit}
// Time Limit: {timeLimit}

#include <bits/stdc++.h>
using namespace std;

#define ll long long
#define vi vector<int>
#define vll vector<long long>
#define pii pair<int, int>
#define pll pair<long long, long long>
#define all(x) (x).begin(), (x).end()
#define sz(x) (int)(x).size()

void solve() {
  // Your solution here
}

int main() {
  ios_base::sync_with_stdio(false);
  cin.tie(NULL);

  int t = 1;
  // cin >> t;
  while (t--) {
    solve();
  }

  return 0;
}
`],
  python: [`# Problem: {problemName}
# Contest: {contestId}
# URL: https://codeforces.com/contest/{contestId}/problem/{index}
# Memory Limit: {memoryLimit}
# Time Limit: {timeLimit}

import sys
from collections import defaultdict, deque, Counter
from itertools import permutations, combinations
from functools import lru_cache
from heapq import heappush, heappop
input = sys.stdin.readline

def solve():
  # Your solution here
  pass

def main():
  t = 1
  # t = int(input())
  for _ in range(t):
    solve()

if __name__ == "__main__":
  main()
`],
  java: [`// Problem: {problemName}
// Contest: {contestId}
// URL: https://codeforces.com/contest/{contestId}/problem/{index}
// Memory Limit: {memoryLimit}
// Time Limit: {timeLimit}

import java.util.*;
import java.io.*;

public class Main {
  static BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
  static PrintWriter out = new PrintWriter(new BufferedOutputStream(System.out));
  static StringTokenizer st;

  public static void main(String[] args) throws IOException {
    int t = 1;
    // t = nextInt();
    while (t-- > 0) {
      solve();
    }
    out.close();
  }

  static void solve() throws IOException {
    // Your solution here
  }

  static String next() throws IOException {
    while (st == null || !st.hasMoreTokens())
      st = new StringTokenizer(br.readLine());
    return st.nextToken();
  }

  static int nextInt() throws IOException { return Integer.parseInt(next()); }
  static long nextLong() throws IOException { return Long.parseLong(next()); }
  static double nextDouble() throws IOException { return Double.parseDouble(next()); }
}
`],
  kotlin: [`// Problem: {problemName}
// Contest: {contestId}
// URL: https://codeforces.com/contest/{contestId}/problem/{index}
// Memory Limit: {memoryLimit}
// Time Limit: {timeLimit}

import java.util.*

fun solve() {
  // Your solution here
}

fun main() {
  val t = 1
  // val t = readLine()!!.toInt()
  repeat(t) {
    solve()
  }
}
`],
  rust: [`// Problem: {problemName}
// Contest: {contestId}
// URL: https://codeforces.com/contest/{contestId}/problem/{index}
// Memory Limit: {memoryLimit}
// Time Limit: {timeLimit}

use std::io::{self, BufRead, Write, BufWriter};

fn solve<R: BufRead, W: Write>(reader: &mut R, writer: &mut W) {
  // Your solution here
}

fn main() {
  let stdin = io::stdin();
  let stdout = io::stdout();
  let mut reader = stdin.lock();
  let mut writer = BufWriter::new(stdout.lock());

  let t = 1;
  // Read t if multiple test cases
  for _ in 0..t {
    solve(&mut reader, &mut writer);
  }
}
`],
  go: [`// Problem: {problemName}
// Contest: {contestId}
// URL: https://codeforces.com/contest/{contestId}/problem/{index}
// Memory Limit: {memoryLimit}
// Time Limit: {timeLimit}

package main

import (
  "bufio"
  "fmt"
  "os"
)

var reader *bufio.Reader = bufio.NewReader(os.Stdin)
var writer *bufio.Writer = bufio.NewWriter(os.Stdout)

func printf(f string, a ...interface{}) { fmt.Fprintf(writer, f, a...) }
func scanf(f string, a ...interface{}) { fmt.Fscanf(reader, f, a...) }

func solve() {
  // Your solution here
}

func main() {
  defer writer.Flush()

  t := 1
  // scanf("%d\\n", &t)
  for i := 0; i < t; i++ {
    solve()
  }
}
`],
  csharp: [`// Problem: {problemName}
// Contest: {contestId}
// URL: https://codeforces.com/contest/{contestId}/problem/{index}
// Memory Limit: {memoryLimit}
// Time Limit: {timeLimit}

using System;
using System.Collections.Generic;
using System.Linq;

class Program {
  static void Main() {
    int t = 1;
    // t = int.Parse(Console.ReadLine());
    while (t-- > 0) {
      Solve();
    }
  }

  static void Solve() {
    // Your solution here
  }
}
`],
  javascript: [`// Problem: {problemName}
// Contest: {contestId}
// URL: https://codeforces.com/contest/{contestId}/problem/{index}
// Memory Limit: {memoryLimit}
// Time Limit: {timeLimit}

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

const lines = [];
let lineIndex = 0;

rl.on('line', (line) => {
  lines.push(line);
});

rl.on('close', () => {
  solve();
});

function solve() {
  // Your solution here
}
`]
};

export class TemplateService {
  getDefaultTemplate(language: SupportedLanguage): string {
    return DEFAULT_TEMPLATES[language] || '';
  }

  async getTemplate(language: SupportedLanguage): Promise<string> {
    const config = vscode.workspace.getConfiguration('codeforces');
    const customTemplatePath = config.get<string>(`template.${language}`);

    if (customTemplatePath) {
      const expandedPath = customTemplatePath.replace('~', os.homedir());
      if (fs.existsSync(expandedPath)) {
        const content = fs.readFileSync(expandedPath, 'utf-8');
        return content;
      }
    }

    return this.getDefaultTemplate(language);
  }

  applyTemplate(template: string, problem: ProblemDetails): string {
    return template
      .replace(/{problemName}/g, problem.name)
      .replace(/{contestId}/g, String(problem.contestId))
      .replace(/{index}/g, problem.index)
      .replace(/{memoryLimit}/g, problem.memoryLimit)
      .replace(/{timeLimit}/g, problem.timeLimit);
  }

  async createSolutionFile(
    problem: ProblemDetails,
    language: SupportedLanguage
  ): Promise<string> {
    const config = vscode.workspace.getConfiguration('codeforces');
    let workspaceFolder = config.get<string>('workspaceFolder');

    if (!workspaceFolder) {
      workspaceFolder = path.join(os.homedir(), '.codeforces');
    } else {
      workspaceFolder = workspaceFolder.replace('~', os.homedir());
    }

    const langConfig = LANGUAGE_CONFIGS[language];
    const problemFolder = path.join(
      workspaceFolder,
      'problemset',
      `${problem.contestId}${problem.index}-${this.sanitizeFilename(problem.name)}`
    );

    // Create directory if it doesn't exist
    if (!fs.existsSync(problemFolder)) {
      fs.mkdirSync(problemFolder, { recursive: true });
    }

    const template = await this.getTemplate(language);
    const content = this.applyTemplate(template, problem);

    // Create solution file
    const solutionPath = path.join(problemFolder, `cf_${problem.contestId}${problem.index}${langConfig.extension}`);

    if (!fs.existsSync(solutionPath)) {
      fs.writeFileSync(solutionPath, content);
    } else if (this.shouldRefreshGeneratedSolution(solutionPath, language, problem)) {
      fs.writeFileSync(solutionPath, content);
    }

    // Create test case files
    await this.saveTestCases(problemFolder, problem.sampleTests);

    // Create problem metadata file
    const metadataPath = path.join(problemFolder, '.problem.json');
    fs.writeFileSync(metadataPath, JSON.stringify({
      contestId: problem.contestId,
      index: problem.index,
      name: problem.name,
      timeLimit: problem.timeLimit,
      memoryLimit: problem.memoryLimit,
      tags: problem.tags,
      rating: problem.rating,
      testCases: problem.sampleTests.length
    }, null, 2));

    return solutionPath;
  }

  async saveTestCases(folder: string, testCases: TestCase[]): Promise<void> {
    this.removeExistingTestCaseFiles(folder);

    for (let i = 0; i < testCases.length; i++) {
      const inputPath = path.join(folder, `input${i + 1}.txt`);
      const outputPath = path.join(folder, `output${i + 1}.txt`);

      fs.writeFileSync(inputPath, testCases[i].input);
      fs.writeFileSync(outputPath, testCases[i].output);
    }

    this.updateMetadataTestCount(folder, testCases.length);
  }

  private removeExistingTestCaseFiles(folder: string): void {
    let i = 1;
    let hasMoreTestCases = true;

    while (hasMoreTestCases) {
      const inputPath = path.join(folder, `input${i}.txt`);
      const outputPath = path.join(folder, `output${i}.txt`);

      hasMoreTestCases = fs.existsSync(inputPath) || fs.existsSync(outputPath);
      if (!hasMoreTestCases) {
        break;
      }

      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }

      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      i++;
    }
  }

  private updateMetadataTestCount(folder: string, count: number): void {
    const metadataPath = path.join(folder, '.problem.json');
    if (!fs.existsSync(metadataPath)) {
      return;
    }

    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as Record<string, unknown>;
      metadata.testCases = count;
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    } catch {
      // Leave invalid metadata untouched.
    }
  }

  private sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  private shouldRefreshGeneratedSolution(
    solutionPath: string,
    language: SupportedLanguage,
    problem: ProblemDetails
  ): boolean {
    const existingContent = fs.readFileSync(solutionPath, 'utf-8');
    const normalizedExisting = this.normalizeTemplateContent(existingContent);

    const currentTemplate = this.applyTemplate(this.getDefaultTemplate(language), problem);
    if (normalizedExisting === this.normalizeTemplateContent(currentTemplate)) {
      return false;
    }

    const legacyTemplates = LEGACY_DEFAULT_TEMPLATES[language] || [];
    return legacyTemplates.some(template => {
      const rendered = this.applyTemplate(template, problem);
      return normalizedExisting === this.normalizeTemplateContent(rendered);
    });
  }

  private normalizeTemplateContent(content: string): string {
    return content.replace(/\r\n/g, '\n').trim();
  }

  getLanguageFromExtension(filePath: string): SupportedLanguage | undefined {
    const ext = path.extname(filePath);
    for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
      if (config.extension === ext) {
        return lang as SupportedLanguage;
      }
    }
    return undefined;
  }
}

let templateServiceInstance: TemplateService | undefined;

export function initTemplateService(): TemplateService {
  templateServiceInstance = new TemplateService();
  return templateServiceInstance;
}

export function getTemplateService(): TemplateService {
  if (!templateServiceInstance) {
    throw new Error('Template service not initialized');
  }
  return templateServiceInstance;
}

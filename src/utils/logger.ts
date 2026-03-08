import * as vscode from 'vscode';

class Logger {
  private outputChannel: vscode.OutputChannel;
  private isDebug: boolean;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Codeforces');
    this.isDebug = process.env.NODE_ENV === 'development';
  }

  private timestamp(): string {
    return new Date().toISOString();
  }

  info(message: string, ...args: unknown[]): void {
    const formatted = `[${this.timestamp()}] [INFO] ${message}`;
    this.outputChannel.appendLine(formatted);
    if (args.length > 0) {
      this.outputChannel.appendLine(JSON.stringify(args, null, 2));
    }
  }

  warn(message: string, ...args: unknown[]): void {
    const formatted = `[${this.timestamp()}] [WARN] ${message}`;
    this.outputChannel.appendLine(formatted);
    if (args.length > 0) {
      this.outputChannel.appendLine(JSON.stringify(args, null, 2));
    }
    console.warn(message, ...args);
  }

  error(message: string, error?: Error): void {
    const formatted = `[${this.timestamp()}] [ERROR] ${message}`;
    this.outputChannel.appendLine(formatted);
    if (error) {
      this.outputChannel.appendLine(`  ${error.message}`);
      if (error.stack) {
        this.outputChannel.appendLine(`  ${error.stack}`);
      }
    }
    console.error(message, error);
  }

  debug(message: string, ...args: unknown[]): void {
    if (!this.isDebug) { return; }
    const formatted = `[${this.timestamp()}] [DEBUG] ${message}`;
    this.outputChannel.appendLine(formatted);
    if (args.length > 0) {
      this.outputChannel.appendLine(JSON.stringify(args, null, 2));
    }
  }

  show(): void {
    this.outputChannel.show();
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

export const logger = new Logger();

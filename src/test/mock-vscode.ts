// Minimal mock for the 'vscode' module used in standalone Mocha tests.
// This replaces the real VS Code API when running outside the extension host.

const vscode = {
  Uri: {
    parse: (str: string) => ({ toString: () => str, scheme: 'https', path: str }),
    file: (path: string) => ({ toString: () => path, scheme: 'file', path }),
  },
  window: {
    showInformationMessage: () => Promise.resolve(),
    showErrorMessage: () => Promise.resolve(),
    createWebviewPanel: () => ({}),
  },
  commands: {
    executeCommand: () => Promise.resolve(),
  },
  env: {
    clipboard: { writeText: () => Promise.resolve() },
    openExternal: () => Promise.resolve(true),
  },
  ViewColumn: { One: 1, Two: 2, Three: 3 },
  EventEmitter: class {
    fire() { /* noop */ }
    event() { /* noop */ }
  }
};

module.exports = vscode;

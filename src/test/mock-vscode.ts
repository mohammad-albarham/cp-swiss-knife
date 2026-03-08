// Minimal mock for the 'vscode' module used in standalone Mocha tests.
// This replaces the real VS Code API when running outside the extension host.

/** Map-backed SecretStorage mock. */
class MockSecretStorage {
  private _data = new Map<string, string>();
  async get(key: string): Promise<string | undefined> { return this._data.get(key); }
  async store(key: string, value: string): Promise<void> { this._data.set(key, value); }
  async delete(key: string): Promise<void> { this._data.delete(key); }
  onDidChange = () => ({ dispose: () => { /* noop */ } });
}

/** Map-backed Memento mock (globalState / workspaceState). */
class MockMemento {
  private data = new Map<string, unknown>();
  get<T>(key: string, defaultValue?: T): T {
    return (this.data.has(key) ? this.data.get(key) : defaultValue) as T;
  }
  async update(key: string, value: unknown): Promise<void> { this.data.set(key, value); }
  keys(): readonly string[] { return Array.from(this.data.keys()); }
}

/** Build a mock ExtensionContext. */
function createMockExtensionContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const secrets = new MockSecretStorage();
  const globalState = new MockMemento();
  const workspaceState = new MockMemento();
  return {
    subscriptions: [],
    secrets,
    globalState,
    workspaceState,
    extensionUri: { toString: () => '/mock-extension', scheme: 'file', path: '/mock-extension', fsPath: '/mock-extension' },
    globalStorageUri: { toString: () => '/tmp/mock-global-storage', scheme: 'file', path: '/tmp/mock-global-storage', fsPath: '/tmp/mock-global-storage' },
    extensionPath: '/mock-extension',
    logUri: { toString: () => '/tmp/mock-log', scheme: 'file', path: '/tmp/mock-log', fsPath: '/tmp/mock-log' },
    storageUri: null,
    extensionMode: 1,
    ...overrides,
  };
}

// Configurable configuration values per test
let _configValues: Record<string, unknown> = {};
function setMockConfigValues(values: Record<string, unknown>): void { _configValues = values; }
function clearMockConfigValues(): void { _configValues = {}; }

const vscode = {
  Uri: {
    parse: (str: string) => ({ toString: () => str, scheme: 'https', path: str }),
    file: (path: string) => ({ toString: () => path, scheme: 'file', path, fsPath: path }),
    joinPath: (...parts: unknown[]) => {
      const segments = parts.map(p => (typeof p === 'string' ? p : (p as { path: string }).path));
      return { toString: () => segments.join('/'), scheme: 'file', path: segments.join('/'), fsPath: segments.join('/') };
    },
  },
  window: {
    showInformationMessage: () => Promise.resolve(),
    showErrorMessage: () => Promise.resolve(),
    showWarningMessage: () => Promise.resolve(),
    showInputBox: () => Promise.resolve(undefined),
    showQuickPick: () => Promise.resolve(undefined),
    createWebviewPanel: () => ({
      webview: { html: '', onDidReceiveMessage: () => ({ dispose: () => {} }), cspSource: 'https://mock.csp', asWebviewUri: (u: unknown) => u },
      reveal: () => {},
      onDidDispose: () => ({ dispose: () => {} }),
      dispose: () => {},
    }),
    createOutputChannel: () => ({
      appendLine: () => {},
      append: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
    withProgress: (_opts: unknown, task: (progress: unknown) => Promise<unknown>) =>
      task({ report: () => {} }),
    activeTextEditor: undefined,
  },
  commands: {
    executeCommand: () => Promise.resolve(),
    registerCommand: () => ({ dispose: () => {} }),
  },
  env: {
    clipboard: { writeText: () => Promise.resolve() },
    openExternal: () => Promise.resolve(true),
  },
  workspace: {
    getConfiguration: (_section?: string) => ({
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        const fullKey = _section ? `${_section}.${key}` : key;
        if (fullKey in _configValues) { return _configValues[fullKey] as T; }
        if (key in _configValues) { return _configValues[key] as T; }
        return defaultValue;
      },
    }),
    openTextDocument: () => Promise.resolve({}),
  },
  ViewColumn: { One: 1, Two: 2, Three: 3, Beside: -2, Active: -1 },
  ProgressLocation: { Notification: 15, SourceControl: 1, Window: 10 },
  ThemeIcon: class {
    id: string;
    color?: unknown;
    constructor(id: string, color?: unknown) { this.id = id; this.color = color; }
  },
  ThemeColor: class {
    id: string;
    constructor(id: string) { this.id = id; }
  },
  TreeItem: class {
    label: string;
    collapsibleState: number;
    constructor(label: string, collapsibleState = 0) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  EventEmitter: class {
    fire() { /* noop */ }
    event() { /* noop */ }
  },
  // Helpers exposed for tests
  _test: {
    MockSecretStorage,
    MockMemento,
    createMockExtensionContext,
    setMockConfigValues,
    clearMockConfigValues,
  },
};

module.exports = vscode;

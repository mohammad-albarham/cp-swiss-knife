import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { escapeHtml, formatRelativeTime, formatDuration, getNonce, getThemeStyles, getCspMeta } from '../../views/webviewUtils';

function mockWebview(): vscode.Webview {
  return {
    cspSource: 'https://mock.csp.source',
    html: '',
    options: {},
    onDidReceiveMessage: () => ({ dispose: () => { /* noop */ } }),
    postMessage: async () => true,
    asWebviewUri: (uri: vscode.Uri) => uri,
  } as unknown as vscode.Webview;
}

suite('webviewUtils', () => {

  suite('escapeHtml', () => {
    test('escapes ampersand', () => {
      assert.strictEqual(escapeHtml('a&b'), 'a&amp;b');
    });

    test('escapes less-than', () => {
      assert.strictEqual(escapeHtml('a<b'), 'a&lt;b');
    });

    test('escapes greater-than', () => {
      assert.strictEqual(escapeHtml('a>b'), 'a&gt;b');
    });

    test('escapes double quote', () => {
      assert.strictEqual(escapeHtml('a"b'), 'a&quot;b');
    });

    test('escapes single quote', () => {
      assert.strictEqual(escapeHtml("a'b"), 'a&#39;b');
    });

    test('escapes all entities together', () => {
      assert.strictEqual(escapeHtml('<div class="a">&\'test\'</div>'),
        '&lt;div class=&quot;a&quot;&gt;&amp;&#39;test&#39;&lt;/div&gt;');
    });

    test('returns empty string unchanged', () => {
      assert.strictEqual(escapeHtml(''), '');
    });

    test('returns safe text unchanged', () => {
      assert.strictEqual(escapeHtml('hello world'), 'hello world');
    });
  });

  suite('formatRelativeTime', () => {
    let clock: sinon.SinonFakeTimers;

    setup(() => {
      // Freeze Date.now() at a known point: 2024-01-15T12:00:00Z
      clock = sinon.useFakeTimers(new Date('2024-01-15T12:00:00Z').getTime());
    });

    teardown(() => {
      clock.restore();
    });

    test('returns "Just now" for less than 60 seconds ago', () => {
      const nowSeconds = Date.now() / 1000;
      assert.strictEqual(formatRelativeTime(nowSeconds - 30), 'Just now');
    });

    test('returns "Just now" for 0 seconds ago', () => {
      const nowSeconds = Date.now() / 1000;
      assert.strictEqual(formatRelativeTime(nowSeconds), 'Just now');
    });

    test('returns minutes ago', () => {
      const nowSeconds = Date.now() / 1000;
      assert.strictEqual(formatRelativeTime(nowSeconds - 300), '5m ago');
    });

    test('returns hours ago', () => {
      const nowSeconds = Date.now() / 1000;
      assert.strictEqual(formatRelativeTime(nowSeconds - 7200), '2h ago');
    });

    test('returns days ago', () => {
      const nowSeconds = Date.now() / 1000;
      assert.strictEqual(formatRelativeTime(nowSeconds - 86400 * 5), '5d ago');
    });

    test('returns absolute date for 30+ days ago', () => {
      const nowSeconds = Date.now() / 1000;
      const result = formatRelativeTime(nowSeconds - 86400 * 45);
      // Should be an absolute date string (not "Xd ago")
      assert.ok(!result.includes('ago'), `Expected absolute date but got: ${result}`);
      assert.ok(!result.includes('Just now'), `Expected absolute date but got: ${result}`);
    });

    test('boundary: exactly 60 seconds shows 1m ago', () => {
      const nowSeconds = Date.now() / 1000;
      assert.strictEqual(formatRelativeTime(nowSeconds - 60), '1m ago');
    });
  });

  suite('formatDuration', () => {
    test('hours and minutes', () => {
      assert.strictEqual(formatDuration(5400), '1h 30m');
    });

    test('hours only', () => {
      assert.strictEqual(formatDuration(7200), '2h');
    });

    test('minutes only', () => {
      assert.strictEqual(formatDuration(1800), '30m');
    });

    test('zero seconds', () => {
      assert.strictEqual(formatDuration(0), '0m');
    });

    test('less than a minute', () => {
      assert.strictEqual(formatDuration(45), '0m');
    });

    test('large value', () => {
      assert.strictEqual(formatDuration(86400), '24h');
    });
  });

  suite('getNonce', () => {
    test('returns a 32-character string', () => {
      const nonce = getNonce();
      assert.strictEqual(nonce.length, 32);
    });

    test('returns a hex string', () => {
      const nonce = getNonce();
      assert.ok(/^[0-9a-f]{32}$/.test(nonce), `Expected hex string but got: ${nonce}`);
    });

    test('returns different values on successive calls', () => {
      const a = getNonce();
      const b = getNonce();
      assert.notStrictEqual(a, b);
    });
  });

  suite('getThemeStyles', () => {
    test('returns a string containing --bg CSS variable', () => {
      const styles = getThemeStyles();
      assert.ok(styles.includes('--bg'), 'Expected --bg CSS variable');
    });

    test('returns a string containing --text CSS variable', () => {
      const styles = getThemeStyles();
      assert.ok(styles.includes('--text'), 'Expected --text CSS variable');
    });

    test('returns a string containing --accent CSS variable', () => {
      const styles = getThemeStyles();
      assert.ok(styles.includes('--accent'), 'Expected --accent CSS variable');
    });

    test('returns a string containing body selector', () => {
      const styles = getThemeStyles();
      assert.ok(styles.includes('body'), 'Expected body selector');
    });
  });

  suite('getCspMeta', () => {
    test('returns meta tag with Content-Security-Policy', () => {
      const webview = mockWebview();
      const nonce = 'abc123';
      const result = getCspMeta(webview, nonce);
      assert.ok(result.includes('Content-Security-Policy'), 'Expected CSP header');
    });

    test('includes the nonce', () => {
      const webview = mockWebview();
      const nonce = 'testnonce123';
      const result = getCspMeta(webview, nonce);
      assert.ok(result.includes(`nonce-${nonce}`), 'Expected nonce in CSP');
    });

    test('includes the cspSource', () => {
      const webview = mockWebview();
      const result = getCspMeta(webview, 'nonce');
      assert.ok(result.includes('https://mock.csp.source'), 'Expected cspSource in CSP');
    });

    test('returns a meta tag', () => {
      const webview = mockWebview();
      const result = getCspMeta(webview, 'nonce');
      assert.ok(result.startsWith('<meta'), 'Expected meta tag');
      assert.ok(result.endsWith('>'), 'Expected closing bracket');
    });
  });
});

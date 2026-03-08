import * as vscode from 'vscode';
import * as crypto from 'crypto';

/**
 * Generate a random nonce for Content Security Policy.
 */
export function getNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Build a CSP meta tag for webview panels.
 * Allows styles from the webview origin, scripts only from nonce.
 */
export function getCspMeta(webview: vscode.Webview, nonce: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https:;">`;
}

/**
 * Shared CSS variables that integrate with the VS Code theme.
 */
export function getThemeStyles(): string {
  return `
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
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      background: var(--bg);
      font: 14px/1.5 var(--vscode-font-family);
    }
    .shell {
      max-width: 1120px;
      margin: 0 auto;
      padding: 24px;
    }
    button {
      border: 1px solid transparent;
      border-radius: 999px;
      padding: 10px 14px;
      font: 600 13px/1 var(--vscode-font-family);
      cursor: pointer;
      transition: transform 120ms ease, opacity 120ms ease;
    }
    button:hover:not(:disabled) { transform: translateY(-1px); }
    button:disabled { cursor: default; opacity: 0.65; }
    button.primary {
      background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 92%, white 10%), color-mix(in srgb, var(--accent) 76%, black 8%));
      color: white;
    }
    button.secondary {
      background: transparent;
      color: var(--text);
      border-color: color-mix(in srgb, var(--border) 80%, transparent);
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
    .badge.pass { background: color-mix(in srgb, var(--ok) 16%, transparent); color: var(--ok); }
    .badge.fail { background: color-mix(in srgb, var(--bad) 16%, transparent); color: var(--bad); }
    .badge.neutral { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); }
    pre {
      margin: 0;
      overflow: auto;
      padding: 12px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--bg) 84%, black 6%);
      border: 1px solid color-mix(in srgb, var(--border) 62%, transparent);
      font: 12px/1.5 var(--mono);
      white-space: pre-wrap;
      word-break: break-word;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    }
    th {
      background: color-mix(in srgb, var(--panel) 90%, transparent);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    .positive { color: var(--ok); }
    .negative { color: var(--bad); }
    .card {
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 16px;
      background: color-mix(in srgb, var(--panel) 92%, transparent);
      padding: 18px 20px;
      margin-bottom: 14px;
    }
    .card h2, .card h3 { margin: 0 0 8px; }
    .tag {
      display: inline-block;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.8em;
      margin-right: 5px;
      margin-bottom: 5px;
    }
    .grid { display: grid; gap: 14px; }
    .flex { display: flex; gap: 10px; flex-wrap: wrap; }
    .text-center { text-align: center; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
  `;
}

/**
 * Escape HTML entities.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format a unix timestamp (seconds) to a relative time string.
 */
export function formatRelativeTime(timestampSeconds: number): string {
  const diffMs = Date.now() - timestampSeconds * 1000;
  if (diffMs < 60_000) { return 'Just now'; }
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) { return `${minutes}m ago`; }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) { return `${hours}h ago`; }
  const days = Math.floor(hours / 24);
  if (days < 30) { return `${days}d ago`; }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(timestampSeconds * 1000));
}

/**
 * Format a timestamp to absolute date string.
 */
export function formatAbsoluteDate(timestampSeconds: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestampSeconds * 1000));
}

/**
 * Format duration in seconds to a readable string like "2h 30m".
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) { return `${h}h ${m}m`; }
  if (h > 0) { return `${h}h`; }
  return `${m}m`;
}

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
// Register the vscode mock module so that `require('vscode')` resolves
// when tests run outside the VS Code extension host.
const Module = require('module');
const path = require('path');

const originalResolveFilename = (Module as any)._resolveFilename;

(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
  if (request === 'vscode') {
    return path.resolve(__dirname, 'mock-vscode.js');
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

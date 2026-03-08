import * as path from 'path';
import * as fs from 'fs';
import Mocha from 'mocha';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 10000,
    reporter: 'spec'
  });

  const testsRoot = path.resolve(__dirname, '.');

  return new Promise((resolve, reject) => {
    const resultPath = '/tmp/vscode-cf-test-results.txt';
    try {
      const files = fs.readdirSync(testsRoot).filter(f => f.endsWith('.test.js'));
      fs.writeFileSync(resultPath, `Found ${files.length} test file(s): ${files.join(', ')}\ntestsRoot: ${testsRoot}\n`);
      files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

      mocha.run(failures => {
        const totalTests = mocha.suite.total();
        fs.appendFileSync(resultPath, `Total: ${totalTests}, Failures: ${failures}\n`);
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      fs.writeFileSync(resultPath, `Error: ${err}\n`);
      reject(err);
    }
  });
}

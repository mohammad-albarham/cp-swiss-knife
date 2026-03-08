import * as assert from 'assert';
import * as sinon from 'sinon';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const proxyquire = require('proxyquire');

suite('TestService', () => {

  suite('getProblemMetadata', () => {
    let fsStub: Record<string, sinon.SinonStub>;
    let TestServiceClass: new () => { getProblemMetadata(filePath: string): { contestId: number; index: string; name?: string; testCases?: number } | undefined };

    setup(() => {
      fsStub = {
        existsSync: sinon.stub(),
        readFileSync: sinon.stub(),
        writeFileSync: sinon.stub(),
        mkdirSync: sinon.stub(),
        unlinkSync: sinon.stub(),
      };

      const proxied = proxyquire('../../services/testService', {
        fs: fsStub,
        child_process: { exec: sinon.stub() },
        './templateService': {
          getTemplateService: () => ({
            getLanguageFromExtension: () => 'cpp',
          }),
        },
      });

      TestServiceClass = proxied.TestService;
    });

    test('returns parsed metadata from valid .problem.json', () => {
      fsStub.existsSync.returns(true);
      fsStub.readFileSync.returns(JSON.stringify({
        contestId: 1900,
        index: 'A',
        name: 'Two Sum',
        testCases: 3,
      }));

      const svc = new TestServiceClass();
      const result = svc.getProblemMetadata('/home/user/problems/1900A-Two_Sum/cf_1900A.cpp');

      assert.ok(result);
      assert.strictEqual(result.contestId, 1900);
      assert.strictEqual(result.index, 'A');
      assert.strictEqual(result.name, 'Two Sum');
      assert.strictEqual(result.testCases, 3);
    });

    test('falls back to filename parsing when JSON is invalid', () => {
      fsStub.existsSync.returns(true);
      fsStub.readFileSync.returns('not valid json{{{');

      const svc = new TestServiceClass();
      const result = svc.getProblemMetadata('/home/user/problems/cf_1900A.cpp');

      assert.ok(result);
      assert.strictEqual(result.contestId, 1900);
      assert.strictEqual(result.index, 'A');
    });

    test('falls back to filename when .problem.json does not exist', () => {
      fsStub.existsSync.returns(false);

      const svc = new TestServiceClass();
      const result = svc.getProblemMetadata('/home/user/problems/cf_1900A.cpp');

      assert.ok(result);
      assert.strictEqual(result.contestId, 1900);
      assert.strictEqual(result.index, 'A');
    });

    test('parses cf_1900A.cpp correctly from filename', () => {
      fsStub.existsSync.returns(false);

      const svc = new TestServiceClass();
      const result = svc.getProblemMetadata('/some/path/cf_1900A.cpp');

      assert.ok(result);
      assert.strictEqual(result.contestId, 1900);
      assert.strictEqual(result.index, 'A');
    });

    test('parses cf_100B2.py correctly from filename', () => {
      fsStub.existsSync.returns(false);

      const svc = new TestServiceClass();
      const result = svc.getProblemMetadata('/some/path/cf_100B2.py');

      assert.ok(result);
      assert.strictEqual(result.contestId, 100);
      assert.strictEqual(result.index, 'B2');
    });

    test('parses cf_1A.java correctly from filename', () => {
      fsStub.existsSync.returns(false);

      const svc = new TestServiceClass();
      const result = svc.getProblemMetadata('/some/path/cf_1A.java');

      assert.ok(result);
      assert.strictEqual(result.contestId, 1);
      assert.strictEqual(result.index, 'A');
    });

    test('returns undefined when filename does not match pattern', () => {
      fsStub.existsSync.returns(false);

      const svc = new TestServiceClass();
      const result = svc.getProblemMetadata('/some/path/solution.cpp');

      assert.strictEqual(result, undefined);
    });

    test('returns undefined for completely unrelated filename', () => {
      fsStub.existsSync.returns(false);

      const svc = new TestServiceClass();
      const result = svc.getProblemMetadata('/some/path/main.py');

      assert.strictEqual(result, undefined);
    });

    test('falls back to filename when JSON lacks required fields', () => {
      fsStub.existsSync.returns(true);
      fsStub.readFileSync.returns(JSON.stringify({
        name: 'Only Name',
      }));

      const svc = new TestServiceClass();
      const result = svc.getProblemMetadata('/some/path/cf_500C.rs');

      assert.ok(result);
      assert.strictEqual(result.contestId, 500);
      assert.strictEqual(result.index, 'C');
    });
  });

  suite('compile', () => {
    let execStub: sinon.SinonStub;
    let TestServiceClass: new () => Record<string, unknown>;

    setup(() => {
      execStub = sinon.stub();

      const proxied = proxyquire('../../services/testService', {
        fs: {
          existsSync: sinon.stub().returns(true),
          readFileSync: sinon.stub().returns(''),
          writeFileSync: sinon.stub(),
          mkdirSync: sinon.stub(),
          unlinkSync: sinon.stub(),
        },
        child_process: { exec: execStub },
        './templateService': {
          getTemplateService: () => ({
            getLanguageFromExtension: (fp: string) => {
              if (fp.endsWith('.cpp')) { return 'cpp'; }
              if (fp.endsWith('.py')) { return 'python'; }
              if (fp.endsWith('.java')) { return 'java'; }
              if (fp.endsWith('.rs')) { return 'rust'; }
              return undefined;
            },
          }),
        },
      });

      TestServiceClass = proxied.TestService;
    });

    test('compiled language (cpp) calls exec with compile command', async () => {
      execStub.callsFake((_cmd: string, _opts: unknown, cb: (err: null, stdout: string, stderr: string) => void) => {
        cb(null, '', '');
      });

      const svc = new TestServiceClass();
      // Access private compile through the prototype
      const result = await (svc as { compile(fp: string, lang: string): Promise<string> }).compile('/home/user/cf_1900A.cpp', 'cpp');

      assert.ok(result.includes('solution'), `Expected output path with "solution", got: ${result}`);
      assert.ok(execStub.calledOnce);
      const cmd = execStub.firstCall.args[0] as string;
      assert.ok(cmd.includes('g++'), `Expected compile command to include g++, got: ${cmd}`);
      assert.ok(cmd.includes('cf_1900A.cpp'));
    });

    test('interpreted language (python) skips compilation and returns filePath', async () => {
      const svc = new TestServiceClass();
      const result = await (svc as { compile(fp: string, lang: string): Promise<string> }).compile('/home/user/cf_1900A.py', 'python');

      assert.strictEqual(result, '/home/user/cf_1900A.py');
      assert.ok(execStub.notCalled, 'exec should not be called for python');
    });

    test('compilation error rejects with stderr message', async () => {
      const compileError = new Error('compilation failed') as Error & { killed: boolean };
      compileError.killed = false;

      execStub.callsFake((_cmd: string, _opts: unknown, cb: (err: Error, stdout: string, stderr: string) => void) => {
        cb(compileError, '', 'error: undefined reference to main');
      });

      const svc = new TestServiceClass();
      try {
        await (svc as { compile(fp: string, lang: string): Promise<string> }).compile('/home/user/cf_1900A.cpp', 'cpp');
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('Compilation failed'));
        assert.ok(err.message.includes('undefined reference to main'));
      }
    });

    test('rust compilation calls rustc', async () => {
      execStub.callsFake((_cmd: string, _opts: unknown, cb: (err: null, stdout: string, stderr: string) => void) => {
        cb(null, '', '');
      });

      const svc = new TestServiceClass();
      const result = await (svc as { compile(fp: string, lang: string): Promise<string> }).compile('/home/user/cf_1900A.rs', 'rust');

      assert.ok(result.includes('solution'));
      const cmd = execStub.firstCall.args[0] as string;
      assert.ok(cmd.includes('rustc'), `Expected rustc, got: ${cmd}`);
    });
  });

  suite('executeCode', () => {
    let execStub: sinon.SinonStub;
    let TestServiceClass: new () => Record<string, unknown>;

    setup(() => {
      execStub = sinon.stub();

      const proxied = proxyquire('../../services/testService', {
        fs: {
          existsSync: sinon.stub().returns(false),
          readFileSync: sinon.stub().returns(''),
          writeFileSync: sinon.stub(),
          mkdirSync: sinon.stub(),
          unlinkSync: sinon.stub(),
        },
        child_process: { exec: execStub },
        './templateService': {
          getTemplateService: () => ({
            getLanguageFromExtension: () => 'cpp',
          }),
        },
      });

      TestServiceClass = proxied.TestService;
    });

    test('returns stdout and stderr from execution', async () => {
      const mockStdin = { write: sinon.stub(), end: sinon.stub() };
      execStub.callsFake((_cmd: string, _opts: unknown, cb: (err: null, stdout: string, stderr: string) => void) => {
        cb(null, '42\n', '');
        return { stdin: mockStdin };
      });

      const svc = new TestServiceClass();
      const result = await (svc as { executeCode(ep: string, lang: string, input: string, wd: string): Promise<{ stdout: string; stderr: string }> })
        .executeCode('/home/user/solution', 'cpp', '5\n', '/home/user');

      assert.strictEqual(result.stdout, '42\n');
      assert.strictEqual(result.stderr, '');
    });

    test('rejects with Time Limit Exceeded when process is killed', async () => {
      const mockStdin = { write: sinon.stub(), end: sinon.stub() };
      const tleError = new Error('killed') as Error & { killed: boolean };
      tleError.killed = true;

      execStub.callsFake((_cmd: string, _opts: unknown, cb: (err: Error, stdout: string, stderr: string) => void) => {
        cb(tleError, '', '');
        return { stdin: mockStdin };
      });

      const svc = new TestServiceClass();
      try {
        await (svc as { executeCode(ep: string, lang: string, input: string, wd: string): Promise<{ stdout: string; stderr: string }> })
          .executeCode('/home/user/solution', 'cpp', '5\n', '/home/user');
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.strictEqual(err.message, 'Time Limit Exceeded');
      }
    });

    test('rejects with Runtime Error when error occurs without stderr', async () => {
      const mockStdin = { write: sinon.stub(), end: sinon.stub() };
      const runtimeError = new Error('segfault') as Error & { killed: boolean };
      runtimeError.killed = false;

      execStub.callsFake((_cmd: string, _opts: unknown, cb: (err: Error, stdout: string, stderr: string) => void) => {
        cb(runtimeError, '', '');
        return { stdin: mockStdin };
      });

      const svc = new TestServiceClass();
      try {
        await (svc as { executeCode(ep: string, lang: string, input: string, wd: string): Promise<{ stdout: string; stderr: string }> })
          .executeCode('/home/user/solution', 'cpp', '5\n', '/home/user');
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('Runtime Error'));
      }
    });

    test('resolves with stderr when error occurs but stderr is present', async () => {
      const mockStdin = { write: sinon.stub(), end: sinon.stub() };
      const error = new Error('non-zero exit') as Error & { killed: boolean };
      error.killed = false;

      execStub.callsFake((_cmd: string, _opts: unknown, cb: (err: Error, stdout: string, stderr: string) => void) => {
        cb(error, 'partial output\n', 'warning: something\n');
        return { stdin: mockStdin };
      });

      const svc = new TestServiceClass();
      const result = await (svc as { executeCode(ep: string, lang: string, input: string, wd: string): Promise<{ stdout: string; stderr: string }> })
        .executeCode('/home/user/solution', 'cpp', '5\n', '/home/user');

      assert.strictEqual(result.stdout, 'partial output\n');
      assert.strictEqual(result.stderr, 'warning: something\n');
    });

    test('sends input to stdin', async () => {
      const mockStdin = { write: sinon.stub(), end: sinon.stub() };
      execStub.callsFake((_cmd: string, _opts: unknown, cb: (err: null, stdout: string, stderr: string) => void) => {
        cb(null, '', '');
        return { stdin: mockStdin };
      });

      const svc = new TestServiceClass();
      await (svc as { executeCode(ep: string, lang: string, input: string, wd: string): Promise<{ stdout: string; stderr: string }> })
        .executeCode('/home/user/solution', 'cpp', '10 20\n', '/home/user');

      assert.ok(mockStdin.write.calledWith('10 20\n'));
      assert.ok(mockStdin.end.calledOnce);
    });

    test('python uses python3 command', async () => {
      const mockStdin = { write: sinon.stub(), end: sinon.stub() };
      execStub.callsFake((_cmd: string, _opts: unknown, cb: (err: null, stdout: string, stderr: string) => void) => {
        cb(null, '', '');
        return { stdin: mockStdin };
      });

      const svc = new TestServiceClass();
      await (svc as { executeCode(ep: string, lang: string, input: string, wd: string): Promise<{ stdout: string; stderr: string }> })
        .executeCode('/home/user/cf_1900A.py', 'python', '', '/home/user');

      const cmd = execStub.firstCall.args[0] as string;
      assert.ok(cmd.includes('python3'), `Expected python3 in command, got: ${cmd}`);
    });
  });
});

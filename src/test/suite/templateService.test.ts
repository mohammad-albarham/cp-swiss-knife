import * as assert from 'assert';
import * as sinon from 'sinon';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const proxyquire = require('proxyquire');
import { TemplateService } from '../../services/templateService';
import { ProblemDetails, SupportedLanguage } from '../../api/types';

function makeProblem(overrides: Partial<ProblemDetails> = {}): ProblemDetails {
  return {
    contestId: 1900,
    index: 'A',
    name: 'Two Sum',
    timeLimit: '2 seconds',
    memoryLimit: '256 megabytes',
    inputType: 'standard input',
    outputType: 'standard output',
    statement: '',
    inputSpecification: '',
    outputSpecification: '',
    sampleTests: [
      { input: '3\n1 2\n', output: '3\n' },
      { input: '5\n2 3\n', output: '5\n' }
    ],
    tags: ['math', 'greedy'],
    rating: 1200,
    ...overrides,
  };
}

suite('TemplateService', () => {
  let service: TemplateService;

  setup(() => {
    service = new TemplateService();
  });

  suite('getLanguageFromExtension', () => {
    const cases: [string, SupportedLanguage][] = [
      ['/home/user/cf_1900A.cpp', 'cpp'],
      ['/home/user/cf_1900A.py', 'python'],
      ['/home/user/cf_1900A.java', 'java'],
      ['/home/user/cf_1900A.kt', 'kotlin'],
      ['/home/user/cf_1900A.rs', 'rust'],
      ['/home/user/cf_1900A.go', 'go'],
      ['/home/user/cf_1900A.cs', 'csharp'],
      ['/home/user/cf_1900A.js', 'javascript'],
    ];

    for (const [filePath, expected] of cases) {
      test(`maps ${filePath} to ${expected}`, () => {
        assert.strictEqual(service.getLanguageFromExtension(filePath), expected);
      });
    }

    test('returns undefined for unknown extension', () => {
      assert.strictEqual(service.getLanguageFromExtension('/home/user/cf_1900A.rb'), undefined);
    });

    test('returns undefined for file with no extension', () => {
      assert.strictEqual(service.getLanguageFromExtension('/home/user/Makefile'), undefined);
    });
  });

  suite('getDefaultTemplate', () => {
    const languages: SupportedLanguage[] = [
      'cpp', 'python', 'java', 'kotlin', 'rust', 'go', 'csharp', 'javascript'
    ];

    for (const lang of languages) {
      test(`returns non-empty template for ${lang}`, () => {
        const template = service.getDefaultTemplate(lang);
        assert.ok(template.length > 0, `Template for ${lang} should not be empty`);
      });
    }

    test('contains placeholder markers in cpp template', () => {
      const template = service.getDefaultTemplate('cpp');
      assert.ok(template.includes('{problemName}'));
      assert.ok(template.includes('{contestId}'));
      assert.ok(template.includes('{index}'));
    });
  });

  suite('applyTemplate', () => {
    test('replaces all placeholders', () => {
      const template = '{problemName} {contestId} {index} {memoryLimit} {timeLimit} {rating} {tags} {author}';
      const problem = makeProblem();
      const result = service.applyTemplate(template, problem);
      assert.strictEqual(result, 'Two Sum 1900 A 256 megabytes 2 seconds 1200 math, greedy ');
    });

    test('replaces multiple occurrences of the same placeholder', () => {
      const template = '{contestId}/{index} - {contestId}/{index}';
      const problem = makeProblem();
      const result = service.applyTemplate(template, problem);
      assert.strictEqual(result, '1900/A - 1900/A');
    });

    test('uses "Unrated" when rating is undefined', () => {
      const template = 'Rating: {rating}';
      const problem = makeProblem({ rating: undefined });
      const result = service.applyTemplate(template, problem);
      assert.strictEqual(result, 'Rating: Unrated');
    });

    test('uses "none" when tags array is empty', () => {
      const template = 'Tags: {tags}';
      const problem = makeProblem({ tags: [] });
      const result = service.applyTemplate(template, problem);
      assert.strictEqual(result, 'Tags: none');
    });

    test('joins multiple tags with comma and space', () => {
      const template = '{tags}';
      const problem = makeProblem({ tags: ['dp', 'graphs', 'bitmasks'] });
      const result = service.applyTemplate(template, problem);
      assert.strictEqual(result, 'dp, graphs, bitmasks');
    });

    test('author defaults to empty string when config is not set', () => {
      const template = 'Author: [{author}]';
      const problem = makeProblem();
      const result = service.applyTemplate(template, problem);
      assert.strictEqual(result, 'Author: []');
    });
  });

  suite('createSolutionFile (with fs mocks)', () => {
    let fsStub: Record<string, sinon.SinonStub>;
    let ProxiedTemplateService: typeof TemplateService;

    setup(() => {
      fsStub = {
        existsSync: sinon.stub().returns(false),
        mkdirSync: sinon.stub(),
        writeFileSync: sinon.stub(),
        readFileSync: sinon.stub(),
        unlinkSync: sinon.stub(),
      };

      const proxied = proxyquire('../../services/templateService', {
        fs: fsStub,
      });

      ProxiedTemplateService = proxied.TemplateService;
    });

    test('creates directory when it does not exist', async () => {
      fsStub.existsSync.returns(false);
      const svc = new ProxiedTemplateService();
      const problem = makeProblem();

      await svc.createSolutionFile(problem, 'cpp');

      assert.ok(fsStub.mkdirSync.calledOnce, 'mkdirSync should be called once');
      const mkdirCall = fsStub.mkdirSync.firstCall;
      assert.ok(mkdirCall.args[0].includes('1900A-Two_Sum'));
      assert.deepStrictEqual(mkdirCall.args[1], { recursive: true });
    });

    test('does not create directory when it already exists', async () => {
      // First call: existsSync for the directory (true)
      // Second call: existsSync for the solution file (false)
      fsStub.existsSync.onCall(0).returns(true);
      fsStub.existsSync.onCall(1).returns(false);

      const svc = new ProxiedTemplateService();
      const problem = makeProblem();

      await svc.createSolutionFile(problem, 'python');

      assert.ok(fsStub.mkdirSync.notCalled, 'mkdirSync should not be called');
    });

    test('writes solution file with correct extension', async () => {
      fsStub.existsSync.returns(false);
      const svc = new ProxiedTemplateService();
      const problem = makeProblem();

      const result = await svc.createSolutionFile(problem, 'cpp');

      assert.ok(result.endsWith('.cpp'));
      assert.ok(result.includes('cf_1900A'));
    });

    test('writes .problem.json metadata', async () => {
      fsStub.existsSync.returns(false);
      const svc = new ProxiedTemplateService();
      const problem = makeProblem();

      await svc.createSolutionFile(problem, 'cpp');

      // Find the writeFileSync call that writes .problem.json
      const metadataCall = fsStub.writeFileSync.getCalls().find(
        (call: sinon.SinonSpyCall) => String(call.args[0]).includes('.problem.json')
      );
      assert.ok(metadataCall, '.problem.json should be written');
      const metadata = JSON.parse(metadataCall.args[1] as string);
      assert.strictEqual(metadata.contestId, 1900);
      assert.strictEqual(metadata.index, 'A');
      assert.strictEqual(metadata.name, 'Two Sum');
      assert.strictEqual(metadata.testCases, 2);
    });

    test('writes test case files', async () => {
      fsStub.existsSync.returns(false);
      const svc = new ProxiedTemplateService();
      const problem = makeProblem();

      await svc.createSolutionFile(problem, 'cpp');

      const inputCalls = fsStub.writeFileSync.getCalls().filter(
        (call: sinon.SinonSpyCall) => String(call.args[0]).includes('input')
      );
      const outputCalls = fsStub.writeFileSync.getCalls().filter(
        (call: sinon.SinonSpyCall) => String(call.args[0]).includes('output') && !String(call.args[0]).includes('.problem')
      );
      assert.strictEqual(inputCalls.length, 2);
      assert.strictEqual(outputCalls.length, 2);
    });

    test('creates files for different languages with correct extensions', async () => {
      const langExtMap: [SupportedLanguage, string][] = [
        ['python', '.py'],
        ['java', '.java'],
        ['rust', '.rs'],
      ];

      for (const [lang, ext] of langExtMap) {
        fsStub.existsSync.returns(false);
        fsStub.writeFileSync.resetHistory();
        fsStub.mkdirSync.resetHistory();

        const svc = new ProxiedTemplateService();
        const result = await svc.createSolutionFile(makeProblem(), lang);
        assert.ok(result.endsWith(ext), `Expected ${ext} for ${lang}, got ${result}`);
      }
    });
  });

  suite('saveTestCases (with fs mocks)', () => {
    let fsStub: Record<string, sinon.SinonStub>;
    let ProxiedTemplateService: typeof TemplateService;

    setup(() => {
      fsStub = {
        existsSync: sinon.stub().returns(false),
        mkdirSync: sinon.stub(),
        writeFileSync: sinon.stub(),
        readFileSync: sinon.stub(),
        unlinkSync: sinon.stub(),
      };

      const proxied = proxyquire('../../services/templateService', {
        fs: fsStub,
      });

      ProxiedTemplateService = proxied.TemplateService;
    });

    test('removes existing test case files before writing new ones', async () => {
      // Simulate 2 existing test cases, then none
      fsStub.existsSync
        .onCall(0).returns(true)   // input1.txt exists
        .onCall(1).returns(true)   // output1.txt exists
        .onCall(2).returns(true)   // input2.txt exists
        .onCall(3).returns(true)   // output2.txt exists
        .onCall(4).returns(false)  // input3.txt does not exist
        .onCall(5).returns(false)  // output3.txt does not exist
        .returns(false);           // metadata file does not exist

      const svc = new ProxiedTemplateService();
      await svc.saveTestCases('/mock/folder', [
        { input: 'a\n', output: 'b\n' }
      ]);

      assert.ok(fsStub.unlinkSync.callCount >= 2, 'Should unlink existing files');
    });

    test('writes correct number of input/output files', async () => {
      fsStub.existsSync.returns(false);

      const svc = new ProxiedTemplateService();
      const testCases = [
        { input: '1\n', output: '2\n' },
        { input: '3\n', output: '4\n' },
        { input: '5\n', output: '6\n' },
      ];

      await svc.saveTestCases('/mock/folder', testCases);

      const writeCalls = fsStub.writeFileSync.getCalls();
      const inputWrites = writeCalls.filter(
        (c: sinon.SinonSpyCall) => String(c.args[0]).includes('input')
      );
      const outputWrites = writeCalls.filter(
        (c: sinon.SinonSpyCall) => String(c.args[0]).includes('output') && !String(c.args[0]).includes('.problem')
      );

      assert.strictEqual(inputWrites.length, 3);
      assert.strictEqual(outputWrites.length, 3);
    });

    test('writes correct content to test case files', async () => {
      fsStub.existsSync.returns(false);

      const svc = new ProxiedTemplateService();
      await svc.saveTestCases('/mock/folder', [
        { input: 'hello\n', output: 'world\n' }
      ]);

      const writeCalls = fsStub.writeFileSync.getCalls();
      const inputCall = writeCalls.find(
        (c: sinon.SinonSpyCall) => String(c.args[0]).includes('input1.txt')
      );
      const outputCall = writeCalls.find(
        (c: sinon.SinonSpyCall) => String(c.args[0]).includes('output1.txt')
      );

      assert.ok(inputCall, 'input1.txt should be written');
      assert.strictEqual(inputCall.args[1], 'hello\n');
      assert.ok(outputCall, 'output1.txt should be written');
      assert.strictEqual(outputCall.args[1], 'world\n');
    });

    test('updates metadata test count when .problem.json exists', async () => {
      // removeExistingTestCaseFiles: no existing files
      fsStub.existsSync.onCall(0).returns(false); // input1 check
      fsStub.existsSync.onCall(1).returns(false); // output1 check
      // updateMetadataTestCount: metadata exists
      fsStub.existsSync.onCall(2).returns(true);
      fsStub.readFileSync.returns(JSON.stringify({ contestId: 1900, index: 'A', testCases: 0 }));

      const svc = new ProxiedTemplateService();
      await svc.saveTestCases('/mock/folder', [
        { input: '1\n', output: '2\n' }
      ]);

      // Find the .problem.json write
      const metaWrite = fsStub.writeFileSync.getCalls().find(
        (c: sinon.SinonSpyCall) => String(c.args[0]).includes('.problem.json')
      );
      assert.ok(metaWrite, 'Should update .problem.json');
      const updated = JSON.parse(metaWrite.args[1] as string);
      assert.strictEqual(updated.testCases, 1);
    });
  });
});

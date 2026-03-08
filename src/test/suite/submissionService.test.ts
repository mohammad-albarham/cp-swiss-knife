import * as assert from 'assert';
import * as sinon from 'sinon';
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
const proxyquire = require('proxyquire');
/* eslint-enable @typescript-eslint/no-var-requires */

const mockAxiosInstance = {
  get: sinon.stub()
};

const mockAxios: Record<string, unknown> = {
  default: { create: sinon.stub().returns(mockAxiosInstance) },
  create: sinon.stub().returns(mockAxiosInstance),
  '@noCallThru': true,
};

const { SubmissionService } = proxyquire('../../services/submissionService', {
  'axios': mockAxios,
  'playwright-core': { '@noCallThru': true },
  '../api': { codeforcesApi: {} },
  './authService': { getAuthService: () => ({}) },
  './storageService': { getStorageService: () => ({ getGlobalStoragePath: () => '/tmp' }) },
  '../views/contestsExplorer': { getContestsExplorer: () => ({ getRunningContests: () => [] }) },
  '../utils/logger': { logger: { warn: () => {}, info: () => {}, error: () => {}, debug: () => {} } },
});

// ---------- HTML Fixtures ----------

const sampleHtml = `
<div class="problem-statement">
  <div class="header">
    <div class="title">A. Test Problem</div>
    <div class="time-limit">time limit per test2 seconds</div>
    <div class="memory-limit">memory limit per test256 megabytes</div>
    <div class="input-file">inputstandard input</div>
    <div class="output-file">outputstandard output</div>
  </div>
  <div><p>This is the problem statement.</p></div>
  <div class="input-specification"><div class="section-title">Input</div><p>Input description</p></div>
  <div class="output-specification"><div class="section-title">Output</div><p>Output description</p></div>
  <div class="sample-tests">
    <div class="sample-test">
      <div class="input"><pre>1 2</pre></div>
      <div class="output"><pre>3</pre></div>
    </div>
  </div>
  <div class="note"><div class="section-title">Note</div><p>Some note here</p></div>
</div>
<span class="tag-box">dp</span>
<span class="tag-box">greedy</span>
<span class="tag-box" title="Difficulty">*1500</span>
`;

const htmlNoStatement = `
<html><body><div>No problem here</div></body></html>
`;

const htmlMultipleSamples = `
<div class="problem-statement">
  <div class="header">
    <div class="title">B. Multi Sample</div>
    <div class="time-limit">time limit per test3 seconds</div>
    <div class="memory-limit">memory limit per test512 megabytes</div>
    <div class="input-file">inputstandard input</div>
    <div class="output-file">outputstandard output</div>
  </div>
  <div><p>Statement text.</p></div>
  <div class="input-specification"><div class="section-title">Input</div><p>Input spec</p></div>
  <div class="output-specification"><div class="section-title">Output</div><p>Output spec</p></div>
  <div class="sample-tests">
    <div class="sample-test">
      <div class="input"><pre>1
2</pre></div>
      <div class="output"><pre>3</pre></div>
    </div>
    <div class="sample-test">
      <div class="input"><pre>10
20</pre></div>
      <div class="output"><pre>30</pre></div>
    </div>
  </div>
</div>
`;

const htmlWithBrTags = `
<div class="problem-statement">
  <div class="header">
    <div class="title">C. BR Problem</div>
    <div class="time-limit">time limit per test1 second</div>
    <div class="memory-limit">memory limit per test256 megabytes</div>
    <div class="input-file">inputstandard input</div>
    <div class="output-file">outputstandard output</div>
  </div>
  <div><p>Desc</p></div>
  <div class="input-specification"><div class="section-title">Input</div><p>in</p></div>
  <div class="output-specification"><div class="section-title">Output</div><p>out</p></div>
  <div class="sample-tests">
    <div class="sample-test">
      <div class="input"><pre>hello<br>world<br/>end</pre></div>
      <div class="output"><pre>a &amp; b &lt; c &gt; d</pre></div>
    </div>
  </div>
</div>
`;

const htmlNoRating = `
<div class="problem-statement">
  <div class="header">
    <div class="title">D. No Rating</div>
    <div class="time-limit">time limit per test2 seconds</div>
    <div class="memory-limit">memory limit per test256 megabytes</div>
    <div class="input-file">inputstandard input</div>
    <div class="output-file">outputstandard output</div>
  </div>
  <div><p>Statement</p></div>
  <div class="sample-tests">
    <div class="sample-test">
      <div class="input"><pre>1</pre></div>
      <div class="output"><pre>2</pre></div>
    </div>
  </div>
</div>
<span class="tag-box">math</span>
`;

suite('SubmissionService', () => {
  let service: InstanceType<typeof SubmissionService>;

  setup(() => {
    mockAxiosInstance.get.reset();
    service = new SubmissionService();
  });

  teardown(() => {
    sinon.restore();
  });

  suite('fetchProblemDetails - full HTML', () => {
    test('parses problem name correctly', async () => {
      mockAxiosInstance.get.resolves({ data: sampleHtml });
      const result = await service.fetchProblemDetails(1900, 'A');
      assert.strictEqual(result.name, 'Test Problem');
    });

    test('parses time limit', async () => {
      mockAxiosInstance.get.resolves({ data: sampleHtml });
      const result = await service.fetchProblemDetails(1900, 'A');
      assert.strictEqual(result.timeLimit, '2 seconds');
    });

    test('parses memory limit', async () => {
      mockAxiosInstance.get.resolves({ data: sampleHtml });
      const result = await service.fetchProblemDetails(1900, 'A');
      assert.strictEqual(result.memoryLimit, '256 megabytes');
    });

    test('parses input and output types', async () => {
      mockAxiosInstance.get.resolves({ data: sampleHtml });
      const result = await service.fetchProblemDetails(1900, 'A');
      assert.strictEqual(result.inputType, 'standard input');
      assert.strictEqual(result.outputType, 'standard output');
    });

    test('parses sample tests', async () => {
      mockAxiosInstance.get.resolves({ data: sampleHtml });
      const result = await service.fetchProblemDetails(1900, 'A');
      assert.strictEqual(result.sampleTests.length, 1);
      assert.strictEqual(result.sampleTests[0].input, '1 2');
      assert.strictEqual(result.sampleTests[0].output, '3');
    });

    test('parses tags', async () => {
      mockAxiosInstance.get.resolves({ data: sampleHtml });
      const result = await service.fetchProblemDetails(1900, 'A');
      assert.ok(result.tags.includes('dp'));
      assert.ok(result.tags.includes('greedy'));
    });

    test('parses rating from Difficulty tag-box', async () => {
      mockAxiosInstance.get.resolves({ data: sampleHtml });
      const result = await service.fetchProblemDetails(1900, 'A');
      assert.strictEqual(result.rating, 1500);
    });

    test('returns contestId and index', async () => {
      mockAxiosInstance.get.resolves({ data: sampleHtml });
      const result = await service.fetchProblemDetails(1900, 'A');
      assert.strictEqual(result.contestId, 1900);
      assert.strictEqual(result.index, 'A');
    });

    test('includes notes when present', async () => {
      mockAxiosInstance.get.resolves({ data: sampleHtml });
      const result = await service.fetchProblemDetails(1900, 'A');
      assert.ok(result.notes, 'notes should be defined');
      assert.ok(result.notes.includes('Some note here'));
    });

    test('parses statement text', async () => {
      mockAxiosInstance.get.resolves({ data: sampleHtml });
      const result = await service.fetchProblemDetails(1900, 'A');
      assert.ok(result.statement.includes('This is the problem statement.'));
    });
  });

  suite('fetchProblemDetails - missing statement', () => {
    test('throws "Problem statement not found" when no .problem-statement', async () => {
      mockAxiosInstance.get.resolves({ data: htmlNoStatement });

      await assert.rejects(
        () => service.fetchProblemDetails(1900, 'A'),
        (err: Error) => {
          assert.ok(err.message.includes('Problem statement not found'));
          return true;
        }
      );
    });
  });

  suite('fetchProblemDetails - multiple sample tests', () => {
    test('parses all sample test cases', async () => {
      mockAxiosInstance.get.resolves({ data: htmlMultipleSamples });
      const result = await service.fetchProblemDetails(100, 'B');
      assert.strictEqual(result.sampleTests.length, 2);
      assert.strictEqual(result.sampleTests[0].input, '1\n2');
      assert.strictEqual(result.sampleTests[0].output, '3');
      assert.strictEqual(result.sampleTests[1].input, '10\n20');
      assert.strictEqual(result.sampleTests[1].output, '30');
    });
  });

  suite('cleanSampleText via HTML with <br> tags and entities', () => {
    test('replaces <br> tags with newlines and decodes entities', async () => {
      mockAxiosInstance.get.resolves({ data: htmlWithBrTags });
      const result = await service.fetchProblemDetails(200, 'C');
      assert.strictEqual(result.sampleTests.length, 1);
      assert.strictEqual(result.sampleTests[0].input, 'hello\nworld\nend');
      assert.strictEqual(result.sampleTests[0].output, 'a & b < c > d');
    });
  });

  suite('fetchProblemDetails - no rating', () => {
    test('rating is undefined when no Difficulty tag-box exists', async () => {
      mockAxiosInstance.get.resolves({ data: htmlNoRating });
      const result = await service.fetchProblemDetails(300, 'D');
      assert.strictEqual(result.rating, undefined);
    });

    test('tags still parsed when no rating', async () => {
      mockAxiosInstance.get.resolves({ data: htmlNoRating });
      const result = await service.fetchProblemDetails(300, 'D');
      assert.ok(result.tags.includes('math'));
    });
  });

  suite('fetchProblemDetails - empty sample tests', () => {
    test('returns empty sampleTests array when no sample-test divs', async () => {
      const htmlNoSamples = `
<div class="problem-statement">
  <div class="header">
    <div class="title">E. No Samples</div>
    <div class="time-limit">time limit per test1 second</div>
    <div class="memory-limit">memory limit per test256 megabytes</div>
    <div class="input-file">inputstandard input</div>
    <div class="output-file">outputstandard output</div>
  </div>
  <div><p>Description</p></div>
  <div class="sample-tests"></div>
</div>
`;
      mockAxiosInstance.get.resolves({ data: htmlNoSamples });
      const result = await service.fetchProblemDetails(400, 'E');
      assert.strictEqual(result.sampleTests.length, 0);
    });
  });

  suite('fetchProblemDetails - network error', () => {
    test('throws wrapped error on request failure', async () => {
      mockAxiosInstance.get.rejects(new Error('Network Error'));

      await assert.rejects(
        () => service.fetchProblemDetails(1900, 'A'),
        (err: Error) => {
          assert.ok(err.message.includes('Failed to fetch problem'));
          assert.ok(err.message.includes('Network Error'));
          return true;
        }
      );
    });
  });

  suite('fetchProblemDetails - default values', () => {
    test('uses contestId+index as name when title is empty', async () => {
      const htmlEmptyTitle = `
<div class="problem-statement">
  <div class="header">
    <div class="title"></div>
    <div class="time-limit">time limit per test2 seconds</div>
    <div class="memory-limit">memory limit per test256 megabytes</div>
    <div class="input-file">inputstandard input</div>
    <div class="output-file">outputstandard output</div>
  </div>
  <div><p>Desc</p></div>
  <div class="sample-tests">
    <div class="sample-test">
      <div class="input"><pre>1</pre></div>
      <div class="output"><pre>2</pre></div>
    </div>
  </div>
</div>
`;
      mockAxiosInstance.get.resolves({ data: htmlEmptyTitle });
      const result = await service.fetchProblemDetails(500, 'F');
      assert.strictEqual(result.name, '500F');
    });
  });
});

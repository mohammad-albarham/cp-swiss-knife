import * as assert from 'assert';
import * as sinon from 'sinon';
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
const proxyquire = require('proxyquire');
/* eslint-enable @typescript-eslint/no-var-requires */

// Mock AxiosError so that instanceof checks work in the production code
class MockAxiosError extends Error {
  response?: { status: number };
  constructor(message: string, response?: { status: number }) {
    super(message);
    this.response = response;
  }
}

const mockAxiosInstance = {
  get: sinon.stub()
};

const mockAxios = {
  default: { create: sinon.stub().returns(mockAxiosInstance) },
  create: sinon.stub().returns(mockAxiosInstance),
  AxiosError: MockAxiosError,
};

const { CodeforcesApi } = proxyquire('../../api/codeforcesApi', {
  'axios': mockAxios,
});

suite('CodeforcesApi', () => {
  let api: InstanceType<typeof CodeforcesApi>;

  setup(() => {
    mockAxiosInstance.get.reset();
    api = new CodeforcesApi();
    // Reset lastRequestTime so rate limiter doesn't interfere
    (api as any).lastRequestTime = 0;
  });

  teardown(() => {
    sinon.restore();
  });

  suite('constructor', () => {
    test('creates an axios instance with correct baseURL', () => {
      assert.ok(mockAxios.create.called || mockAxios.default.create.called);
      const createStub = mockAxios.create.called ? mockAxios.create : mockAxios.default.create;
      const callArgs = createStub.lastCall.args[0];
      assert.strictEqual(callArgs.baseURL, 'https://codeforces.com/api');
    });
  });

  suite('setCredentials / clearCredentials', () => {
    test('setCredentials stores apiKey and apiSecret', () => {
      api.setCredentials('myKey', 'mySecret');
      assert.strictEqual((api as any).apiKey, 'myKey');
      assert.strictEqual((api as any).apiSecret, 'mySecret');
    });

    test('clearCredentials removes apiKey and apiSecret', () => {
      api.setCredentials('myKey', 'mySecret');
      api.clearCredentials();
      assert.strictEqual((api as any).apiKey, undefined);
      assert.strictEqual((api as any).apiSecret, undefined);
    });
  });

  suite('request - success response', () => {
    test('returns result when status is OK', async () => {
      const mockResult = [{ id: 1, name: 'Contest 1' }];
      mockAxiosInstance.get.resolves({
        data: { status: 'OK', result: mockResult }
      });

      const result = await api.getContestList();
      assert.deepStrictEqual(result, mockResult);
    });
  });

  suite('request - failed response', () => {
    test('throws error with comment when status is FAILED', async () => {
      mockAxiosInstance.get.resolves({
        data: { status: 'FAILED', comment: 'Handle not found' }
      });

      await assert.rejects(
        () => api.getUserInfo(['nonexistent']),
        (err: Error) => {
          assert.ok(err.message.includes('Handle not found'));
          return true;
        }
      );
    });

    test('throws generic message when FAILED with no comment', async () => {
      mockAxiosInstance.get.resolves({
        data: { status: 'FAILED' }
      });

      await assert.rejects(
        () => api.getContestList(),
        (err: Error) => {
          assert.ok(err.message.includes('API request failed'));
          return true;
        }
      );
    });
  });

  suite('request - network error', () => {
    test('wraps AxiosError in "API Error: ..." message', async () => {
      const axiosErr = new MockAxiosError('Network Error');
      mockAxiosInstance.get.rejects(axiosErr);

      await assert.rejects(
        () => api.getContestList(),
        (err: Error) => {
          assert.ok(err.message.startsWith('API Error:'));
          assert.ok(err.message.includes('Network Error'));
          return true;
        }
      );
    });

    test('re-throws non-Axios errors directly', async () => {
      const genericErr = new Error('Something unexpected');
      mockAxiosInstance.get.rejects(genericErr);

      await assert.rejects(
        () => api.getContestList(),
        (err: Error) => {
          assert.strictEqual(err.message, 'Something unexpected');
          return true;
        }
      );
    });
  });

  suite('rate limiting', () => {
    test('enforces MIN_REQUEST_INTERVAL between requests', async () => {
      mockAxiosInstance.get.resolves({
        data: { status: 'OK', result: [] }
      });

      // Manually set lastRequestTime to "just now" so second call must wait
      const now = Date.now();
      (api as any).lastRequestTime = now;

      // Spy on setTimeout to verify a delay is scheduled
      const setTimeoutSpy = sinon.spy(global, 'setTimeout');

      const promise = api.getContestList();

      // The rateLimit() should have called setTimeout with a delay
      const rateLimitCall = setTimeoutSpy.getCalls().find(call => {
        const delay = call.args[1] as number;
        return typeof delay === 'number' && delay > 0 && delay <= 2000;
      });

      assert.ok(rateLimitCall, 'setTimeout should be called with a delay <= 2000ms for rate limiting');

      setTimeoutSpy.restore();
      await promise;
    });

    test('does not delay when enough time has passed', async () => {
      mockAxiosInstance.get.resolves({
        data: { status: 'OK', result: [] }
      });

      // Set lastRequestTime to well in the past
      (api as any).lastRequestTime = Date.now() - 5000;

      const setTimeoutSpy = sinon.spy(global, 'setTimeout');

      await api.getContestList();

      // No rate-limit setTimeout should have been called
      const rateLimitCall = setTimeoutSpy.getCalls().find(call => {
        const delay = call.args[1] as number;
        return typeof delay === 'number' && delay > 0 && delay <= 2000;
      });

      assert.ok(!rateLimitCall, 'setTimeout should not be called when enough time has passed');

      setTimeoutSpy.restore();
    });
  });

  suite('generateApiSig / authenticated requests', () => {
    test('throws when credentials are not set', async () => {
      // getUserFriends requires auth, but we haven't set credentials
      // The code checks requiresAuth && apiKey && apiSecret, so it won't call generateApiSig
      // but if we force it by calling the private method directly:
      assert.throws(
        () => (api as any).generateApiSig('/user.friends', {}),
        (err: Error) => {
          assert.ok(err.message.includes('API credentials not set'));
          return true;
        }
      );
    });

    test('authenticated request includes apiKey, time, and apiSig params', async () => {
      api.setCredentials('testApiKey', 'testApiSecret');

      mockAxiosInstance.get.resolves({
        data: { status: 'OK', result: ['friend1', 'friend2'] }
      });

      await api.getUserFriends();

      const callArgs = mockAxiosInstance.get.lastCall.args;
      assert.strictEqual(callArgs[0], '/user.friends');
      const params = callArgs[1].params;
      assert.strictEqual(params.apiKey, 'testApiKey');
      assert.ok(params.time, 'time parameter should be present');
      assert.ok(params.apiSig, 'apiSig parameter should be present');
      // apiSig is 6-char rand + 128-char hex sha512
      assert.ok(params.apiSig.length > 6, 'apiSig should have rand prefix + hash');
    });
  });

  suite('public methods call correct endpoints', () => {
    setup(() => {
      mockAxiosInstance.get.resolves({
        data: { status: 'OK', result: [] }
      });
    });

    test('getContestList calls /contest.list', async () => {
      await api.getContestList();
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/contest.list');
    });

    test('getContestList passes gym parameter', async () => {
      await api.getContestList(true);
      const params = mockAxiosInstance.get.lastCall.args[1].params;
      assert.strictEqual(params.gym, 'true');
    });

    test('getContestStandings calls /contest.standings', async () => {
      await api.getContestStandings(1234);
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/contest.standings');
      const params = mockAxiosInstance.get.lastCall.args[1].params;
      assert.strictEqual(params.contestId, '1234');
    });

    test('getContestStandings passes optional params', async () => {
      await api.getContestStandings(1, { from: 1, count: 5, handles: ['a', 'b'], showUnofficial: true });
      const params = mockAxiosInstance.get.lastCall.args[1].params;
      assert.strictEqual(params.from, '1');
      assert.strictEqual(params.count, '5');
      assert.strictEqual(params.handles, 'a;b');
      assert.strictEqual(params.showUnofficial, 'true');
    });

    test('getContestRatingChanges calls /contest.ratingChanges', async () => {
      await api.getContestRatingChanges(100);
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/contest.ratingChanges');
    });

    test('getContestHacks calls /contest.hacks', async () => {
      await api.getContestHacks(100);
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/contest.hacks');
    });

    test('getContestStatus calls /contest.status', async () => {
      await api.getContestStatus(100);
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/contest.status');
    });

    test('getProblemsetProblems calls /problemset.problems', async () => {
      await api.getProblemsetProblems();
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/problemset.problems');
    });

    test('getProblemsetProblems passes tags', async () => {
      await api.getProblemsetProblems({ tags: ['dp', 'greedy'] });
      const params = mockAxiosInstance.get.lastCall.args[1].params;
      assert.strictEqual(params.tags, 'dp;greedy');
    });

    test('getProblemsetRecentStatus calls /problemset.recentStatus', async () => {
      await api.getProblemsetRecentStatus(10);
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/problemset.recentStatus');
    });

    test('getUserInfo calls /user.info', async () => {
      await api.getUserInfo(['tourist']);
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/user.info');
      const params = mockAxiosInstance.get.lastCall.args[1].params;
      assert.strictEqual(params.handles, 'tourist');
    });

    test('getUserInfo joins multiple handles with semicolon', async () => {
      await api.getUserInfo(['tourist', 'Petr']);
      const params = mockAxiosInstance.get.lastCall.args[1].params;
      assert.strictEqual(params.handles, 'tourist;Petr');
    });

    test('getUserRating calls /user.rating', async () => {
      await api.getUserRating('tourist');
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/user.rating');
    });

    test('getUserStatus calls /user.status', async () => {
      await api.getUserStatus('tourist');
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/user.status');
    });

    test('getUserStatus passes optional from and count', async () => {
      await api.getUserStatus('tourist', { from: 1, count: 10 });
      const params = mockAxiosInstance.get.lastCall.args[1].params;
      assert.strictEqual(params.from, '1');
      assert.strictEqual(params.count, '10');
    });

    test('getUserRatedList calls /user.ratedList', async () => {
      await api.getUserRatedList();
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/user.ratedList');
    });

    test('getUserBlogEntries calls /user.blogEntries', async () => {
      await api.getUserBlogEntries('tourist');
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/user.blogEntries');
    });

    test('getUserFriends calls /user.friends with auth', async () => {
      api.setCredentials('key', 'secret');
      await api.getUserFriends();
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/user.friends');
    });

    test('getBlogEntryComments calls /blogEntry.comments', async () => {
      await api.getBlogEntryComments(42);
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/blogEntry.comments');
    });

    test('getBlogEntryView calls /blogEntry.view', async () => {
      await api.getBlogEntryView(42);
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/blogEntry.view');
    });

    test('getRecentActions calls /recentActions', async () => {
      await api.getRecentActions();
      assert.strictEqual(mockAxiosInstance.get.lastCall.args[0], '/recentActions');
    });
  });

  suite('429 rate limit retry', () => {
    test('retries on 429 status after waiting', async () => {
      const clock = sinon.useFakeTimers({ shouldAdvanceTime: false });

      try {
        const rateLimitErr = new MockAxiosError('Request failed with status code 429', { status: 429 });
        mockAxiosInstance.get
          .onFirstCall().rejects(rateLimitErr)
          .onSecondCall().resolves({ data: { status: 'OK', result: [] } });

        const promise = api.getContestList();

        // Advance past the 5s retry wait plus rateLimit waits
        await clock.tickAsync(10000);
        const result = await promise;

        assert.deepStrictEqual(result, []);
        assert.strictEqual(mockAxiosInstance.get.callCount, 2);
      } finally {
        clock.restore();
      }
    });
  });
});

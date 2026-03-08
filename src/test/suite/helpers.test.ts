import * as assert from 'assert';
import * as sinon from 'sinon';
import * as os from 'os';
import * as path from 'path';
import { expandPath, formatTime, formatMemory, sanitizeFilename, getVerdictEmoji, debounce, throttle } from '../../utils/helpers';

suite('helpers', () => {

  suite('expandPath', () => {
    test('replaces ~ with home directory', () => {
      const result = expandPath('~/projects/foo');
      assert.strictEqual(result, path.join(os.homedir(), 'projects/foo'));
    });

    test('replaces ~ alone', () => {
      const result = expandPath('~');
      assert.strictEqual(result, path.join(os.homedir()));
    });

    test('returns absolute path as-is', () => {
      assert.strictEqual(expandPath('/usr/local/bin'), '/usr/local/bin');
    });

    test('returns relative path as-is', () => {
      assert.strictEqual(expandPath('foo/bar'), 'foo/bar');
    });
  });

  suite('formatTime', () => {
    test('seconds only', () => {
      assert.strictEqual(formatTime(45), '45s');
    });

    test('zero seconds', () => {
      assert.strictEqual(formatTime(0), '0s');
    });

    test('minutes and seconds', () => {
      assert.strictEqual(formatTime(125), '2m 5s');
    });

    test('exact minutes', () => {
      assert.strictEqual(formatTime(60), '1m 0s');
    });

    test('hours, minutes, and seconds', () => {
      assert.strictEqual(formatTime(3661), '1h 1m 1s');
    });

    test('exact hours', () => {
      assert.strictEqual(formatTime(7200), '2h 0m 0s');
    });
  });

  suite('formatMemory', () => {
    test('bytes', () => {
      assert.strictEqual(formatMemory(500), '500 B');
    });

    test('zero bytes', () => {
      assert.strictEqual(formatMemory(0), '0 B');
    });

    test('kilobytes', () => {
      assert.strictEqual(formatMemory(2048), '2 KB');
    });

    test('kilobytes with rounding', () => {
      assert.strictEqual(formatMemory(1536), '2 KB');
    });

    test('megabytes', () => {
      assert.strictEqual(formatMemory(1048576), '1 MB');
    });

    test('megabytes with rounding', () => {
      assert.strictEqual(formatMemory(5 * 1024 * 1024 + 512 * 1024), '6 MB');
    });

    test('boundary: 1023 bytes stays in B', () => {
      assert.strictEqual(formatMemory(1023), '1023 B');
    });

    test('boundary: 1024 bytes becomes KB', () => {
      assert.strictEqual(formatMemory(1024), '1 KB');
    });
  });

  suite('sanitizeFilename', () => {
    test('strips forbidden characters', () => {
      assert.strictEqual(sanitizeFilename('a<b>c:d"e/f\\g|h?i*j'), 'abcdefghij');
    });

    test('replaces spaces with underscores', () => {
      assert.strictEqual(sanitizeFilename('hello world'), 'hello_world');
    });

    test('replaces multiple spaces with single underscore', () => {
      assert.strictEqual(sanitizeFilename('a   b'), 'a_b');
    });

    test('truncates to 100 characters', () => {
      const long = 'a'.repeat(150);
      assert.strictEqual(sanitizeFilename(long).length, 100);
    });

    test('handles combined cases', () => {
      assert.strictEqual(sanitizeFilename('My File: <test>'), 'My_File_test');
    });
  });

  suite('getVerdictEmoji', () => {
    test('OK', () => {
      assert.strictEqual(getVerdictEmoji('OK'), '✅');
    });

    test('WRONG_ANSWER', () => {
      assert.strictEqual(getVerdictEmoji('WRONG_ANSWER'), '❌');
    });

    test('TIME_LIMIT_EXCEEDED', () => {
      assert.strictEqual(getVerdictEmoji('TIME_LIMIT_EXCEEDED'), '⏰');
    });

    test('MEMORY_LIMIT_EXCEEDED', () => {
      assert.strictEqual(getVerdictEmoji('MEMORY_LIMIT_EXCEEDED'), '💾');
    });

    test('RUNTIME_ERROR', () => {
      assert.strictEqual(getVerdictEmoji('RUNTIME_ERROR'), '💥');
    });

    test('COMPILATION_ERROR', () => {
      assert.strictEqual(getVerdictEmoji('COMPILATION_ERROR'), '🔧');
    });

    test('TESTING', () => {
      assert.strictEqual(getVerdictEmoji('TESTING'), '⏳');
    });

    test('unknown verdict returns question mark', () => {
      assert.strictEqual(getVerdictEmoji('SOMETHING_ELSE'), '❓');
    });

    test('undefined returns question mark', () => {
      assert.strictEqual(getVerdictEmoji(undefined), '❓');
    });
  });

  suite('debounce', () => {
    let clock: sinon.SinonFakeTimers;

    setup(() => {
      clock = sinon.useFakeTimers();
    });

    teardown(() => {
      clock.restore();
    });

    test('calls function after wait period', () => {
      const spy = sinon.spy();
      const debounced = debounce(spy, 100);

      debounced();
      assert.strictEqual(spy.callCount, 0);

      clock.tick(100);
      assert.strictEqual(spy.callCount, 1);
    });

    test('resets timer on subsequent calls', () => {
      const spy = sinon.spy();
      const debounced = debounce(spy, 100);

      debounced();
      clock.tick(50);
      debounced();
      clock.tick(50);
      assert.strictEqual(spy.callCount, 0);

      clock.tick(50);
      assert.strictEqual(spy.callCount, 1);
    });

    test('uses arguments from last call', () => {
      const spy = sinon.spy();
      const debounced = debounce(spy, 100);

      debounced('first');
      debounced('second');

      clock.tick(100);
      assert.strictEqual(spy.callCount, 1);
      assert.strictEqual(spy.firstCall.args[0], 'second');
    });
  });

  suite('throttle', () => {
    let clock: sinon.SinonFakeTimers;

    setup(() => {
      clock = sinon.useFakeTimers();
    });

    teardown(() => {
      clock.restore();
    });

    test('calls function immediately on first call', () => {
      const spy = sinon.spy();
      const throttled = throttle(spy, 100);

      throttled();
      assert.strictEqual(spy.callCount, 1);
    });

    test('ignores calls during throttle period', () => {
      const spy = sinon.spy();
      const throttled = throttle(spy, 100);

      throttled();
      throttled();
      throttled();

      assert.strictEqual(spy.callCount, 1);
    });

    test('allows call after throttle period expires', () => {
      const spy = sinon.spy();
      const throttled = throttle(spy, 100);

      throttled();
      assert.strictEqual(spy.callCount, 1);

      clock.tick(100);

      throttled();
      assert.strictEqual(spy.callCount, 2);
    });

    test('passes arguments to the function', () => {
      const spy = sinon.spy();
      const throttled = throttle(spy, 100);

      throttled('arg1', 'arg2');
      assert.strictEqual(spy.firstCall.args[0], 'arg1');
      assert.strictEqual(spy.firstCall.args[1], 'arg2');
    });
  });
});

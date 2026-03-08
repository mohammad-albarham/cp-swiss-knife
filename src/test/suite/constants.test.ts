import * as assert from 'assert';
import { RATING_RANGES, PROBLEM_TAGS, CACHE_TTL } from '../../utils/constants';

suite('constants', () => {

  suite('RATING_RANGES', () => {
    test('is non-empty', () => {
      assert.ok(RATING_RANGES.length > 0);
    });

    test('each entry has min < max', () => {
      for (const range of RATING_RANGES) {
        assert.ok(range.min < range.max,
          `Expected min (${range.min}) < max (${range.max}) for range "${range.label}"`);
      }
    });

    test('each entry has a label', () => {
      for (const range of RATING_RANGES) {
        assert.ok(typeof range.label === 'string' && range.label.length > 0,
          `Expected non-empty label for range ${range.min}-${range.max}`);
      }
    });

    test('each entry has a color', () => {
      for (const range of RATING_RANGES) {
        assert.ok(typeof range.color === 'string' && range.color.length > 0,
          `Expected non-empty color for range "${range.label}"`);
      }
    });

    test('ranges are contiguous (each max equals next min)', () => {
      for (let i = 0; i < RATING_RANGES.length - 1; i++) {
        assert.strictEqual(RATING_RANGES[i].max, RATING_RANGES[i + 1].min,
          `Expected range ${i} max (${RATING_RANGES[i].max}) to equal range ${i + 1} min (${RATING_RANGES[i + 1].min})`);
      }
    });

    test('no duplicate ranges', () => {
      const labels = RATING_RANGES.map(r => r.label);
      const unique = new Set(labels);
      assert.strictEqual(labels.length, unique.size, 'Expected no duplicate labels');
    });
  });

  suite('PROBLEM_TAGS', () => {
    test('is non-empty', () => {
      assert.ok(PROBLEM_TAGS.length > 0);
    });

    test('no duplicate tags', () => {
      const unique = new Set(PROBLEM_TAGS);
      assert.strictEqual(PROBLEM_TAGS.length, unique.size, 'Expected no duplicate tags');
    });

    test('all tags are lowercase', () => {
      for (const tag of PROBLEM_TAGS) {
        assert.strictEqual(tag, tag.toLowerCase(),
          `Expected tag "${tag}" to be lowercase`);
      }
    });

    test('all tags are non-empty strings', () => {
      for (const tag of PROBLEM_TAGS) {
        assert.ok(typeof tag === 'string' && tag.length > 0,
          'Expected non-empty string tag');
      }
    });
  });

  suite('CACHE_TTL', () => {
    test('PROBLEMS is a positive number', () => {
      assert.ok(typeof CACHE_TTL.PROBLEMS === 'number' && CACHE_TTL.PROBLEMS > 0);
    });

    test('CONTESTS is a positive number', () => {
      assert.ok(typeof CACHE_TTL.CONTESTS === 'number' && CACHE_TTL.CONTESTS > 0);
    });

    test('USER is a positive number', () => {
      assert.ok(typeof CACHE_TTL.USER === 'number' && CACHE_TTL.USER > 0);
    });

    test('SUBMISSIONS is a positive number', () => {
      assert.ok(typeof CACHE_TTL.SUBMISSIONS === 'number' && CACHE_TTL.SUBMISSIONS > 0);
    });

    test('PROBLEMS TTL is longer than SUBMISSIONS TTL', () => {
      assert.ok(CACHE_TTL.PROBLEMS > CACHE_TTL.SUBMISSIONS,
        'Expected PROBLEMS TTL to be longer than SUBMISSIONS TTL');
    });
  });
});

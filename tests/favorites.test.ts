import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FAVORITES_KEY, normalizeFavorites, readFavorites, saveFavorites} from '../src/utils/favorites';

test('favorites reject malformed IDs, duplicates and oversized collections', () => {
  assert.deepEqual(normalizeFavorites(null), []);
  assert.deepEqual(normalizeFavorites(['one', 'one', '', ' ', 12, {}, 'x'.repeat(129), 'two']), ['one', 'two']);
  assert.equal(normalizeFavorites(Array.from({length: 300}, (_, i) => String(i))).length, 200);
});
test('favorites persist only IDs and tolerate corrupt or unavailable storage', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let stored: string | null = null;
  try {
    Object.defineProperty(globalThis, 'window', {configurable: true, value: {localStorage: {
      getItem: (key: string) => {assert.equal(key, FAVORITES_KEY); return stored;},
      setItem: (key: string, value: string) => {assert.equal(key, FAVORITES_KEY); stored = value;}
    }}});
    assert.equal(saveFavorites(['one', 'two', 'one']), true);
    assert.deepEqual(readFavorites(), ['one', 'two']);
    stored = 'broken'; assert.deepEqual(readFavorites(), []);
    Object.defineProperty(globalThis, 'window', {configurable: true, value: {get localStorage() {throw new Error('Blocked');}}});
    assert.deepEqual(readFavorites(), []);
    assert.equal(saveFavorites(['one']), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

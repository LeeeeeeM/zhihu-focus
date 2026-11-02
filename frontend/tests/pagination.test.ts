import assert from 'node:assert/strict';
import test from 'node:test';
import { contentKey, mergeUnique, nextPageState } from '../src/services/pagination';
import { displayTime } from '../src/services/time';

test('shared pagination deduplicates first and appended pages by content identity', () => {
  const answer = { kind: 'answer', id: '1' }, article = { kind: 'article', id: '1' };
  const first = mergeUnique([], [answer, answer, article], contentKey);
  assert.equal(first.items.length, 2);
  const next = mergeUnique(first.items, [answer, { kind: 'answer', id: '2' }], contentKey);
  assert.equal(next.items.length, 3);
  assert.equal(next.freshCount, 1);
  assert.deepEqual(nextPageState('next', true, 'next'), { cursor: '', hasMore: false });
  assert.deepEqual(nextPageState(undefined, true), { cursor: '', hasMore: false });
  assert.deepEqual(nextPageState('next', false), { cursor: '', hasMore: false });
});

test('timestamps keep their timezone and preserve legacy display strings', () => {
  const instant = '2026-11-02T08:00:00Z';
  assert.equal(displayTime(instant), new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(instant)));
  assert.equal(displayTime('2026-11-02 16:00'), '2026-11-02 16:00');
  assert.equal(displayTime(), '');
});

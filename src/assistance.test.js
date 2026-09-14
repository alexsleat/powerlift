// Tests for the three optional assistance fields. The window allocation and the
// progression trigger are the parts with real edge cases, so they're covered
// here rather than discovered in a gym.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { repRangeOf, targetRepsOf, timingOf, planInterleave, progressionSuggestion } from './assistance.js';

const entry = (over = {}) => ({
  exercise_id: 'ex_ez_bar_curl', sets: 4, reps: 12, rep_range: [10, 12],
  timing: 'between_supplemental_sets',
  progression: { trigger: 'top_of_range_all_sets', consecutive_sessions: 2, increment_kg: 1.25 },
  ...over,
});

// ── rep_range ─────────────────────────────────────────────────────────────────

test('a valid band is read, an invalid one is ignored', () => {
  assert.deepEqual(repRangeOf(entry()), [10, 12]);
  assert.equal(repRangeOf({ reps: 12 }), null);
  assert.equal(repRangeOf({ rep_range: [12, 10] }), null, 'max below min');
  assert.equal(repRangeOf({ rep_range: [10] }), null);
  assert.equal(repRangeOf({ rep_range: '10-12' }), null);
  assert.equal(repRangeOf({ rep_range: [0, 12] }), null);
});

test('timed work never has a band', () => {
  assert.equal(repRangeOf({ rep_range: [45, 60], reps_is_seconds: 60 }), null);
  assert.equal(targetRepsOf({ reps_is_seconds: 60 }), 60);
});

test('the band wins over a disagreeing reps value', () => {
  assert.equal(targetRepsOf(entry({ reps: 99 })), 12);
  assert.equal(targetRepsOf({ reps: 15 }), 15, 'no band: reps is the target');
});

// ── timing ────────────────────────────────────────────────────────────────────

test('timing falls back to after_main when unknown or unusable', () => {
  assert.equal(timingOf(entry(), { hasSupplemental: true }), 'between_supplemental_sets');
  assert.equal(timingOf(entry(), { hasSupplemental: false }), 'after_main', 'nothing to interleave into');
  assert.equal(timingOf({ timing: 'during_the_drive_home' }, { hasSupplemental: true }), 'after_main');
  assert.equal(timingOf({}, { hasSupplemental: true }), 'after_main');
  assert.equal(timingOf({ timing: 'warmup' }, { hasSupplemental: true }), 'warmup');
});

// ── interleaving ──────────────────────────────────────────────────────────────

const plan = (assistSets, suppSets = 5, timing = 'between_supplemental_sets') => ([
  { exercise_id: 'ex_ohp', role: 'main', sets: [{ isWarmup: true }, {}, {}, {}] },
  { exercise_id: 'ex_ohp', role: 'supplemental', sets: Array.from({ length: suppSets }, () => ({})) },
  { exercise_id: 'ex_ez_bar_curl', role: 'assistance', timing, sets: Array.from({ length: assistSets }, () => ({})) },
]);

test('assistance sets are front-loaded into the supplemental rest windows', () => {
  const ex = planInterleave(plan(4, 5));
  assert.deepEqual(ex[1].interleavedAfter, {
    0: [{ exIdx: 2, setIdx: 0 }],
    1: [{ exIdx: 2, setIdx: 1 }],
    2: [{ exIdx: 2, setIdx: 2 }],
    3: [{ exIdx: 2, setIdx: 3 }],
  }, 'five FSL sets and four curl sets means curls in rests 1-4');
  assert.equal(ex[2].interleavedInto, 1);
  assert.deepEqual(ex[2].interleavedSets, [0, 1, 2, 3]);
});

test('sets beyond the available windows stay after the main work', () => {
  const ex = planInterleave(plan(6, 3));
  assert.equal(Object.keys(ex[1].interleavedAfter).length, 3);
  assert.deepEqual(ex[2].interleavedSets, [0, 1, 2], 'the last three are not interleaved');
});

test('two interleaved movements never share a rest window', () => {
  const ex = planInterleave([
    ...plan(2, 5),
    { exercise_id: 'ex_ab_wheel', role: 'assistance', timing: 'between_supplemental_sets', sets: [{}, {}] },
  ]);
  assert.deepEqual(ex[1].interleavedAfter[0], [{ exIdx: 2, setIdx: 0 }]);
  assert.deepEqual(ex[1].interleavedAfter[1], [{ exIdx: 2, setIdx: 1 }]);
  assert.deepEqual(ex[1].interleavedAfter[2], [{ exIdx: 3, setIdx: 0 }]);
  assert.deepEqual(ex[1].interleavedAfter[3], [{ exIdx: 3, setIdx: 1 }]);
});

test('nothing is interleaved without a supplemental block or without the flag', () => {
  const noSupp = planInterleave([plan(4)[0], plan(4)[2]]);
  assert.ok(!noSupp.some(e => e.interleavedAfter || e.interleavedSets));
  const plain = planInterleave(plan(4, 5, 'after_main'));
  assert.equal(plain[1].interleavedAfter, undefined);
});

// ── progression ───────────────────────────────────────────────────────────────

const sess = (reps, weight = 20, id = 'ex_ez_bar_curl') => ({
  exercises_performed: [{
    exercise_id: id,
    set_results: reps.map(r => ({ reps_completed: r, weight_kg: weight, is_warmup: false })),
  }],
});

test('suggests the increment after N consecutive sessions at the top of the band', () => {
  const s = progressionSuggestion({
    entry: entry(), exerciseId: 'ex_ez_bar_curl', currentWeightKg: 20,
    sessions: [sess([12, 12, 12, 12]), sess([12, 12, 12, 12])],
  });
  assert.deepEqual(s, { fromKg: 20, toKg: 21.25, incrementKg: 1.25, sessions: 2, trigger: 'top_of_range_all_sets' });
});

test('no suggestion until the streak is long enough', () => {
  assert.equal(progressionSuggestion({
    entry: entry(), exerciseId: 'ex_ez_bar_curl', currentWeightKg: 20,
    sessions: [sess([12, 12, 12, 12]), sess([11, 12, 12, 12])],
  }), null, 'one set short of the top breaks it');

  assert.equal(progressionSuggestion({
    entry: entry(), exerciseId: 'ex_ez_bar_curl', currentWeightKg: 20,
    sessions: [sess([12, 12, 12, 12])],
  }), null, 'only one qualifying session on record');
});

test('adding weight resets the streak', () => {
  assert.equal(progressionSuggestion({
    entry: entry(), exerciseId: 'ex_ez_bar_curl', currentWeightKg: 21.25,
    sessions: [sess([12, 12, 12, 12], 20), sess([12, 12, 12, 12], 21.25)],
  }), null, 'the two sessions were at different loads');
});

test('nothing is suggested once the weight is already up', () => {
  assert.equal(progressionSuggestion({
    entry: entry(), exerciseId: 'ex_ez_bar_curl', currentWeightKg: 22.5,
    sessions: [sess([12, 12, 12, 12]), sess([12, 12, 12, 12])],
  }), null);
});

test('first-set trigger ignores the drop-off on later sets', () => {
  const e = entry({ progression: { trigger: 'top_of_range_first_set', consecutive_sessions: 2, increment_kg: 2.5 } });
  const s = progressionSuggestion({
    entry: e, exerciseId: 'ex_ez_bar_curl', currentWeightKg: 20,
    sessions: [sess([12, 9, 8, 8]), sess([12, 10, 9, 8])],
  });
  assert.equal(s.toKg, 22.5);
});

test('bodyweight movements (increment 0) and unknown triggers suggest nothing', () => {
  const done = [sess([12, 12, 12, 12]), sess([12, 12, 12, 12])];
  const base = { exerciseId: 'ex_ez_bar_curl', currentWeightKg: 20, sessions: done };
  assert.equal(progressionSuggestion({ ...base, entry: entry({ progression: { trigger: 'top_of_range_all_sets', consecutive_sessions: 2, increment_kg: 0 } }) }), null);
  assert.equal(progressionSuggestion({ ...base, entry: entry({ progression: { trigger: 'vibes', consecutive_sessions: 2, increment_kg: 2.5 } }) }), null);
  assert.equal(progressionSuggestion({ ...base, entry: entry({ rep_range: undefined }) }), null, 'progression needs a band');
  assert.equal(progressionSuggestion({ ...base, entry: { exercise_id: 'ex_ez_bar_curl', reps: 12 } }), null);
});

test('sessions without the movement are skipped, not counted as failures', () => {
  const s = progressionSuggestion({
    entry: entry(), exerciseId: 'ex_ez_bar_curl', currentWeightKg: 20,
    sessions: [sess([12, 12, 12, 12]), sess([5, 5], 100, 'ex_squat'), sess([12, 12, 12, 12])],
  });
  assert.equal(s.toKg, 21.25);
});

test('unlogged sets block the suggestion', () => {
  assert.equal(progressionSuggestion({
    entry: entry(), exerciseId: 'ex_ez_bar_curl', currentWeightKg: 20,
    sessions: [sess([12, 12, 12, 12]), sess([12, 12, 0, 0])],
  }), null, 'two sets never logged is not a completed session');
});

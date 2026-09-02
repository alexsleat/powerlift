// Regression tests for the write path: what a schema change turns into on the
// wire, and how the outbox coalesces. Run with `npm test` (node's built-in
// runner — no dependencies). These matter because a wrong diff means a change
// that never reaches the server, which is exactly the class of bug this
// replaced.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diffSchemaOps } from './schemaOps.js';
import { enqueue, outboxCount, discardOutbox } from './sync.js';

const kinds = ops => ops.map(o => o.kind).sort().join(',');

const inst = {
  id: 'pi_1', template_id: '531_fsl', status: 'active',
  current_cycle: 1, current_week: 1, current_day: 1,
  training_maxes: [{ exercise_id: 'ex_squat', tm_kg: 120 }],
};
const s1 = {
  id: 'session_2026-08-01_1', date: '2026-08-01', programme_instance_id: 'pi_1',
  exercises_performed: [{ exercise_id: 'ex_squat', set_results: [{ reps_completed: 5, weight_kg: 100 }] }],
};
const base = {
  user_profile: { units: 'kg', name: 'Alex' },
  lift_maxes: [{ exercise_id: 'ex_squat', one_rm_kg: 140 }],
  e1rm_log: [{ exercise_id: 'ex_squat', session_id: s1.id, e1rm_kg: 116 }],
  programme_instances: [inst],
  workout_sessions: [s1],
  custom_exercises: [],
  programme_templates: [{ id: '531_fsl' }],
};

test('an unchanged schema sends nothing', () => {
  assert.equal(diffSchemaOps(base, { ...base }).length, 0);
});

test('server-owned templates never produce ops', () => {
  assert.equal(diffSchemaOps(base, { ...base, programme_templates: [{ id: 'other' }] }).length, 0);
});

test('completing a session sends one op carrying its e1RM rows and the advanced programme', () => {
  const s2 = {
    id: 'session_2026-08-04_2', date: '2026-08-04', programme_instance_id: 'pi_1',
    exercises_performed: [{ exercise_id: 'ex_bench', set_results: [{ reps_completed: 5, weight_kg: 80 }] }],
  };
  const ops = diffSchemaOps(base, {
    ...base,
    workout_sessions: [...base.workout_sessions, s2],
    e1rm_log: [...base.e1rm_log, { exercise_id: 'ex_bench', session_id: s2.id, e1rm_kg: 93 }],
    programme_instances: [{ ...inst, current_day: 2 }],
  });

  assert.equal(ops.length, 1, 'one request per completed session');
  assert.equal(ops[0].kind, 'session.put');
  assert.equal(ops[0].id, s2.id);
  // Folded in so the server applies session + position in one transaction.
  assert.equal(ops[0].payload.instance.current_day, 2);
  // Only this session's derived rows travel with it.
  assert.deepEqual(ops[0].payload.e1rm_log.map(e => e.session_id), [s2.id]);
});

test('untouched history produces no ops however long it is', () => {
  const sessions = Array.from({ length: 500 }, (_, i) => ({ id: `s_${i}`, date: '2026-01-01' }));
  const prev = { ...base, workout_sessions: sessions };
  const next = { ...prev, workout_sessions: [...sessions] };   // new array, same objects
  assert.equal(diffSchemaOps(prev, next).length, 0);
});

test('editing a past session sends only that session', () => {
  const edited = { ...s1, exercises_performed: [{ exercise_id: 'ex_squat', set_results: [{ reps_completed: 8, weight_kg: 100 }] }] };
  const ops = diffSchemaOps(base, { ...base, workout_sessions: [edited] });
  assert.equal(ops.length, 1);
  assert.equal(ops[0].kind, 'session.put');
  assert.equal(ops[0].payload.session.exercises_performed[0].set_results[0].reps_completed, 8);
});

test('deleting a session sends a delete, not a rewrite', () => {
  const ops = diffSchemaOps(base, { ...base, workout_sessions: [], e1rm_log: [] });
  assert.equal(kinds(ops), 'session.delete');
  assert.equal(ops[0].id, s1.id);
});

test('each kind of change maps to its own endpoint', () => {
  assert.equal(kinds(diffSchemaOps(base, { ...base, user_profile: { ...base.user_profile, units: 'lb' } })), 'profile.patch');
  assert.equal(kinds(diffSchemaOps(base, { ...base, lift_maxes: [{ exercise_id: 'ex_squat', one_rm_kg: 145 }] })), 'liftmax.put');
  assert.equal(kinds(diffSchemaOps(base, { ...base, lift_maxes: [] })), 'liftmax.delete');
  assert.equal(kinds(diffSchemaOps(base, { ...base, custom_exercises: [{ id: 'ex_mine' }] })), 'customex.put');
  assert.equal(kinds(diffSchemaOps(base, { ...base, programme_instances: [{ ...inst, status: 'archived' }] })), 'instance.put');
  assert.equal(kinds(diffSchemaOps(base, { ...base, programme_instances: [] })), 'instance.delete');
});

test('a TM update alone is one small instance op', () => {
  const ops = diffSchemaOps(base, { ...base, programme_instances: [{ ...inst, training_maxes: [{ exercise_id: 'ex_squat', tm_kg: 125 }] }] });
  assert.equal(kinds(ops), 'instance.put');
  assert.equal(ops[0].payload.training_maxes[0].tm_kg, 125);
});

test('an instance is only folded into a session when it is unambiguous', () => {
  const s2 = { id: 's_2', date: '2026-08-04', programme_instance_id: 'pi_1' };
  const edited = { ...s1, notes: 'changed' };
  const ops = diffSchemaOps(base, {
    ...base, workout_sessions: [edited, s2], programme_instances: [{ ...inst, current_day: 2 }],
  });
  assert.equal(kinds(ops), 'instance.put,session.put,session.put');
  assert.ok(!ops.find(o => o.kind === 'session.put').payload.instance);
});

test('bulk changes fall back to one whole-schema replace', () => {
  const many = { ...base, workout_sessions: Array.from({ length: 40 }, (_, i) => ({ id: `s_${i}`, date: '2026-01-01' })) };
  assert.equal(kinds(diffSchemaOps(base, many)), 'schema.put');
  assert.equal(kinds(diffSchemaOps(null, base)), 'schema.put');   // no baseline to diff
});

test('the outbox coalesces by entity and a restore clears it', () => {
  // owner is null here, so nothing is sent — this exercises queueing only.
  discardOutbox();
  enqueue({ kind: 'session.put', key: 'session:a', id: 'a', payload: { session: { id: 'a' } } });
  enqueue({ kind: 'session.put', key: 'session:a', id: 'a', payload: { session: { id: 'a', v: 2 } } });
  assert.equal(outboxCount(), 1, 'a second edit replaces the pending op');

  enqueue({ kind: 'profile.patch', key: 'profile', payload: {} });
  assert.equal(outboxCount(), 2);

  enqueue({ kind: 'session.delete', key: 'session:a', id: 'a' });
  assert.equal(outboxCount(), 2, 'delete supersedes the pending save for the same entity');

  enqueue({ kind: 'schema.put', key: 'schema', payload: base });
  assert.equal(outboxCount(), 1, 'a whole-schema replace supersedes everything');
  discardOutbox();
});

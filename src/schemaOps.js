// ─── SCHEMA → WRITE OPS ───────────────────────────────────────────────────────
// The app keeps the whole schema in one piece of React state, which is convenient
// to read and hopeless to save: shipping the entire document on every change is
// what made saves grow with history and let one failed request lose a workout.
//
// So rather than rewriting every mutation site, the single update path diffs the
// new schema against the old and emits one small op per entity that actually
// changed. Unchanged entities keep their object identity through React's spread
// updates, so the common case is a handful of reference comparisons.
//
// Bulk changes (Restore, raw JSON edit) legitimately replace everything: past a
// threshold this gives up and emits one whole-schema replace, which is what that
// endpoint is for.

const BULK_THRESHOLD = 25;

// Templates are server-owned and ignored by the write endpoints; don't ship them.
function withoutTemplates(schema) {
  if (!schema || !('programme_templates' in schema)) return schema;
  const { programme_templates, ...rest } = schema;
  return rest;
}

function indexBy(list, key) {
  const map = new Map();
  for (const item of (list || [])) map.set(item?.[key], item);
  return map;
}

// Identity first (cheap, catches everything React didn't touch), then value.
function unchanged(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffSchemaOps(prev, next) {
  if (!next) return [];
  const bulk = [{ kind: 'schema.put', key: 'schema', payload: withoutTemplates(next) }];
  if (!prev) return bulk;   // no baseline to diff against

  const ops = [];

  if (!unchanged(prev.user_profile, next.user_profile))
    ops.push({ kind: 'profile.patch', key: 'profile', payload: next.user_profile || {} });

  if (!unchanged(prev.custom_exercises, next.custom_exercises))
    ops.push({ kind: 'customex.put', key: 'customex', payload: next.custom_exercises || [] });

  // ── Lift maxes (keyed by exercise) ──────────────────────────────────────────
  const prevMaxes = indexBy(prev.lift_maxes, 'exercise_id');
  const nextMaxes = indexBy(next.lift_maxes, 'exercise_id');
  for (const [exId, max] of nextMaxes) {
    if (!unchanged(prevMaxes.get(exId), max)) ops.push({ kind: 'liftmax.put', key: `liftmax:${exId}`, id: exId, payload: max });
  }
  for (const exId of prevMaxes.keys()) {
    if (!nextMaxes.has(exId)) ops.push({ kind: 'liftmax.delete', key: `liftmax:${exId}`, id: exId });
  }

  // ── Programme instances ─────────────────────────────────────────────────────
  const prevInsts = indexBy(prev.programme_instances, 'id');
  const nextInsts = indexBy(next.programme_instances, 'id');
  const changedInsts = [];
  for (const [id, inst] of nextInsts) {
    if (!unchanged(prevInsts.get(id), inst)) changedInsts.push(inst);
  }
  for (const id of prevInsts.keys()) {
    if (!nextInsts.has(id)) ops.push({ kind: 'instance.delete', key: `instance:${id}`, id });
  }

  // ── Sessions (carry their own derived e1RM rows) ─────────────────────────────
  const prevSessions = indexBy(prev.workout_sessions, 'id');
  const nextSessions = indexBy(next.workout_sessions, 'id');
  const changedSessions = [];
  for (const [id, session] of nextSessions) {
    if (!unchanged(prevSessions.get(id), session)) changedSessions.push(session);
  }
  for (const id of prevSessions.keys()) {
    if (!nextSessions.has(id)) ops.push({ kind: 'session.delete', key: `session:${id}`, id });
  }

  // Finishing a session changes the session and advances the programme in one
  // move; when that's what happened, send them together so the server applies
  // both in one transaction.
  const foldInstance = changedSessions.length === 1 && changedInsts.length === 1
    && changedSessions[0].programme_instance_id === changedInsts[0].id
    ? changedInsts[0]
    : null;

  for (const session of changedSessions) {
    ops.push({
      kind: 'session.put',
      key:  `session:${session.id}`,
      id:   session.id,
      payload: {
        session,
        e1rm_log: (next.e1rm_log || []).filter(e => e.session_id === session.id),
        ...(foldInstance && session.id === changedSessions[0].id ? { instance: foldInstance } : {}),
      },
    });
  }

  for (const inst of changedInsts) {
    if (foldInstance && inst.id === foldInstance.id) continue;   // already folded above
    ops.push({ kind: 'instance.put', key: `instance:${inst.id}`, id: inst.id, payload: inst });
  }

  return ops.length > BULK_THRESHOLD ? bulk : ops;
}

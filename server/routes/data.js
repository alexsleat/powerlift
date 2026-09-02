const express     = require('express');
const db          = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Reject a whole-schema sync if any submitted id already belongs to another
// user. Guards against cross-tenant overwrites (IDOR) and id squatting on the
// global TEXT primary keys of programme_instances / workout_sessions.
function assertOwnership(table, ids, userId) {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT id, user_id FROM ${table} WHERE id IN (${placeholders})`).all(...ids);
  for (const r of rows) {
    if (r.user_id !== userId) {
      const e = new Error(`Ownership conflict on ${table} id ${r.id}`);
      e.status = 409;
      throw e;
    }
  }
}

// ── Shared validation for the incremental write endpoints ─────────────────────
// Each endpoint takes one entity, so these are cheap per-request checks rather
// than a sweep over the whole document.
const TYPED_PROFILE_KEYS = ['id', 'name', 'units', 'bodyweight_kg', 'rest_defaults_seconds'];
const DEFAULT_REST = { main: 180, supplemental: 150, assistance: 90 };

function bad(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

// Per-entity ceilings. The whole-schema PUT capped rows per request; with one
// entity per request those limits have to live here instead, or "small requests"
// becomes an unbounded row count.
const MAX_SESSIONS_PER_USER  = 20000;
const MAX_INSTANCES_PER_USER = 500;
const MAX_ENTITY_BYTES       = 200000;

function assertSession(s, id) {
  if (!s || typeof s !== 'object')            throw bad('session must be an object');
  if (typeof s.id !== 'string' || !s.id)      throw bad('session.id required');
  if (s.id.length > 200)                      throw bad('session.id too long');
  if (id != null && s.id !== id)              throw bad('session.id must match the URL');
  if (typeof s.date !== 'string' || !s.date)  throw bad('session.date required');
  const exs = s.exercises_performed;
  if (exs != null && !Array.isArray(exs))     throw bad('session.exercises_performed must be an array');
  if ((exs || []).length > 60)                throw bad('session has too many exercises');
  for (const ex of (exs || [])) {
    if (!Array.isArray(ex.set_results ?? [])) throw bad('set_results must be an array');
    if ((ex.set_results || []).length > 100)  throw bad('exercise has too many sets');
  }
  if (JSON.stringify(s).length > MAX_ENTITY_BYTES) throw bad('session too large');
}

// Only new rows can grow the table, so check the count on insert, not update.
function assertRoomFor(table, id, userId, max, what) {
  const existing = db.prepare(`SELECT 1 AS x FROM ${table} WHERE id = ? AND user_id = ?`).get(id, userId);
  if (existing) return;
  const { c } = db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE user_id = ?`).get(userId);
  if (c >= max) throw bad(`${what} limit reached (${max})`);
}

function assertE1rmRows(rows, sessionId) {
  if (rows == null) return [];
  if (!Array.isArray(rows)) throw bad('e1rm_log must be an array');
  if (rows.length > 200)    throw bad('e1rm_log too large for one session');
  for (const e of rows) {
    if (typeof e.exercise_id !== 'string' || !e.exercise_id) throw bad('e1rm_log.exercise_id required');
    if (typeof e.e1rm_kg !== 'number' || !Number.isFinite(e.e1rm_kg) || e.e1rm_kg <= 0 || e.e1rm_kg > 600)
      throw bad('e1rm_log.e1rm_kg must be between 0 and 600');
    if (e.session_id != null && e.session_id !== sessionId) throw bad('e1rm_log.session_id must match the session');
  }
  return rows;
}

function assertInstance(inst, id) {
  if (!inst || typeof inst !== 'object')             throw bad('instance must be an object');
  if (typeof inst.id !== 'string' || !inst.id)       throw bad('instance.id required');
  if (inst.id.length > 200)                          throw bad('instance.id too long');
  if (id != null && inst.id !== id)                  throw bad('instance.id must match the URL');
  if (typeof inst.template_id !== 'string' || !inst.template_id) throw bad('instance.template_id required');
  if (JSON.stringify(inst).length > MAX_ENTITY_BYTES) throw bad('instance too large');
}

// A session's date lives in its id (session_YYYY-MM-DD_ts); fall back to the row.
function e1rmDate(entry, session) {
  return (entry.session_id || '').split('_')[1] || entry.date || session?.date || '';
}

const upsertSessionRow = () => db.prepare(`
  INSERT INTO workout_sessions (id, user_id, programme_instance_id, date, data)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    programme_instance_id = excluded.programme_instance_id,
    date = excluded.date,
    data = excluded.data
  WHERE workout_sessions.user_id = excluded.user_id
`);

const upsertInstanceRow = () => db.prepare(`
  INSERT INTO programme_instances (id, user_id, template_id, status, data, started_date, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    status = excluded.status,
    data = excluded.data,
    updated_at = excluded.updated_at
  WHERE programme_instances.user_id = excluded.user_id
`);

const insertE1rmRow = () => db.prepare(`
  INSERT INTO e1rm_log (user_id, exercise_id, session_id, e1rm_kg, weight_kg, reps_completed, formula_used, date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Typed columns plus everything else as a prefs blob, so client-side settings
// stop disappearing on reload.
function writeProfile(userId, p) {
  const prefs = {};
  for (const [k, v] of Object.entries(p || {})) {
    if (!TYPED_PROFILE_KEYS.includes(k)) prefs[k] = v;
  }
  db.prepare(`
    INSERT INTO user_profile (user_id, name, units, bodyweight_kg, rest_defaults_seconds, prefs, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      name = excluded.name,
      units = excluded.units,
      bodyweight_kg = excluded.bodyweight_kg,
      rest_defaults_seconds = excluded.rest_defaults_seconds,
      prefs = excluded.prefs,
      updated_at = excluded.updated_at
  `).run(
    userId,
    p.name ?? '',
    p.units ?? 'kg',
    Number.isFinite(p.bodyweight_kg) ? p.bodyweight_kg : null,
    JSON.stringify(p.rest_defaults_seconds ?? { ...DEFAULT_REST }),
    JSON.stringify(prefs)
  );
}

// Wraps a handler so thrown errors with .status become clean responses.
function handle(fn) {
  return (req, res) => {
    try {
      fn(req, res);
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      if (err.status === 409) {
        console.warn('Ownership conflict:', err.message);
        return res.status(409).json({ error: 'Ownership conflict — that record belongs to another account' });
      }
      console.error('Data write error:', err);
      res.status(500).json({ error: 'Failed to save' });
    }
  };
}

// Whole-schema sync is authoritative: any of this user's rows whose id is not
// in the submitted set has been deleted client-side, so remove it server-side.
function deleteAbsent(table, keepIds, userId, keyCol = 'id') {
  if (keepIds.length) {
    const placeholders = keepIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND ${keyCol} NOT IN (${placeholders})`).run(userId, ...keepIds);
  } else {
    db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
  }
}

// ── GET /api/data/schema ──────────────────────────────────────────────────────
// Assembles the full rootSchema for the authenticated user.
router.get('/schema', (req, res) => {
  const userId = parseInt(req.user.sub, 10);

  const profile  = db.prepare('SELECT * FROM user_profile WHERE user_id = ?').get(userId);
  const maxes    = db.prepare('SELECT exercise_id, one_rm_kg, tested_date, method FROM lift_maxes WHERE user_id = ?').all(userId);
  const e1rm     = db.prepare('SELECT exercise_id, session_id, e1rm_kg, weight_kg, reps_completed, formula_used FROM e1rm_log WHERE user_id = ? ORDER BY date ASC').all(userId);
  const insts    = db.prepare('SELECT data FROM programme_instances WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
  const sessions = db.prepare('SELECT data FROM workout_sessions WHERE user_id = ? ORDER BY date ASC, created_at ASC').all(userId);
  const customEx = db.prepare('SELECT data FROM custom_exercises WHERE user_id = ?').get(userId);

  const restDefs = profile?.rest_defaults_seconds
    ? JSON.parse(profile.rest_defaults_seconds)
    : { ...DEFAULT_REST };

  // Untyped profile settings (theme, rep_ranges, history-strip prefs) ride in
  // the prefs blob; spread them first so the typed columns stay authoritative.
  let prefs = {};
  try { prefs = profile?.prefs ? JSON.parse(profile.prefs) : {}; } catch { prefs = {}; }

  res.json({
    schema_version:      '1.1.0',
    custom_exercises:    customEx ? JSON.parse(customEx.data) : [],
    user_profile: {
      ...prefs,
      id:                    String(userId),
      name:                  profile?.name ?? '',
      units:                 profile?.units ?? 'kg',
      bodyweight_kg:         profile?.bodyweight_kg ?? null,
      rest_defaults_seconds: restDefs,
    },
    lift_maxes:          maxes,
    e1rm_log:            e1rm,
    programme_instances: insts.map(r => JSON.parse(r.data)),
    workout_sessions:    sessions.map(r => JSON.parse(r.data)),
  });
});

// ── PUT /api/data/schema ──────────────────────────────────────────────────────
// Syncs the full rootSchema to the database (normalised storage).
router.put('/schema', (req, res) => {
  const userId = parseInt(req.user.sub, 10);
  const schema = req.body;
  if (!schema || typeof schema !== 'object')
    return res.status(400).json({ error: 'Request body must be a JSON object' });

  // ── Structural validation (A3) ────────────────────────────────────────────
  // Reject malformed rows up front: undefined/NaN values would otherwise make
  // better-sqlite3 throw mid-transaction (500), and unbounded arrays/weights
  // enable storage abuse and poison stats.
  const MAX_ROWS = 5000;
  try {
    for (const k of ['lift_maxes', 'e1rm_log', 'programme_instances', 'workout_sessions', 'custom_exercises']) {
      if (schema[k] == null) continue;
      if (!Array.isArray(schema[k])) throw new Error(`${k} must be an array`);
      if (schema[k].length > MAX_ROWS) throw new Error(`${k} exceeds ${MAX_ROWS} rows`);
    }
    for (const lm of (schema.lift_maxes || [])) {
      if (typeof lm.exercise_id !== 'string' || !lm.exercise_id) throw new Error('lift_maxes.exercise_id required');
      if (typeof lm.one_rm_kg !== 'number' || !Number.isFinite(lm.one_rm_kg) || lm.one_rm_kg <= 0 || lm.one_rm_kg > 600)
        throw new Error('lift_maxes.one_rm_kg must be between 0 and 600');
    }
    for (const e of (schema.e1rm_log || [])) {
      if (typeof e.exercise_id !== 'string' || !e.exercise_id) throw new Error('e1rm_log.exercise_id required');
      if (typeof e.e1rm_kg !== 'number' || !Number.isFinite(e.e1rm_kg) || e.e1rm_kg <= 0 || e.e1rm_kg > 600)
        throw new Error('e1rm_log.e1rm_kg must be between 0 and 600');
    }
    for (const inst of (schema.programme_instances || [])) {
      if (typeof inst.id !== 'string' || !inst.id) throw new Error('programme_instances.id required');
    }
    for (const s of (schema.workout_sessions || [])) {
      if (typeof s.id !== 'string' || !s.id) throw new Error('workout_sessions.id required');
      if (typeof s.date !== 'string' || !s.date) throw new Error('workout_sessions.date required');
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    db.transaction(() => {
      // ── Profile ────────────────────────────────────────────────────────────
      writeProfile(userId, schema.user_profile || {});

      // ── Lift maxes (upsert by exercise) ────────────────────────────────────
      const upsertMax = db.prepare(`
        INSERT INTO lift_maxes (user_id, exercise_id, one_rm_kg, tested_date, method, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id, exercise_id) DO UPDATE SET
          one_rm_kg = excluded.one_rm_kg,
          tested_date = excluded.tested_date,
          method = excluded.method,
          updated_at = excluded.updated_at
      `);
      for (const lm of (schema.lift_maxes || [])) {
        upsertMax.run(userId, lm.exercise_id, lm.one_rm_kg, lm.tested_date ?? null, lm.method ?? null);
      }
      // Remove maxes the client dropped (keyed by exercise_id, not id).
      deleteAbsent('lift_maxes', (schema.lift_maxes || []).map(m => m.exercise_id), userId, 'exercise_id');

      // ── e1rm_log (clear + reinsert — entries are immutable once computed) ──
      db.prepare('DELETE FROM e1rm_log WHERE user_id = ?').run(userId);
      const insertE1rm = db.prepare(`
        INSERT INTO e1rm_log (user_id, exercise_id, session_id, e1rm_kg, weight_kg, reps_completed, formula_used, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const e of (schema.e1rm_log || [])) {
        const date = (e.session_id || '').split('_')[1] || e.date || '';
        insertE1rm.run(userId, e.exercise_id, e.session_id ?? null, e.e1rm_kg, e.weight_kg ?? null, e.reps_completed ?? null, e.formula_used ?? null, date);
      }

      // ── Programme instances (ownership-checked upsert + reconcile) ─────────
      const instIds = (schema.programme_instances || []).map(i => i.id);
      assertOwnership('programme_instances', instIds, userId);
      const upsertInst = db.prepare(`
        INSERT INTO programme_instances (id, user_id, template_id, status, data, started_date, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          data = excluded.data,
          updated_at = excluded.updated_at
        WHERE programme_instances.user_id = excluded.user_id
      `);
      for (const inst of (schema.programme_instances || [])) {
        upsertInst.run(inst.id, userId, inst.template_id, inst.status, JSON.stringify(inst), inst.started_date);
      }
      deleteAbsent('programme_instances', instIds, userId);

      // ── Workout sessions (ownership-checked upsert + reconcile) ────────────
      // Upsert (not INSERT OR IGNORE) so session edits persist; reconcile so
      // client-side deletions propagate instead of resurrecting on reload.
      const sessionIds = (schema.workout_sessions || []).map(s => s.id);
      assertOwnership('workout_sessions', sessionIds, userId);
      const upsertSession = db.prepare(`
        INSERT INTO workout_sessions (id, user_id, programme_instance_id, date, data)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          programme_instance_id = excluded.programme_instance_id,
          date = excluded.date,
          data = excluded.data
        WHERE workout_sessions.user_id = excluded.user_id
      `);
      for (const s of (schema.workout_sessions || [])) {
        upsertSession.run(s.id, userId, s.programme_instance_id ?? null, s.date, JSON.stringify(s));
      }
      deleteAbsent('workout_sessions', sessionIds, userId);

      // ── Custom exercises (replace) ─────────────────────────────────────────
      db.prepare(`
        INSERT INTO custom_exercises (user_id, data) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET data = excluded.data
      `).run(userId, JSON.stringify(schema.custom_exercises || []));
    })();

    res.json({ ok: true });
  } catch (err) {
    if (err.status === 409) {
      console.warn('Schema sync ownership conflict:', err.message);
      return res.status(409).json({ error: 'Ownership conflict — some records belong to another account' });
    }
    console.error('Schema sync error:', err);
    res.status(500).json({ error: 'Failed to save schema' });
  }
});

// ─── INCREMENTAL WRITES ───────────────────────────────────────────────────────
// One entity per request. Bounded payload regardless of how much history exists,
// no reconcile-delete, and a failure is confined to the one thing that failed —
// unlike PUT /schema, which rewrites and prunes everything on every save.

// ── PUT /api/data/sessions/:id ────────────────────────────────────────────────
// Body: { session, e1rm_log?, instance? }. Applied in one transaction because a
// completed session, its estimated-1RM rows and the programme's new position are
// one logical event.
router.put('/sessions/:id', handle((req, res) => {
  const userId  = parseInt(req.user.sub, 10);
  const { session, e1rm_log, instance } = req.body || {};
  assertSession(session, req.params.id);
  const rows = assertE1rmRows(e1rm_log, session.id);
  if (instance != null) assertInstance(instance, null);

  db.transaction(() => {
    assertOwnership('workout_sessions', [session.id], userId);
    assertRoomFor('workout_sessions', session.id, userId, MAX_SESSIONS_PER_USER, 'Session');
    upsertSessionRow().run(session.id, userId, session.programme_instance_id ?? null, session.date, JSON.stringify(session));

    // This session's e1RM rows are derived data — replace them wholesale so an
    // edited session can't leave stale PRs behind.
    db.prepare('DELETE FROM e1rm_log WHERE user_id = ? AND session_id = ?').run(userId, session.id);
    const insert = insertE1rmRow();
    for (const e of rows) {
      insert.run(userId, e.exercise_id, session.id, e.e1rm_kg, e.weight_kg ?? null, e.reps_completed ?? null, e.formula_used ?? null, e1rmDate(e, session));
    }

    if (instance) {
      assertOwnership('programme_instances', [instance.id], userId);
      assertRoomFor('programme_instances', instance.id, userId, MAX_INSTANCES_PER_USER, 'Programme');
      upsertInstanceRow().run(instance.id, userId, instance.template_id, instance.status ?? 'active', JSON.stringify(instance), instance.started_date ?? null);
    }
  })();

  res.json({ ok: true });
}));

// ── DELETE /api/data/sessions/:id ─────────────────────────────────────────────
router.delete('/sessions/:id', handle((req, res) => {
  const userId = parseInt(req.user.sub, 10);
  const id     = req.params.id;
  const row = db.prepare('SELECT user_id FROM workout_sessions WHERE id = ?').get(id);
  // Already gone is a success: DELETE has to be idempotent for a retried op.
  if (!row) return res.json({ ok: true, deleted: 0 });
  if (row.user_id !== userId) return res.status(409).json({ error: 'Ownership conflict' });

  db.transaction(() => {
    db.prepare('DELETE FROM e1rm_log WHERE user_id = ? AND session_id = ?').run(userId, id);
    db.prepare('DELETE FROM workout_sessions WHERE user_id = ? AND id = ?').run(userId, id);
  })();

  res.json({ ok: true, deleted: 1 });
}));

// ── PUT /api/data/instances/:id ───────────────────────────────────────────────
// Programme start, position advance, TM update, archive — all one small upsert.
router.put('/instances/:id', handle((req, res) => {
  const userId = parseInt(req.user.sub, 10);
  const inst   = req.body;
  assertInstance(inst, req.params.id);

  db.transaction(() => {
    assertOwnership('programme_instances', [inst.id], userId);
    assertRoomFor('programme_instances', inst.id, userId, MAX_INSTANCES_PER_USER, 'Programme');
    upsertInstanceRow().run(inst.id, userId, inst.template_id, inst.status ?? 'active', JSON.stringify(inst), inst.started_date ?? null);
  })();

  res.json({ ok: true });
}));

// ── DELETE /api/data/instances/:id ────────────────────────────────────────────
router.delete('/instances/:id', handle((req, res) => {
  const userId = parseInt(req.user.sub, 10);
  const row = db.prepare('SELECT user_id FROM programme_instances WHERE id = ?').get(req.params.id);
  if (!row) return res.json({ ok: true, deleted: 0 });
  if (row.user_id !== userId) return res.status(409).json({ error: 'Ownership conflict' });
  db.prepare('DELETE FROM programme_instances WHERE user_id = ? AND id = ?').run(userId, req.params.id);
  res.json({ ok: true, deleted: 1 });
}));

// ── PATCH /api/data/profile ───────────────────────────────────────────────────
// Body: the full user_profile object (it's tiny). Typed fields go to columns,
// anything else to the prefs blob.
router.patch('/profile', handle((req, res) => {
  const userId = parseInt(req.user.sub, 10);
  const p = req.body;
  if (!p || typeof p !== 'object') throw bad('profile must be an object');
  if (p.units != null && !['kg', 'lb'].includes(p.units)) throw bad('units must be kg or lb');
  if (p.name != null && (typeof p.name !== 'string' || p.name.length > 100)) throw bad('name too long');
  if (p.bodyweight_kg != null && (typeof p.bodyweight_kg !== 'number' || !Number.isFinite(p.bodyweight_kg) || p.bodyweight_kg <= 0 || p.bodyweight_kg > 500))
    throw bad('bodyweight_kg must be between 0 and 500');
  if (JSON.stringify(p).length > 20000) throw bad('profile too large');
  writeProfile(userId, p);
  res.json({ ok: true });
}));

// ── PUT / DELETE /api/data/lift-maxes/:exerciseId ──────────────────────────────
router.put('/lift-maxes/:exerciseId', handle((req, res) => {
  const userId = parseInt(req.user.sub, 10);
  const m = req.body || {};
  if (typeof m.one_rm_kg !== 'number' || !Number.isFinite(m.one_rm_kg) || m.one_rm_kg <= 0 || m.one_rm_kg > 600)
    throw bad('one_rm_kg must be between 0 and 600');
  db.prepare(`
    INSERT INTO lift_maxes (user_id, exercise_id, one_rm_kg, tested_date, method, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, exercise_id) DO UPDATE SET
      one_rm_kg = excluded.one_rm_kg,
      tested_date = excluded.tested_date,
      method = excluded.method,
      updated_at = excluded.updated_at
  `).run(userId, req.params.exerciseId, m.one_rm_kg, m.tested_date ?? null, m.method ?? null);
  res.json({ ok: true });
}));

router.delete('/lift-maxes/:exerciseId', handle((req, res) => {
  const userId = parseInt(req.user.sub, 10);
  db.prepare('DELETE FROM lift_maxes WHERE user_id = ? AND exercise_id = ?').run(userId, req.params.exerciseId);
  res.json({ ok: true });
}));

// ── PUT /api/data/custom-exercises ────────────────────────────────────────────
// Stored as one blob per user, so this replaces the list.
router.put('/custom-exercises', handle((req, res) => {
  const userId = parseInt(req.user.sub, 10);
  const list = req.body;
  if (!Array.isArray(list)) throw bad('custom_exercises must be an array');
  if (list.length > 2000)   throw bad('too many custom exercises');
  db.prepare(`
    INSERT INTO custom_exercises (user_id, data) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data
  `).run(userId, JSON.stringify(list));
  res.json({ ok: true });
}));

// ── GET /api/data/exercises ───────────────────────────────────────────────────
// Returns the user's saved exercise library, topped up with any built-ins it is
// missing, or the global seeded library when the user has no saved copy.
router.get('/exercises', (req, res) => {
  const userId   = parseInt(req.user.sub, 10);
  const rows     = db.prepare('SELECT data FROM exercises ORDER BY rowid').all();
  const globalEx = rows.map(r => JSON.parse(r.data));
  const userLib  = db.prepare('SELECT data FROM user_exlib WHERE user_id = ?').get(userId);
  if (!userLib) return res.json({ exercises: globalEx });

  // A saved library shadows the global one, so new built-ins would otherwise be
  // invisible to anyone who has ever edited their library or restored a backup.
  // Union in the built-ins their copy lacks; their own entries always win.
  const lib = JSON.parse(userLib.data);
  if (!Array.isArray(lib.exercises)) return res.json(lib);
  const have    = new Set(lib.exercises.map(e => e.id));
  const missing = globalEx.filter(e => !have.has(e.id));
  res.json(missing.length ? { ...lib, exercises: [...lib.exercises, ...missing] } : lib);
});

// ── PUT /api/data/exlib ───────────────────────────────────────────────────────
// Saves a user-specific exercise library override.
router.put('/exlib', (req, res) => {
  const userId = parseInt(req.user.sub, 10);
  const lib = req.body;
  if (!lib || typeof lib !== 'object')
    return res.status(400).json({ error: 'Request body must be a JSON object' });

  db.prepare(`
    INSERT INTO user_exlib (user_id, data) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data
  `).run(userId, JSON.stringify(lib));

  res.json({ ok: true });
});

// ── GET /api/data/templates ───────────────────────────────────────────────────
router.get('/templates', (_req, res) => {
  const rows = db.prepare('SELECT data FROM templates ORDER BY rowid').all();
  res.json(rows.map(r => JSON.parse(r.data)));
});

// ── GET /api/data/export ──────────────────────────────────────────────────────
// Returns a full JSON backup for the authenticated user.
router.get('/export', (req, res) => {
  const userId = parseInt(req.user.sub, 10);

  // Re-use the schema GET logic
  const profile  = db.prepare('SELECT * FROM user_profile WHERE user_id = ?').get(userId);
  const maxes    = db.prepare('SELECT exercise_id, one_rm_kg, tested_date, method FROM lift_maxes WHERE user_id = ?').all(userId);
  const e1rm     = db.prepare('SELECT exercise_id, session_id, e1rm_kg, weight_kg, reps_completed, formula_used FROM e1rm_log WHERE user_id = ? ORDER BY date ASC').all(userId);
  const insts    = db.prepare('SELECT data FROM programme_instances WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
  const sessions = db.prepare('SELECT data FROM workout_sessions WHERE user_id = ? ORDER BY date ASC').all(userId);
  const customEx = db.prepare('SELECT data FROM custom_exercises WHERE user_id = ?').get(userId);
  const userLib  = db.prepare('SELECT data FROM user_exlib WHERE user_id = ?').get(userId);
  const globalEx = db.prepare('SELECT data FROM exercises ORDER BY rowid').all();

  const schema = {
    schema_version:      '1.1.0',
    custom_exercises:    customEx ? JSON.parse(customEx.data) : [],
    user_profile: {
      id:                    String(userId),
      name:                  profile?.name ?? '',
      units:                 profile?.units ?? 'kg',
      bodyweight_kg:         profile?.bodyweight_kg ?? null,
      rest_defaults_seconds: profile?.rest_defaults_seconds ? JSON.parse(profile.rest_defaults_seconds) : { main: 180, supplemental: 150, assistance: 90 },
    },
    lift_maxes:          maxes,
    e1rm_log:            e1rm,
    programme_instances: insts.map(r => JSON.parse(r.data)),
    workout_sessions:    sessions.map(r => JSON.parse(r.data)),
  };

  const exLib = userLib
    ? JSON.parse(userLib.data)
    : { exercises: globalEx.map(r => JSON.parse(r.data)) };

  res.json({
    powerlift_backup: true,
    version:          '1.1.0',
    backup_date:      new Date().toISOString().split('T')[0],
    schema,
    exLib,
  });
});

module.exports = router;

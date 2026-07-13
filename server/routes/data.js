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
    : { main: 180, supplemental: 150, assistance: 90 };

  res.json({
    schema_version:      '1.1.0',
    custom_exercises:    customEx ? JSON.parse(customEx.data) : [],
    user_profile: {
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
      const p = schema.user_profile || {};
      db.prepare(`
        INSERT INTO user_profile (user_id, name, units, bodyweight_kg, rest_defaults_seconds, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          name = excluded.name,
          units = excluded.units,
          bodyweight_kg = excluded.bodyweight_kg,
          rest_defaults_seconds = excluded.rest_defaults_seconds,
          updated_at = excluded.updated_at
      `).run(
        userId,
        p.name ?? '',
        p.units ?? 'kg',
        p.bodyweight_kg ?? null,
        JSON.stringify(p.rest_defaults_seconds ?? { main: 180, supplemental: 150, assistance: 90 })
      );

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

// ── GET /api/data/exercises ───────────────────────────────────────────────────
// Returns the user's saved exercise library, or the global seeded one.
router.get('/exercises', (req, res) => {
  const userId = parseInt(req.user.sub, 10);
  const userLib = db.prepare('SELECT data FROM user_exlib WHERE user_id = ?').get(userId);
  if (userLib) return res.json(JSON.parse(userLib.data));

  const rows = db.prepare('SELECT data FROM exercises ORDER BY rowid').all();
  res.json({ exercises: rows.map(r => JSON.parse(r.data)) });
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

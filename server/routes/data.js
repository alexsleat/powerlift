const express     = require('express');
const db          = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

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

      // ── Programme instances (upsert) ────────────────────────────────────────
      const upsertInst = db.prepare(`
        INSERT INTO programme_instances (id, user_id, template_id, status, data, started_date, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          data = excluded.data,
          updated_at = excluded.updated_at
      `);
      for (const inst of (schema.programme_instances || [])) {
        upsertInst.run(inst.id, userId, inst.template_id, inst.status, JSON.stringify(inst), inst.started_date);
      }

      // ── Workout sessions (insert-only — sessions never change after save) ──
      const insertSession = db.prepare(`
        INSERT OR IGNORE INTO workout_sessions (id, user_id, programme_instance_id, date, data)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const s of (schema.workout_sessions || [])) {
        insertSession.run(s.id, userId, s.programme_instance_id ?? null, s.date, JSON.stringify(s));
      }

      // ── Custom exercises (replace) ─────────────────────────────────────────
      db.prepare(`
        INSERT INTO custom_exercises (user_id, data) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET data = excluded.data
      `).run(userId, JSON.stringify(schema.custom_exercises || []));
    })();

    res.json({ ok: true });
  } catch (err) {
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

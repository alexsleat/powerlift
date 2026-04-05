const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'powerlift.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_profile (
    user_id               INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL DEFAULT '',
    units                 TEXT NOT NULL DEFAULT 'kg',
    bodyweight_kg         REAL,
    rest_defaults_seconds TEXT NOT NULL DEFAULT '{"main":180,"supplemental":150,"assistance":90}',
    updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lift_maxes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL,
    one_rm_kg   REAL NOT NULL,
    tested_date TEXT,
    method      TEXT,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, exercise_id)
  );

  CREATE TABLE IF NOT EXISTS e1rm_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id    TEXT NOT NULL,
    session_id     TEXT,
    e1rm_kg        REAL NOT NULL,
    weight_kg      REAL,
    reps_completed INTEGER,
    formula_used   TEXT,
    date           TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS programme_instances (
    id           TEXT PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id  TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'active',
    data         TEXT NOT NULL,
    started_date TEXT NOT NULL,
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS workout_sessions (
    id                    TEXT PRIMARY KEY,
    user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    programme_instance_id TEXT,
    date                  TEXT NOT NULL,
    data                  TEXT NOT NULL,
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS custom_exercises (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data    TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS user_exlib (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id   TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS templates (
    id   TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
`);

function seedIfNeeded() {
  const count = db.prepare('SELECT COUNT(*) as c FROM exercises').get().c;
  if (count > 0) return;

  const exPath = path.join(__dirname, '..', 'public', 'data', 'exercise.json');
  const tmPath = path.join(__dirname, '..', 'public', 'data', 'templates.json');

  if (fs.existsSync(exPath)) {
    const exercises = JSON.parse(fs.readFileSync(exPath, 'utf8')).exercises || [];
    const insert = db.prepare('INSERT OR IGNORE INTO exercises (id, data) VALUES (?, ?)');
    db.transaction(() => { for (const ex of exercises) insert.run(ex.id, JSON.stringify(ex)); })();
    console.log(`Seeded ${exercises.length} exercises`);
  }

  if (fs.existsSync(tmPath)) {
    const templates = JSON.parse(fs.readFileSync(tmPath, 'utf8'));
    const insert = db.prepare('INSERT OR IGNORE INTO templates (id, data) VALUES (?, ?)');
    db.transaction(() => { for (const t of templates) insert.run(t.id, JSON.stringify(t)); })();
    console.log(`Seeded ${templates.length} templates`);
  }
}

seedIfNeeded();

module.exports = db;

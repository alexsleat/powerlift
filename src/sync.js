// ─── SCHEMA SYNC QUEUE ────────────────────────────────────────────────────────
// The schema PUT is a whole-document, last-write-wins upsert, so only the newest
// snapshot ever matters. Every change is mirrored to localStorage first, then
// pushed; a failed push is retried with backoff (and on reconnect / tab focus)
// until the server confirms it. Previously the PUT was fire-and-forget: a
// dropped request left the change in memory only, so completing a session and
// then reloading silently reverted to the server's older copy.

import { api } from './api.js';

const PENDING_KEY = 'pl-pending-schema';
const MAX_BACKOFF = 60000;

let pending  = null;    // newest snapshot the server has not confirmed
let inFlight = false;
let attempt  = 0;
let timer    = null;
let lastError = null;
let lastSyncedAt = null;

const listeners = new Set();

function state() {
  return {
    // 'idle' — server has everything; 'saving' — push in progress;
    // 'retrying' — push failed, queued for another attempt; 'offline' — waiting
    // for the connection to come back.
    status: !pending ? 'idle'
          : inFlight ? 'saving'
          : isOffline() ? 'offline'
          : attempt > 0 ? 'retrying' : 'saving',
    attempt, lastError, lastSyncedAt, hasPending: !!pending,
  };
}

function emit() { const s = state(); for (const fn of listeners) fn(s); }

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

// The mirror is stamped with the account it belongs to: on a shared device, one
// user's unsynced work must never be recovered into another's session.
let owner = null;

export function setSyncOwner(id) { owner = id ?? null; }

function persist(schema) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ savedAt: Date.now(), owner, schema }));
  } catch {
    // Quota exceeded — the in-memory queue still retries, we just lose the
    // across-reload safety net for this change.
  }
}

// { savedAt, owner, schema } written by the last unconfirmed change, or null.
// Returns null for another account's snapshot (left in place for when they
// log back in).
export function readPendingSchema() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const val = raw ? JSON.parse(raw) : null;
    if (!val?.schema) return null;
    if (String(val.owner ?? "") !== String(owner ?? "")) return null;
    return val;
  } catch { return null; }
}

// Cheap semantic fingerprint used to decide whether a recovered snapshot is
// actually newer than the server's copy — a push whose *response* was lost still
// landed, and re-announcing it every load would be noise. Key order differs
// between our snapshot and the server's rebuilt JSON, so raw string comparison
// is useless; this covers the collections that carry work, including per-session
// contents so an edit to an existing session is still detected as a difference.
export function schemaSignature(s) {
  const sessions = (s?.workout_sessions || []).map(w => {
    let sets = 0, reps = 0;
    for (const ex of (w.exercises_performed || []))
      for (const r of (ex.set_results || [])) { sets++; reps += Number(r.reps_completed) || 0; }
    return `${w.id}:${sets}:${reps}:${(w.notes || "").length}:${w.duration_minutes ?? ""}`;
  }).sort().join(',');
  const instances = (s?.programme_instances || []).map(i =>
    `${i.id}:${i.status}:${i.current_cycle}.${i.current_week}.${i.current_day}:${i.current_cycle_role}:${i.current_macrocycle_block}:${i.needs_tm_review ? 1 : 0}:${(i.training_maxes || []).map(t => `${t.exercise_id}=${t.tm_kg}`).join('/')}:${(i.working_weights || []).map(t => `${t.exercise_id}=${t.weight_kg}`).join('/')}`
  ).sort().join(',');
  return [
    sessions, instances,
    (s?.e1rm_log || []).length,
    (s?.lift_maxes || []).map(m => `${m.exercise_id}=${m.one_rm_kg}`).sort().join('/'),
    (s?.custom_exercises || []).length,
    JSON.stringify(s?.user_profile ?? null),
  ].join('|');
}

export function clearPendingSchema() {
  pending = null;
  attempt = 0;
  lastError = null;
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
  emit();
}

export function subscribeSync(fn) {
  listeners.add(fn);
  fn(state());
  return () => listeners.delete(fn);
}

// programme_templates is read-only server data that the client merges into the
// schema at load; PUT /data/schema ignores it, so keep it out of the payload and
// out of the localStorage mirror (it's re-attached on recovery).
function stripTemplates(schema) {
  if (!schema || !('programme_templates' in schema)) return schema;
  const { programme_templates, ...rest } = schema;
  return rest;
}

// Queue a schema snapshot for the server. Safe to call on every change — later
// calls simply replace the pending snapshot rather than piling up requests.
export function queueSchema(schema) {
  pending = stripTemplates(schema);
  persist(pending);
  emit();
  flushSchema();
  return pending;
}

export async function flushSchema() {
  if (inFlight || !pending) return;
  // Logged out: keep the snapshot mirrored (stamped with its owner) and wait for
  // that account to sign back in rather than looping on 401s.
  if (owner === null) { emit(); return; }
  if (isOffline()) { emit(); schedule(15000); return; }

  const snapshot = pending;
  inFlight = true;
  emit();
  try {
    await api.data.putSchema(snapshot);
    lastSyncedAt = Date.now();
    inFlight = false;
    // Only clear if nothing newer arrived while this was in flight.
    if (pending === snapshot) clearPendingSchema();
    else { attempt = 0; lastError = null; emit(); flushSchema(); }
  } catch (err) {
    inFlight = false;
    attempt += 1;
    lastError = err?.message || String(err);
    emit();
    schedule();
  }
}

function schedule(delayOverride) {
  if (timer || !pending) return;
  const delay = delayOverride ?? Math.min(1000 * 2 ** Math.min(attempt, 6), MAX_BACKOFF);
  timer = setTimeout(() => { timer = null; flushSchema(); }, delay);
}

if (typeof window !== 'undefined') {
  // Reconnect / refocus are the moments a stuck push is most likely to succeed,
  // so reset the backoff and try immediately rather than waiting it out.
  window.addEventListener('online', () => { attempt = 0; flushSchema(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { attempt = 0; flushSchema(); } });
  window.addEventListener('beforeunload', (e) => {
    if (!pending) return;
    // Unsaved work is mirrored to localStorage and recovered on next load, but
    // warn anyway — closing now means it isn't on the server yet.
    e.preventDefault();
    e.returnValue = '';
  });
}

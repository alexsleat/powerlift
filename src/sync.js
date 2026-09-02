// ─── OFFLINE CACHE + WRITE OUTBOX ─────────────────────────────────────────────
// Two separate jobs, deliberately kept apart:
//
//   1. Cache — the last known-good schema (plus exercise library and templates)
//      mirrored to localStorage so the app opens and works with no connection.
//      Read-only safety net; never the mechanism for saving.
//
//   2. Outbox — an append-only queue of small, idempotent write ops (one session,
//      one instance, the profile…) flushed FIFO with retry and backoff. Each op
//      is a bounded request that either lands or is retried, so saving no longer
//      depends on shipping the entire document and can't be broken by history
//      size. Ops are keyed, so re-editing the same entity replaces its pending
//      op rather than queueing another.
//
// Ops that can never succeed (validation, ownership conflict) are moved to a
// dead-letter list instead of blocking everything behind them, and surfaced in
// Settings → Sync rather than failing silently.

import { api } from './api.js';

const CACHE_KEY  = 'pl-schema-cache';
const STATIC_KEY = 'pl-static-cache';
const OUTBOX_KEY = 'pl-outbox';
const FAILED_KEY = 'pl-outbox-failed';
const MAX_BACKOFF = 60000;

let outbox   = [];
let failed   = [];
let inFlight = false;
let attempt  = 0;
let timer    = null;
let lastError    = null;
let lastSyncedAt = null;
let owner    = null;
// Set if the server doesn't have the incremental routes (older build): every op
// then degrades to a whole-schema PUT so a deploy skew can't lose writes.
let incrementalUnsupported = false;

const listeners = new Set();

// ── Persistence helpers ───────────────────────────────────────────────────────

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify({ owner, savedAt: Date.now(), value })); return true; }
  catch { return false; }   // quota — in-memory queue still retries
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    const box = raw ? JSON.parse(raw) : null;
    if (!box || box.value == null) return null;
    if (String(box.owner ?? "") !== String(owner ?? "")) return null;  // another account's data
    return box;
  } catch { return null; }
}

export function setSyncOwner(id) {
  owner  = id ?? null;
  outbox = read(OUTBOX_KEY)?.value ?? [];
  failed = read(FAILED_KEY)?.value ?? [];
  emit();
}

// ── Cache ─────────────────────────────────────────────────────────────────────

// programme_templates is server-owned read-only data merged into the schema at
// load; it lives in the static cache, not in every schema snapshot.
function stripTemplates(schema) {
  if (!schema || !('programme_templates' in schema)) return schema;
  const { programme_templates, ...rest } = schema;
  return rest;
}

export function cacheSchema(schema) { write(CACHE_KEY, stripTemplates(schema)); }
export function readCachedSchema()  { return read(CACHE_KEY); }        // { savedAt, value } | null

export function cacheStatic(exLib, templates) { write(STATIC_KEY, { exLib, templates }); }
export function readCachedStatic() { return read(STATIC_KEY)?.value ?? null; }

// ── Outbox ────────────────────────────────────────────────────────────────────

function persistOutbox() { write(OUTBOX_KEY, outbox); }
function persistFailed()  { write(FAILED_KEY, failed); }

function state() {
  return {
    status: failed.length ? 'failed'
          : !outbox.length ? 'idle'
          : inFlight ? 'saving'
          : isOffline() ? 'offline'
          : attempt > 0 ? 'retrying' : 'saving',
    pending: outbox.length,
    failed:  failed.length,
    firstFailure: failed[0] ?? null,
    attempt, lastError, lastSyncedAt,
  };
}

function emit() { const s = state(); for (const fn of listeners) fn(s); }

export function subscribeSync(fn) {
  listeners.add(fn);
  fn(state());
  return () => listeners.delete(fn);
}

function isOffline() { return typeof navigator !== 'undefined' && navigator.onLine === false; }

// One entity per op. `key` is the coalescing identity: a newer op for the same
// entity replaces the pending one in place, which keeps the queue small and
// stops stale intermediate states being replayed.
export function enqueue(op) {
  if (!op?.kind || !op?.key) return;

  // Deploy-skew fallback: no incremental routes server-side, so send everything
  // as a whole-schema replace instead (the cache is the full document). exlib has
  // its own long-standing endpoint and is never part of the schema, so it's exempt.
  if (incrementalUnsupported && op.kind !== 'schema.put' && op.kind !== 'exlib.put') {
    const cached = readCachedSchema()?.value;
    if (cached) return enqueue({ kind: 'schema.put', key: 'schema', payload: cached });
    return;
  }

  // A whole-schema replace (restore / raw JSON edit) supersedes everything.
  if (op.kind === 'schema.put') outbox = [];

  const entry = { ...op, queuedAt: Date.now(), tries: 0 };
  const at = outbox.findIndex(o => o.key === op.key);
  if (at >= 0) outbox[at] = { ...entry, queuedAt: outbox[at].queuedAt };
  else outbox.push(entry);

  persistOutbox();
  emit();
  flushOutbox();
}

function send(op) {
  switch (op.kind) {
    case 'session.put':     return api.data.putSession(op.id, op.payload);
    case 'session.delete':  return api.data.deleteSession(op.id);
    case 'instance.put':    return api.data.putInstance(op.id, op.payload);
    case 'instance.delete': return api.data.deleteInstance(op.id);
    case 'profile.patch':   return api.data.patchProfile(op.payload);
    case 'liftmax.put':     return api.data.putLiftMax(op.id, op.payload);
    case 'liftmax.delete':  return api.data.deleteLiftMax(op.id);
    case 'customex.put':    return api.data.putCustomEx(op.payload);
    case 'exlib.put':       return api.data.putExlib(op.payload);
    case 'schema.put':      return api.data.putSchema(op.payload);
    default: return Promise.reject(Object.assign(new Error(`Unknown op ${op.kind}`), { status: 400 }));
  }
}

// 4xx that aren't worth repeating: the request itself is wrong (or the record
// belongs to someone else). Everything else — network, 5xx, 429, auth blips —
// is transient and gets retried.
function isPermanent(status) {
  return status === 400 || status === 403 || status === 409 || status === 413 || status === 422;
}

export async function flushOutbox() {
  if (inFlight || !outbox.length) return;
  if (owner === null) { emit(); return; }        // logged out — keep the queue for next sign-in
  if (isOffline()) { emit(); schedule(15000); return; }

  inFlight = true;
  emit();

  while (outbox.length) {
    const op = outbox[0];
    try {
      await send(op);
      lastSyncedAt = Date.now();
      // Drop it only if it's still the same op — a newer edit may have replaced
      // it mid-flight, and that one still needs sending.
      if (outbox[0] === op) outbox.shift();
      persistOutbox();
      attempt = 0; lastError = null;
      emit();
    } catch (err) {
      const status = err?.status;

      // Server predates the incremental routes: retry everything as one
      // whole-schema PUT rather than dead-lettering real workout data.
      if (status === 404 && op.kind !== 'schema.put' && op.kind !== 'exlib.put') {
        incrementalUnsupported = true;
        const cached = readCachedSchema()?.value;
        outbox = cached ? [{ kind: 'schema.put', key: 'schema', payload: cached, queuedAt: Date.now(), tries: 0 }] : [];
        persistOutbox();
        continue;
      }

      if (isPermanent(status)) {
        failed.push({ ...op, error: err.message || String(err), status, failedAt: Date.now() });
        outbox.shift();
        persistOutbox(); persistFailed();
        lastError = err.message || String(err);
        emit();
        continue;                                 // don't let one bad op block the rest
      }

      op.tries = (op.tries || 0) + 1;
      attempt += 1;
      lastError = err?.message || String(err);
      inFlight = false;
      persistOutbox();
      emit();
      schedule();
      return;
    }
  }

  inFlight = false;
  emit();
}

function schedule(delayOverride) {
  if (timer || !outbox.length) return;
  const delay = delayOverride ?? Math.min(1000 * 2 ** Math.min(attempt, 6), MAX_BACKOFF);
  timer = setTimeout(() => { timer = null; flushOutbox(); }, delay);
}

// ── Dead letters ──────────────────────────────────────────────────────────────

export function failedOps() { return failed; }

export function retryFailed() {
  if (!failed.length) return;
  outbox = [...outbox, ...failed.map(({ error, status, failedAt, ...op }) => ({ ...op, tries: 0 }))];
  failed = [];
  persistOutbox(); persistFailed();
  attempt = 0;
  emit();
  flushOutbox();
}

export function discardFailed() {
  failed = [];
  persistFailed();
  emit();
}

export function outboxCount() { return outbox.length; }

// Drop unsent work deliberately (e.g. "use the server's copy instead").
export function discardOutbox() {
  outbox = [];
  failed = [];
  persistOutbox(); persistFailed();
  attempt = 0; lastError = null;
  emit();
}

if (typeof window !== 'undefined') {
  // Reconnect and refocus are when a stuck push is most likely to work, so reset
  // the backoff and try at once instead of waiting it out.
  window.addEventListener('online', () => { attempt = 0; flushOutbox(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { attempt = 0; flushOutbox(); } });
  window.addEventListener('beforeunload', (e) => {
    if (!outbox.length) return;
    // It's all mirrored and will be sent next launch, but closing now means it
    // isn't on the server yet — worth a prompt.
    e.preventDefault();
    e.returnValue = '';
  });
}

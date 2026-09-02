// ─── API CLIENT ───────────────────────────────────────────────────────────────
// Access token is kept in module-scope memory only (never localStorage).
// The httpOnly refresh-token cookie is sent automatically by the browser on
// /api/auth/* requests and used to silently renew the access token.

let accessToken = null;

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const opts = { ...options, headers, credentials: 'include' };
  let res = await fetch(`/api${path}`, opts);

  // Silently refresh and retry once on 401 (except for auth calls themselves)
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const ok = await _tryRefresh();
    if (ok) {
      opts.headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(`/api${path}`, opts);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    // The sync outbox needs the status to tell a retryable failure (network,
    // 5xx, rate limit) from one that will never succeed (validation, conflict).
    err.status = res.status;
    throw err;
  }

  return res.json();
}

async function _tryRefresh() {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      accessToken = data.accessToken;
      return data; // { user, accessToken }
    }
  } catch { /* network error */ }
  accessToken = null;
  return null;
}

export const api = {
  setToken(token)  { accessToken = token; },
  clearToken()     { accessToken = null; },

  auth: {
    register:       (body) => request('/auth/register',        { method: 'POST', body: JSON.stringify(body) }),
    login:          (body) => request('/auth/login',           { method: 'POST', body: JSON.stringify(body) }),
    logout:         ()     => request('/auth/logout',          { method: 'POST' }),
    refresh:        _tryRefresh,
    forgotPassword: (body) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
    resetPassword:  (body) => request('/auth/reset-password',  { method: 'POST', body: JSON.stringify(body) }),
  },

  data: {
    schema:    ()      => request('/data/schema'),
    // Whole-schema replace — restore/import only. Everyday changes go through the
    // per-entity endpoints below so a save never grows with your history.
    putSchema: (s)     => request('/data/schema',    { method: 'PUT', body: JSON.stringify(s) }),
    exercises: ()      => request('/data/exercises'),
    putExlib:  (lib)   => request('/data/exlib',     { method: 'PUT', body: JSON.stringify(lib) }),
    templates: ()      => request('/data/templates'),
    export:    ()      => request('/data/export'),

    // ── Incremental writes ──────────────────────────────────────────────────
    // body: { session, e1rm_log, instance } — one transaction server-side.
    putSession:     (id, body) => request(`/data/sessions/${encodeURIComponent(id)}`,   { method: 'PUT',    body: JSON.stringify(body) }),
    deleteSession:  (id)       => request(`/data/sessions/${encodeURIComponent(id)}`,   { method: 'DELETE' }),
    putInstance:    (id, inst) => request(`/data/instances/${encodeURIComponent(id)}`,  { method: 'PUT',    body: JSON.stringify(inst) }),
    deleteInstance: (id)       => request(`/data/instances/${encodeURIComponent(id)}`,  { method: 'DELETE' }),
    patchProfile:   (profile)  => request('/data/profile',                              { method: 'PATCH',  body: JSON.stringify(profile) }),
    putLiftMax:     (ex, max)  => request(`/data/lift-maxes/${encodeURIComponent(ex)}`, { method: 'PUT',    body: JSON.stringify(max) }),
    deleteLiftMax:  (ex)       => request(`/data/lift-maxes/${encodeURIComponent(ex)}`, { method: 'DELETE' }),
    putCustomEx:    (list)     => request('/data/custom-exercises',                     { method: 'PUT',    body: JSON.stringify(list) }),
  },
};

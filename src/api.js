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
    throw new Error(body.error || `HTTP ${res.status}`);
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
    putSchema: (s)     => request('/data/schema',    { method: 'PUT', body: JSON.stringify(s) }),
    exercises: ()      => request('/data/exercises'),
    putExlib:  (lib)   => request('/data/exlib',     { method: 'PUT', body: JSON.stringify(lib) }),
    templates: ()      => request('/data/templates'),
    export:    ()      => request('/data/export'),
  },
};

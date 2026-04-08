import { useState } from "react";
import { api } from "./api.js";

const FONT = "ui-monospace,'SFMono-Regular','SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

const S = {
  page:  { fontFamily: FONT, background: "var(--bg)", color: "var(--text)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", boxSizing: "border-box" },
  box:   { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "32px 24px", width: "100%", maxWidth: "360px", boxSizing: "border-box" },
  logo:  { fontSize: "18px", fontWeight: "700", color: "var(--text)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "4px" },
  sub:   { fontSize: "11px", color: "var(--text-dim)", letterSpacing: "0.06em", marginBottom: "28px" },
  tabs:  { display: "flex", borderBottom: "1px solid var(--border)", marginBottom: "24px" },
  tab:   (a) => ({ flex: 1, padding: "10px", background: "transparent", border: "none", borderBottom: `2px solid ${a ? "var(--accent)" : "transparent"}`, color: a ? "var(--text)" : "var(--text-dim)", cursor: "pointer", fontFamily: FONT, fontSize: "13px", letterSpacing: "0.04em", fontWeight: a ? "700" : "400" }),
  field: { marginBottom: "16px" },
  label: { fontSize: "11px", color: "var(--text-dim)", display: "block", marginBottom: "5px", letterSpacing: "0.06em", textTransform: "uppercase" },
  input: { background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", padding: "10px 12px", fontSize: "16px", fontFamily: FONT, width: "100%", boxSizing: "border-box", minHeight: "44px", borderRadius: "6px", outline: "none" },
  btn:   (v) => {
    const vs = {
      primary: { background: "var(--text)", color: "var(--bg)", border: "none" },
      default: { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" },
    };
    return { ...(vs[v] || vs.default), padding: "12px 16px", cursor: "pointer", fontSize: "14px", fontFamily: FONT, letterSpacing: "0.04em", width: "100%", minHeight: "44px", marginTop: "8px", borderRadius: "6px", fontWeight: "600" };
  },
  err:  { color: "var(--danger)", fontSize: "12px", padding: "10px 12px", background: "var(--danger-dim)", borderRadius: "6px", marginBottom: "14px" },
  hint: { color: "var(--text-dim)", fontSize: "11px", marginTop: "20px", textAlign: "center", letterSpacing: "0.04em" },
};

export default function AuthPage({ onLogin }) {
  const [mode,     setMode]     = useState("login");
  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  function switchMode(m) { setMode(m); setError(null); }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = mode === "login"
        ? await api.auth.login({ email, password })
        : await api.auth.register({ username, email, password });
      api.setToken(result.accessToken);
      onLogin(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.box}>
        <div style={S.logo}>Powerlift</div>
        <div style={S.sub}>Workout tracker</div>

        <div style={S.tabs}>
          <button style={S.tab(mode === "login")}    onClick={() => switchMode("login")}>Login</button>
          <button style={S.tab(mode === "register")} onClick={() => switchMode("register")}>Register</button>
        </div>

        <form onSubmit={submit}>
          {mode === "register" && (
            <div style={S.field}>
              <label style={S.label}>Username</label>
              <input style={S.input} type="text" value={username} onChange={e => setUsername(e.target.value)}
                autoComplete="username" required minLength={2} />
            </div>
          )}
          <div style={S.field}>
            <label style={S.label}>Email</label>
            <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" required />
          </div>
          <div style={S.field}>
            <label style={S.label}>
              Password{mode === "register" && <span style={{ color: "var(--text-dim)" }}> — 8 characters minimum</span>}
            </label>
            <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required minLength={mode === "register" ? 8 : undefined} />
          </div>

          {error && <div style={S.err}>{error}</div>}

          <button style={S.btn("primary")} type="submit" disabled={loading}>
            {loading ? "…" : mode === "login" ? "Login →" : "Create account →"}
          </button>
        </form>

        {mode === "login" && (
          <div style={S.hint}>No account? Switch to Register above.</div>
        )}
      </div>
    </div>
  );
}

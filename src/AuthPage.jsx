import { useState } from "react";
import { api } from "./api.js";

// Styles match the monochrome terminal aesthetic of the main app
const S = {
  page:  { fontFamily: "'Courier New', monospace", background: "#0f0f0f", color: "#e0e0e0", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", boxSizing: "border-box" },
  box:   { background: "#1a1a1a", border: "1px solid #2a2a2a", padding: "28px 24px", width: "100%", maxWidth: "360px", boxSizing: "border-box" },
  logo:  { fontSize: "20px", fontWeight: "bold", color: "#e0e0e0", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" },
  sub:   { fontSize: "11px", color: "#444", letterSpacing: "0.06em", marginBottom: "28px" },
  tabs:  { display: "flex", borderBottom: "1px solid #2a2a2a", marginBottom: "24px" },
  tab:   (a) => ({ flex: 1, padding: "10px", background: "transparent", border: "none", borderBottom: `2px solid ${a ? "#e0e0e0" : "transparent"}`, color: a ? "#e0e0e0" : "#555", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", letterSpacing: "0.04em" }),
  field: { marginBottom: "14px" },
  label: { fontSize: "11px", color: "#666", display: "block", marginBottom: "5px", letterSpacing: "0.06em", textTransform: "uppercase" },
  input: { background: "#0f0f0f", border: "1px solid #333", color: "#e0e0e0", padding: "10px 12px", fontSize: "14px", fontFamily: "inherit", width: "100%", boxSizing: "border-box", minHeight: "42px", outline: "none" },
  btn:   (v) => {
    const vs = {
      primary: { background: "#e0e0e0", color: "#0f0f0f", border: "1px solid #e0e0e0" },
      default: { background: "#2a2a2a", color: "#ccc",    border: "1px solid #333" },
    };
    return { ...(vs[v] || vs.default), padding: "12px 16px", cursor: "pointer", fontSize: "14px", fontFamily: "inherit", letterSpacing: "0.04em", width: "100%", minHeight: "44px", marginTop: "6px" };
  },
  err:  { color: "#e06060", fontSize: "12px", padding: "8px 12px", background: "#1e1010", border: "1px solid #3a2020", marginBottom: "14px" },
  hint: { color: "#555", fontSize: "11px", marginTop: "20px", textAlign: "center", letterSpacing: "0.04em" },
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
              Password{mode === "register" && <span style={{ color: "#444" }}> — 8 characters minimum</span>}
            </label>
            <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required minLength={mode === "register" ? 8 : undefined} />
          </div>

          {error && <div style={S.err}>{error}</div>}

          <button style={S.btn("primary")} type="submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Login →" : "Create account →"}
          </button>
        </form>

        {mode === "login" && (
          <div style={S.hint}>No account? Switch to Register above.</div>
        )}
      </div>
    </div>
  );
}

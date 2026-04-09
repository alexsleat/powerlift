import { useState, useEffect, useRef } from "react";
import { api } from "./api.js";
import AuthPage from "./AuthPage.jsx";

// ─── THEME ────────────────────────────────────────────────────────────────────

const DARK = {
  '--bg':              '#0d0d0d',
  '--surface':         '#171717',
  '--surface-2':       '#1f1f1f',
  '--surface-3':       '#272727',
  '--border':          '#2e2e2e',
  '--text':            '#e8e8e8',
  '--text-muted':      '#888888',
  '--text-dim':        '#505050',
  '--accent':          '#7ec8dd',
  '--accent-dim':      '#0c2634',
  '--success':         '#4ade80',
  '--success-dim':     '#0c2918',
  '--danger':          '#f87171',
  '--danger-dim':      '#290f0f',
  '--warning':         '#fbbf24',
  '--warning-dim':     '#291c0a',
  '--set-done-bg':     '#0c2918',  '--set-done-bdr':    '#1a4a2a',
  '--set-warmup-bg':   '#0c1629',  '--set-warmup-bdr':  '#1a2a4a',
  '--set-next-bg':     '#231c00',  '--set-next-bdr':    '#5a4a18',
  '--set-idle-bg':     '#111111',  '--set-idle-bdr':    '#1e1e1e',
  '--role-main-bg':    '#1a2a0f',
  '--role-supp-bg':    '#0f1a2a',
  '--role-asst-bg':    '#111124',
  '--card-active-bdr': '#2a5a7a',
  '--card-done-bdr':   '#2a4a2a',
};

const LIGHT = {
  '--bg':              '#f2f2f2',
  '--surface':         '#ffffff',
  '--surface-2':       '#f7f7f7',
  '--surface-3':       '#ededed',
  '--border':          '#e0e0e0',
  '--text':            '#1a1a1a',
  '--text-muted':      '#666666',
  '--text-dim':        '#aaaaaa',
  '--accent':          '#0891b2',
  '--accent-dim':      '#e0f7ff',
  '--success':         '#16a34a',
  '--success-dim':     '#dcfce7',
  '--danger':          '#dc2626',
  '--danger-dim':      '#fee2e2',
  '--warning':         '#b45309',
  '--warning-dim':     '#fef3c7',
  '--set-done-bg':     '#f0fdf4',  '--set-done-bdr':    '#bbf7d0',
  '--set-warmup-bg':   '#eff6ff',  '--set-warmup-bdr':  '#bfdbfe',
  '--set-next-bg':     '#fffde7',  '--set-next-bdr':    '#fde68a',
  '--set-idle-bg':     '#ffffff',  '--set-idle-bdr':    '#e0e0e0',
  '--role-main-bg':    '#f0fdf4',
  '--role-supp-bg':    '#eff6ff',
  '--role-asst-bg':    '#f5f3ff',
  '--card-active-bdr': '#0891b2',
  '--card-done-bdr':   '#16a34a',
};

function applyTheme(vars) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

// Apply initial theme immediately (prevents flash of wrong theme on load)
{
  const stored    = localStorage.getItem('pl-theme');
  const sysDark   = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  const initDark  = stored === 'light' ? false : stored === 'dark' ? true : sysDark;
  applyTheme(initDark ? DARK : LIGHT);
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function roundToNearest(val, inc) { return Math.round(val / inc) * inc; }

function calcWarmupSets(working, bar, maxSets) {
  if (working <= bar + 5) return [{ weight: bar, reps: 5 }];
  const sets = [];
  const steps = Math.min(maxSets, 4);
  for (let i = 1; i <= steps; i++) {
    const pct = i / (steps + 1);
    const w = roundToNearest(bar + pct * (working - bar), 2.5);
    if (w > bar && w < working) sets.push({ weight: w, reps: i === steps ? 2 : 5 });
  }
  return [{ weight: bar, reps: 5 }, ...sets];
}

function epley(w, r) { return r === 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10; }

function getExercise(id, rootSchema, exLib) {
  return exLib?.exercises?.find(e => e.id === id)
    || rootSchema?.custom_exercises?.find(e => e.id === id)
    || { id, name: id, load_type: "barbell" };
}

function dspW(kg, units) {
  if (!kg && kg !== 0) return 0;
  return units === "lb" ? Math.round(kg * 2.2046 * 4) / 4 : kg;
}
function fmtW(kg, units) { return `${dspW(kg, units)}${units}`; }
function toKg(val, units) {
  return units === "lb" ? Math.round((val / 2.2046) * 4) / 4 : val;
}

function calcPlates(total, bar, units) {
  const plates = units === "lb" ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25];
  let rem = Math.round(((total - bar) / 2) * 1000) / 1000;
  if (rem < 0) return { plates: [], remainder: rem };
  const out = [];
  for (const p of plates) {
    const n = Math.floor(rem / p + 0.001);
    if (n > 0) { out.push({ weight: p, count: n }); rem = Math.round((rem - p * n) * 1000) / 1000; }
  }
  return { plates: out, remainder: rem };
}

// ─── POWERLIFTING SCORES ──────────────────────────────────────────────────────

// Wilks coefficients (male — could add female later)
function wilksScore(totalKg, bwKg) {
  if (!totalKg || !bwKg) return null;
  const a = -216.0475144, b = 16.2606339, c = -0.002388645, d = -0.00113732, e = 7.01863e-6, f = -1.291e-8;
  const denom = a + b*bwKg + c*bwKg**2 + d*bwKg**3 + e*bwKg**4 + f*bwKg**5;
  if (!denom) return null;
  return Math.round((500 / denom) * totalKg * 10) / 10;
}

// DOTS coefficients (male)
function dotsScore(totalKg, bwKg) {
  if (!totalKg || !bwKg) return null;
  const a = -307.75076, b = 24.0900756, c = -0.1918759221, d = 0.0007391293, e = -0.000001093;
  const denom = a + b*bwKg + c*bwKg**2 + d*bwKg**3 + e*bwKg**4;
  if (!denom) return null;
  return Math.round((500 / denom) * totalKg * 10) / 10;
}

function sessionTonnage(session) {
  let t = 0;
  session.exercises_performed?.forEach(ex =>
    ex.set_results?.forEach(s => {
      if (!s.is_warmup && s.weight_kg > 0 && s.reps_completed > 0) t += s.weight_kg * s.reps_completed;
    })
  );
  return t;
}

function getRpeHint(rpe, role) {
  if (role !== "assistance" || rpe == null) return null;
  if (rpe >= 9.5) return "Very hard — reduce weight next set";
  if (rpe <= 5)   return "Very light — increase significantly";
  if (rpe <= 6.5) return "Feels light — increase next set";
  return null;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const PLATE_COLORS = {
  25: "#c0302a", 20: "#2a50c0", 15: "#c0b020", 10: "#30a030",
  5: "#b0b0b0", 2.5: "#404040", 1.25: "#707070",
  45: "#c0302a", 35: "#8a3060"
};
const LIFT_META = {
  ex_squat:    { name: "Squat",    color: "#88c0d0" },
  ex_deadlift: { name: "Deadlift", color: "#e06060" },
  ex_bench:    { name: "Bench",    color: "#60c060" },
  ex_ohp:      { name: "OHP",      color: "#c0c060" },
};
const DEFAULT_REST = { main: 180, supplemental: 150, assistance: 90 };

const FONT = "ui-monospace,'SFMono-Regular','SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

// ─── STYLES ───────────────────────────────────────────────────────────────────

const S = {
  app: {
    fontFamily: FONT,
    background: "var(--bg)",
    color: "var(--text)",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    fontSize: "16px",
  },

  // ── Header (top bar) ─────────────────────────────────────────────────────
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 14px",
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    height: "54px",
    flexShrink: 0,
    gap: "8px",
    position: "sticky",
    top: 0,
    zIndex: 40,
  },
  headerLogo: {
    fontSize: "16px",
    fontWeight: "700",
    color: "var(--text)",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  headerActions: { display: "flex", alignItems: "center", gap: "4px" },
  headerBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--text-muted)",
    padding: "5px 10px",
    cursor: "pointer",
    fontFamily: FONT,
    fontSize: "14px",
    borderRadius: "5px",
    minHeight: "32px",
    WebkitTapHighlightColor: "transparent",
    letterSpacing: "0.04em",
  },

  // ── Bottom nav ───────────────────────────────────────────────────────────
  bottomNav: {
    position: "fixed",
    bottom: 0, left: 0, right: 0,
    display: "flex",
    background: "var(--surface)",
    borderTop: "1px solid var(--border)",
    paddingBottom: "env(safe-area-inset-bottom)",
    zIndex: 50,
  },
  navTab: (a) => ({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "3px",
    background: "transparent",
    border: "none",
    borderTop: `2px solid ${a ? "var(--accent)" : "transparent"}`,
    color: a ? "var(--accent)" : "var(--text-dim)",
    cursor: "pointer",
    fontFamily: FONT,
    fontSize: "11px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "8px 4px",
    WebkitTapHighlightColor: "transparent",
    outline: "none",
    minHeight: "60px",
  }),
  navIcon: { fontSize: "20px", lineHeight: "1.2" },

  // ── Layout ───────────────────────────────────────────────────────────────
  main: { flex: 1, overflow: "hidden" },
  content: {
    height: "100%",
    overflowY: "auto",
    padding: "16px",
    paddingBottom: "calc(76px + env(safe-area-inset-bottom))",
    WebkitOverflowScrolling: "touch",
    boxSizing: "border-box",
  },

  // ── Cards ────────────────────────────────────────────────────────────────
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    marginBottom: "12px",
    overflow: "hidden",
  },
  cardHead: {
    padding: "12px 16px",
    background: "var(--surface-2)",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardBody: { padding: "16px", overflowX: "auto" },

  // ── Typography ───────────────────────────────────────────────────────────
  h1: {
    fontSize: "13px",
    fontWeight: "700",
    color: "var(--text-dim)",
    margin: "0 0 16px",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  h3: {
    fontSize: "13px",
    fontWeight: "700",
    color: "var(--text-muted)",
    margin: "0",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  label: {
    fontSize: "13px",
    color: "var(--text-dim)",
    display: "block",
    marginBottom: "5px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  mono: { fontFamily: FONT, fontSize: "16px", color: "var(--accent)" },

  // ── Form elements (16px prevents iOS auto-zoom) ──────────────────────────
  input: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    padding: "10px 12px",
    fontSize: "16px",
    fontFamily: FONT,
    width: "100%",
    boxSizing: "border-box",
    minHeight: "44px",
    borderRadius: "6px",
    outline: "none",
  },
  textarea: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    padding: "10px 12px",
    fontSize: "16px",
    fontFamily: FONT,
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: "80px",
    borderRadius: "6px",
    outline: "none",
  },
  select: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    padding: "10px 12px",
    fontSize: "16px",
    fontFamily: FONT,
    minHeight: "44px",
    borderRadius: "6px",
    outline: "none",
  },

  // ── Buttons ──────────────────────────────────────────────────────────────
  btn: (v = "default") => {
    const vs = {
      default:  { background: "var(--surface-2)",  color: "var(--text-muted)", border: "1px solid var(--border)"     },
      primary:  { background: "var(--text)",        color: "var(--bg)",         border: "none"                        },
      danger:   { background: "var(--danger-dim)",  color: "var(--danger)",     border: "1px solid var(--danger-dim)" },
      success:  { background: "var(--success-dim)", color: "var(--success)",    border: "1px solid var(--success-dim)"},
      active:   { background: "var(--accent-dim)",  color: "var(--accent)",     border: "1px solid var(--accent-dim)" },
      warning:  { background: "var(--warning-dim)", color: "var(--warning)",    border: "1px solid var(--warning-dim)"},
      ghost:    { background: "transparent",        color: "var(--text-dim)",   border: "1px solid var(--border)"     },
    };
    return {
      ...(vs[v] || vs.default),
      padding: "10px 18px",
      cursor: "pointer",
      fontSize: "16px",
      fontFamily: FONT,
      letterSpacing: "0.04em",
      minHeight: "44px",
      borderRadius: "6px",
      WebkitTapHighlightColor: "transparent",
      fontWeight: "600",
      touchAction: "manipulation",
    };
  },
  btnSm: (v = "default") => {
    const vs = {
      default: { background: "var(--surface-2)",  color: "var(--text-muted)", border: "1px solid var(--border)"      },
      success: { background: "var(--success-dim)", color: "var(--success)",   border: "1px solid var(--success-dim)" },
      danger:  { background: "var(--danger-dim)",  color: "var(--danger)",    border: "1px solid var(--danger-dim)"  },
      active:  { background: "var(--accent-dim)",  color: "var(--accent)",    border: "1px solid var(--accent-dim)"  },
      warning: { background: "var(--warning-dim)", color: "var(--warning)",   border: "1px solid var(--warning-dim)" },
      primary: { background: "var(--text)",        color: "var(--bg)",        border: "none"                         },
      ghost:   { background: "transparent",        color: "var(--text-dim)",  border: "1px solid var(--border)"      },
    };
    return {
      ...(vs[v] || vs.default),
      padding: "6px 12px",
      cursor: "pointer",
      fontSize: "14px",
      fontFamily: FONT,
      letterSpacing: "0.04em",
      borderRadius: "5px",
      WebkitTapHighlightColor: "transparent",
      minHeight: "32px",
      touchAction: "manipulation",
    };
  },

  // ── Table ────────────────────────────────────────────────────────────────
  table:  { width: "100%", borderCollapse: "collapse", fontSize: "15px" },
  th:     { padding: "8px 10px", textAlign: "left", background: "var(--surface-2)", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", fontSize: "13px", letterSpacing: "0.06em", textTransform: "uppercase" },
  td:     { padding: "10px", borderBottom: "1px solid var(--border)", color: "var(--text)", verticalAlign: "middle" },

  // ── Misc ─────────────────────────────────────────────────────────────────
  badge:  (c = "var(--surface-3)") => ({ display: "inline-flex", alignItems: "center", background: c, color: "var(--text-muted)", padding: "2px 8px", fontSize: "12px", marginRight: "4px", borderRadius: "4px", letterSpacing: "0.06em", fontWeight: "700" }),
  flex:   { display: "flex", alignItems: "center", gap: "8px" },
  grid2:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  subNav: { display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" },

  // ── Modal ────────────────────────────────────────────────────────────────
  overlay:  { position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modalBox: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px 20px", width: "100%", maxWidth: "380px", boxSizing: "border-box" },
};

// ─── MODAL SHELL ──────────────────────────────────────────────────────────────

function Modal({ onClose, children }) {
  return (
    <div style={S.overlay} onPointerDown={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modalBox}>{children}</div>
    </div>
  );
}

// ─── STEPPER ─────────────────────────────────────────────────────────────────

function Stepper({ label, value, onDec, onInc, display }) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <div style={{ ...S.label, marginBottom: "8px" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          style={{ ...S.btn(), minWidth: "56px", fontSize: "22px", padding: "8px 0", borderRadius: "6px 0 0 6px", borderRight: "none" }}
          onPointerDown={e => { e.preventDefault(); onDec(); }}>−</button>
        <div style={{ flex: 1, textAlign: "center", background: "var(--bg)", border: "1px solid var(--border)", borderLeft: "none", borderRight: "none", padding: "8px 4px", fontSize: "24px", color: "var(--text)", letterSpacing: "0.05em" }}>
          {display ?? value}
        </div>
        <button
          style={{ ...S.btn(), minWidth: "56px", fontSize: "22px", padding: "8px 0", borderRadius: "0 6px 6px 0", borderLeft: "none" }}
          onPointerDown={e => { e.preventDefault(); onInc(); }}>+</button>
      </div>
    </div>
  );
}

// ─── LOG SET MODAL ────────────────────────────────────────────────────────────

function LogSetModal({ set, setLabel, onConfirm, onClose, units, defaultRpe, defaultReps: defaultRepsOverride, isEdit }) {
  const defaultReps = defaultRepsOverride ?? (typeof set.reps === "number" ? set.reps : 1);
  const [reps,   setReps]   = useState(defaultReps);
  const [rpe,    setRpe]    = useState(defaultRpe ?? 8.0);
  const [weight, setWeight] = useState(dspW(set.weight || 0, units));
  const inc    = units === "lb" ? 2.5 : 1.25;
  const bigInc = units === "lb" ? 5   : 2.5;
  const adjW = (delta) => setWeight(v => Math.max(0, Math.round((v + delta) * 100) / 100));

  return (
    <Modal onClose={onClose}>
      <div style={{ ...S.h3, marginBottom: "4px", color: isEdit ? "var(--warning)" : "var(--text-muted)" }}>
        {isEdit ? "Edit Set" : setLabel}
      </div>
      {isEdit && <div style={{ color: "var(--text-dim)", fontSize: "14px", marginBottom: "14px" }}>{setLabel}</div>}

      <Stepper label={`Weight (${units})`} value={weight} display={`${weight} ${units}`}
        onDec={() => adjW(-bigInc)} onInc={() => adjW(bigInc)} />
      <div style={{ display: "flex", gap: "4px", marginBottom: "18px" }}>
        {[-bigInc * 2, -bigInc, -inc, inc, bigInc, bigInc * 2].map(d => (
          <button key={d} style={{ ...S.btnSm(d < 0 ? "danger" : "success"), flex: 1, fontSize: "13px" }}
            onPointerDown={() => adjW(d)}>
            {d > 0 ? "+" : ""}{d}
          </button>
        ))}
      </div>

      <Stepper label="Reps completed" value={reps}
        onDec={() => setReps(r => Math.max(0, r - 1))}
        onInc={() => setReps(r => r + 1)} />

      {!set.isWarmup && (
        <Stepper label={`RPE (${rpe.toFixed(1)})`} value={rpe} display={rpe.toFixed(1)}
          onDec={() => setRpe(r => Math.max(1, Math.round((r - 0.5) * 10) / 10))}
          onInc={() => setRpe(r => Math.min(10, Math.round((r + 0.5) * 10) / 10))} />
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        <button style={{ ...S.btn(isEdit ? "warning" : "success"), flex: 1, fontSize: "16px" }}
          onPointerDown={() => onConfirm(reps, set.isWarmup ? null : rpe, toKg(weight, units))}>
          {isEdit ? "Update ✓" : "LOG ✓"}
        </button>
        <button style={{ ...S.btn("ghost"), flex: 0, minWidth: "44px" }} onPointerDown={onClose}>✕</button>
      </div>
    </Modal>
  );
}

// ─── EDIT WEIGHT MODAL ────────────────────────────────────────────────────────

function EditWeightModal({ weight, units, onConfirm, onClose }) {
  const inc    = units === "lb" ? 2.5 : 1.25;
  const bigInc = units === "lb" ? 5   : 2.5;
  const [val, setVal] = useState(dspW(weight || 0, units));
  const adj = (delta) => setVal(v => Math.max(0, Math.round((v + delta) * 100) / 100));

  return (
    <Modal onClose={onClose}>
      <div style={{ ...S.h3, marginBottom: "16px" }}>Edit Weight</div>
      <Stepper label={`Weight (${units})`} value={val} display={`${val} ${units}`}
        onDec={() => adj(-bigInc)} onInc={() => adj(bigInc)} />
      <div style={{ display: "flex", gap: "4px", marginBottom: "18px" }}>
        {[-bigInc * 2, -bigInc, -inc, inc, bigInc, bigInc * 2].map(d => (
          <button key={d} style={{ ...S.btnSm(d < 0 ? "danger" : "success"), flex: 1, fontSize: "13px" }}
            onPointerDown={() => adj(d)}>
            {d > 0 ? "+" : ""}{d}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button style={{ ...S.btn("active"), flex: 1 }}
          onPointerDown={() => onConfirm(toKg(val, units), false)}>This Set</button>
        <button style={{ ...S.btn("primary"), flex: 1 }}
          onPointerDown={() => onConfirm(toKg(val, units), true)}>All Remaining</button>
        <button style={{ ...S.btn("ghost"), flex: 0, minWidth: "44px" }} onPointerDown={onClose}>✕</button>
      </div>
    </Modal>
  );
}

// ─── JSON VIEWER ──────────────────────────────────────────────────────────────

function JsonViewer({ data, onSave }) {
  const [raw,   setRaw]   = useState(JSON.stringify(data, null, 2));
  const [error, setError] = useState(null);
  useEffect(() => { setRaw(JSON.stringify(data, null, 2)); }, [data]);
  const save = () => { try { onSave(JSON.parse(raw)); setError(null); } catch (e) { setError(e.message); } };
  return (
    <div>
      <div style={{ ...S.flex, marginBottom: "10px", flexWrap: "wrap" }}>
        <button style={S.btn("primary")} onClick={save}>Apply Changes</button>
        <button style={S.btn()} onClick={() => setRaw(JSON.stringify(data, null, 2))}>Reset</button>
        {error && <span style={{ color: "var(--danger)", fontSize: "14px" }}>Error: {error}</span>}
      </div>
      <textarea style={{ ...S.textarea, minHeight: "500px", color: "var(--accent)", fontSize: "13px" }}
        value={raw} onChange={e => setRaw(e.target.value)} />
    </div>
  );
}

// ─── REST TIMER ───────────────────────────────────────────────────────────────

function RestTimer({ seconds, onDone }) {
  const [elapsed,  setElapsed]  = useState(0);
  const [running,  setRunning]  = useState(true);
  const iv = useRef(null);

  useEffect(() => {
    if (running) iv.current = setInterval(() => setElapsed(e => e + 1), 1000);
    else clearInterval(iv.current);
    return () => clearInterval(iv.current);
  }, [running]);

  const remaining  = seconds - elapsed;
  const isOvertime = remaining < 0;
  const displaySecs = Math.abs(remaining);
  const mm = String(Math.floor(displaySecs / 60)).padStart(2, "0");
  const ss = String(displaySecs % 60).padStart(2, "0");
  const pct = Math.max(0, (remaining / seconds) * 100);
  const timerColor = isOvertime ? "var(--danger)" : pct > 40 ? "var(--success)" : "var(--warning)";

  return (
    <div style={{ ...S.card, marginBottom: "12px", borderColor: isOvertime ? "var(--danger-dim)" : "var(--border)" }}>
      <div style={{ ...S.cardHead, background: isOvertime ? "var(--danger-dim)" : "var(--surface-2)" }}>
        <span style={{ ...S.h3, color: isOvertime ? "var(--danger)" : "var(--text-muted)" }}>
          {isOvertime ? `+${mm}:${ss} OVERTIME` : "Rest"}
        </span>
        <div style={S.flex}>
          <button style={S.btnSm(running ? "danger" : "success")} onClick={() => setRunning(r => !r)}>
            {running ? "Pause" : "Resume"}
          </button>
          <button style={S.btnSm("primary")} onClick={onDone}>Skip →</button>
        </div>
      </div>
      <div style={{ padding: "4px 16px 14px" }}>
        <div style={{ fontSize: "42px", fontFamily: FONT, color: timerColor, letterSpacing: "0.1em", textAlign: "center", padding: "10px 0 8px" }}>
          {mm}:{ss}
        </div>
        <div style={{ height: "4px", background: "var(--surface-3)", borderRadius: "2px" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: timerColor, borderRadius: "2px", transition: "width 1s linear" }} />
        </div>
      </div>
    </div>
  );
}

// ─── SVG CHARTS ───────────────────────────────────────────────────────────────

// Full-width line chart with optional current-estimate dashed line and clickable dots
function LineChartWithCurrent({ points, color, currentEstimate, onDotClick }) {
  if (!points || points.length < 2) return null;
  const W = 400, H = 110, PAD = { t: 12, b: 20, l: 40, r: 12 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;

  // Include currentEstimate in the Y range so it never clips
  const ys   = points.map(p => p.y);
  const allY = currentEstimate != null ? [...ys, currentEstimate] : ys;
  const minY = Math.min(...allY), maxY = Math.max(...allY);
  const rangeY = maxY - minY || 1;
  // 5% padding on the range so dots at extremes aren't clipped
  const lo = minY - rangeY * 0.05, hi = maxY + rangeY * 0.05;
  const span = hi - lo;

  const tx = i  => PAD.l + (i / (points.length - 1)) * cW;
  const ty = v  => PAD.t + (1 - (v - lo) / span) * cH;
  const d  = points.map((p, i) => `${i === 0 ? "M" : "L"} ${tx(i).toFixed(1)} ${ty(p.y).toFixed(1)}`).join(" ");

  // Y-axis grid lines (3 levels)
  const gridVals = [lo + span * 0.25, lo + span * 0.5, lo + span * 0.75].map(v => Math.round(v));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* Grid lines */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={ty(v)} x2={W - PAD.r} y2={ty(v)} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,3" />
          <text x={PAD.l - 4} y={ty(v) + 3} fill="var(--text-dim)" fontSize="7" textAnchor="end">{v}</text>
        </g>
      ))}

      {/* Axes */}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--border)" strokeWidth="1" />
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--border)" strokeWidth="1" />

      {/* Current estimate dashed line */}
      {currentEstimate != null && (
        <>
          <line
            x1={PAD.l} y1={ty(currentEstimate)}
            x2={W - PAD.r} y2={ty(currentEstimate)}
            stroke="var(--warning)" strokeWidth="1.2" strokeDasharray="4,3" opacity="0.7"
          />
          <text x={W - PAD.r + 2} y={ty(currentEstimate) + 3} fill="var(--warning)" fontSize="7" textAnchor="start">now</text>
        </>
      )}

      {/* Historical line */}
      <path d={d} fill="none" stroke={color || "var(--accent)"} strokeWidth="2" strokeLinejoin="round" />

      {/* Dots — clickable */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={tx(i)} cy={ty(p.y)}
          r={i === points.length - 1 ? 4 : 3}
          fill={color || "var(--accent)"}
          stroke="var(--surface)" strokeWidth="1.5"
          style={{ cursor: p.sessionId ? "pointer" : "default" }}
          onClick={() => p.sessionId && onDotClick?.(p.sessionId)}
        />
      ))}

      {/* X-axis labels: first and last only */}
      <text x={tx(0)} y={H - 2} fill="var(--text-dim)" fontSize="7" textAnchor="middle">{points[0].x}</text>
      <text x={tx(points.length - 1)} y={H - 2} fill="var(--text-dim)" fontSize="7" textAnchor="middle">{points[points.length - 1].x}</text>
    </svg>
  );
}

function BarChart({ bars, color }) {
  if (!bars || bars.length === 0) return null;
  const W = 270, H = 80, PAD = { t: 6, b: 18, l: 8, r: 8 };
  const cW = W - PAD.l - PAD.r;
  const maxV = Math.max(...bars.map(b => b.value), 1);
  const bW = Math.max(4, cW / bars.length - 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "80px" }}>
      {bars.map((bar, i) => {
        const bH = (bar.value / maxV) * (H - PAD.t - PAD.b);
        const x  = PAD.l + i * (cW / bars.length);
        const y  = H - PAD.b - bH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bW} height={bH} fill={color || "#1a3a4a"} />
            {bar.label && <text x={x + bW / 2} y={H - 2} fill="#555" fontSize="7" textAnchor="middle">{bar.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ─── PLATE CALCULATOR ─────────────────────────────────────────────────────────

function PlateCalculator({ units, sessionContext }) {
  const defTarget = sessionContext?.weight ?? (units === "lb" ? 225 : 100);
  const defBar    = units === "lb" ? 45 : 20;
  const [target, setTarget] = useState(defTarget);
  const [bar,    setBar]    = useState(defBar);

  useEffect(() => {
    if (sessionContext?.weight) setTarget(dspW(sessionContext.weight, units));
  }, [sessionContext?.weight, units]);

  const result   = calcPlates(target, bar, units);
  const maxPlate = units === "lb" ? 45 : 25;

  return (
    <div>
      <div style={S.h1}>Plate Calculator</div>

      {sessionContext?.exName && (
        <div style={{ ...S.card, borderColor: "var(--accent-dim)", marginBottom: "12px" }}>
          <div style={{ ...S.cardBody, padding: "12px 16px" }}>
            <div style={{ color: "var(--accent)", fontSize: "13px", marginBottom: "6px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Session — Next Set</div>
            <div style={{ ...S.flex, justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
              <span style={{ color: "var(--text)", fontSize: "16px" }}>{sessionContext.exName}</span>
              <button style={S.btnSm("active")} onClick={() => setTarget(dspW(sessionContext.weight, units))}>
                Use {fmtW(sessionContext.weight, units)}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={S.card}>
        <div style={S.cardBody}>
          <div style={{ ...S.grid2, marginBottom: "16px" }}>
            <div>
              <label style={S.label}>Target ({units})</label>
              <input style={S.input} type="number" step={units === "lb" ? "5" : "2.5"}
                value={target} onChange={e => setTarget(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label style={S.label}>Bar ({units})</label>
              <input style={S.input} type="number" step="1"
                value={bar} onChange={e => setBar(parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          {target > bar ? (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", padding: "12px 0 4px", overflowX: "auto", gap: "2px" }}>
                <div style={{ width: "18px", height: "8px", background: "var(--text-dim)", flexShrink: 0, alignSelf: "center", borderRadius: "2px" }} />
                {result.plates.slice().reverse().flatMap((p, i) =>
                  Array.from({ length: p.count }).map((_, j) => {
                    const h = Math.round(14 + (p.weight / maxPlate) * 46);
                    return (
                      <div key={`${i}-${j}`} title={`${p.weight}${units}`} style={{
                        width: "22px", height: `${h}px`, background: PLATE_COLORS[p.weight] || "#505050",
                        border: "1px solid rgba(0,0,0,0.3)", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: "2px",
                      }}>
                        <span style={{ fontSize: "7px", color: "#fff", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{p.weight}</span>
                      </div>
                    );
                  })
                )}
                <div style={{ width: "18px", height: "8px", background: "var(--text-dim)", flexShrink: 0, alignSelf: "center", borderRadius: "2px" }} />
              </div>

              <div style={{ marginTop: "12px" }}>
                <div style={{ ...S.label, marginBottom: "8px" }}>Per side</div>
                {result.plates.length === 0
                  ? <div style={{ color: "var(--text-dim)", fontSize: "15px" }}>Bar only</div>
                  : result.plates.map((p, i) => (
                    <div key={i} style={{ ...S.flex, fontSize: "16px", marginBottom: "6px" }}>
                      <span style={S.mono}>{p.count}×</span>
                      <div style={{ width: "16px", height: "16px", background: PLATE_COLORS[p.weight] || "#505050", borderRadius: "2px" }} />
                      <span style={{ color: "var(--text)" }}>{p.weight}{units}</span>
                    </div>
                  ))
                }
                {result.remainder > 0.05 && (
                  <div style={{ color: "var(--warning)", fontSize: "14px", marginTop: "8px" }}>
                    ⚠ {result.remainder.toFixed(2)}{units}/side unloaded
                  </div>
                )}
              </div>

              <div style={{ borderTop: "1px solid var(--border)", marginTop: "16px", paddingTop: "12px", ...S.flex, justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)", fontSize: "14px" }}>Total loaded</span>
                <span style={{ ...S.mono, fontSize: "18px" }}>{target}{units}</span>
              </div>
            </>
          ) : (
            <div style={{ color: "var(--text-dim)", fontSize: "15px" }}>Target must exceed bar weight.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PROGRESS VIEW ────────────────────────────────────────────────────────────

// Compute recency-weighted current e1RM estimate from last ~6 weeks of entries.
// More recent entries get exponentially higher weight.
function estimateCurrentE1rm(entries) {
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => (a.session_id > b.session_id ? 1 : -1));
  // Take last 12 entries max
  const recent = sorted.slice(-12);
  if (!recent.length) return null;
  let sumW = 0, sumWV = 0;
  recent.forEach((e, i) => {
    const w = Math.exp(i / 4); // exponential decay: latest has weight e^(n/4)
    sumW  += w;
    sumWV += w * e.e1rm_kg;
  });
  return sumWV / sumW;
}

// Best set at exactly 10 reps for a given exercise across all sessions
function getBest10rm(exerciseId, sessions) {
  let best = null;
  (sessions || []).forEach(session => {
    (session.exercises_performed || []).forEach(ex => {
      if (ex.exercise_id !== exerciseId) return;
      (ex.set_results || []).forEach(s => {
        if (!s.is_warmup && s.success && s.reps_completed >= 10 && s.weight_kg > 0) {
          const e1rm = epley(s.weight_kg, s.reps_completed);
          if (!best || e1rm > best.e1rm) {
            best = { weight_kg: s.weight_kg, reps: s.reps_completed, e1rm, date: session.date, sessionId: session.id };
          }
        }
      });
    });
  });
  return best;
}

function ProgressView({ rootSchema, units, onNavigateToSession }) {
  const [sub, setSub] = useState("lifts");
  const mainLifts = ["ex_squat", "ex_deadlift", "ex_bench", "ex_ohp"];
  const pfLifts   = ["ex_squat", "ex_bench", "ex_deadlift"]; // for total/Wilks/DOTS
  const sessions  = rootSchema.workout_sessions || [];
  const bwKg      = rootSchema.user_profile?.bodyweight_kg || null;

  // Per-lift data
  const liftData = mainLifts.map(id => {
    const entries = (rootSchema.e1rm_log || [])
      .filter(e => e.exercise_id === id)
      .sort((a, b) => (a.session_id > b.session_id ? 1 : -1));

    const points = entries.map(e => ({
      x:         (e.session_id || "").replace("session_", "").substring(0, 10),
      y:         dspW(e.e1rm_kg, units),
      sessionId: e.session_id,
    }));

    const allKg     = entries.map(e => e.e1rm_kg);
    const bestKg    = allKg.length ? Math.max(...allKg) : null;
    const bestEntry = bestKg != null ? entries.find(e => e.e1rm_kg === bestKg) : null;
    const bestDate  = bestEntry ? (bestEntry.session_id || "").replace("session_", "").substring(0, 10) : null;

    const currentKg  = estimateCurrentE1rm(entries);
    const best10rm   = getBest10rm(id, sessions);

    return { id, ...LIFT_META[id], points, bestKg, bestDate, bestEntry, currentKg, best10rm };
  });

  // Powerlifting total: use current estimated 1RM for each of S/B/D
  const pfData    = liftData.filter(l => pfLifts.includes(l.id));
  const allHaveCurrent = pfData.every(l => l.currentKg != null);
  const currentTotal   = allHaveCurrent ? pfData.reduce((s, l) => s + l.currentKg, 0) : null;
  const bestTotal      = pfData.every(l => l.bestKg != null) ? pfData.reduce((s, l) => s + l.bestKg, 0) : null;

  const currentWilks = bwKg && currentTotal ? wilksScore(currentTotal, bwKg) : null;
  const currentDots  = bwKg && currentTotal ? dotsScore(currentTotal, bwKg)  : null;
  const bestWilks    = bwKg && bestTotal    ? wilksScore(bestTotal, bwKg)    : null;
  const bestDots     = bwKg && bestTotal    ? dotsScore(bestTotal, bwKg)     : null;

  // Volume tab
  const recentSessions = sessions.slice(-16);
  const tonnageBars    = recentSessions.map(s => ({
    label: (s.date || "").substring(5),
    value: dspW(sessionTonnage(s), units),
  }));

  return (
    <div>
      <div style={S.h1}>Stats</div>
      <div style={S.subNav}>
        <button style={S.btn(sub === "lifts"  ? "active" : "default")} onClick={() => setSub("lifts")}>Lifts</button>
        <button style={S.btn(sub === "totals" ? "active" : "default")} onClick={() => setSub("totals")}>Totals</button>
        <button style={S.btn(sub === "volume" ? "active" : "default")} onClick={() => setSub("volume")}>Volume</button>
      </div>

      {/* ── Lifts tab ── */}
      {sub === "lifts" && (
        <>
          {liftData.map(lift => (
            <div key={lift.id} style={S.card}>
              {/* Card header */}
              <div style={{ ...S.cardHead, flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontWeight: "700", color: lift.color, fontSize: "16px" }}>{lift.name}</span>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginLeft: "auto" }}>
                  {lift.currentKg != null && (
                    <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                      Est. now <span style={{ color: lift.color, fontWeight: "700" }}>{fmtW(Math.round(lift.currentKg * 2) / 2, units)}</span>
                    </span>
                  )}
                  {lift.bestKg != null && (
                    <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                      Best 1RM <span style={{ color: "var(--text)", fontWeight: "700" }}>{fmtW(lift.bestKg, units)}</span>
                      {lift.bestDate && <span style={{ color: "var(--text-dim)", marginLeft: "4px" }}>{lift.bestDate}</span>}
                    </span>
                  )}
                </div>
              </div>

              {/* Chart */}
              <div style={{ padding: "8px 8px 4px" }}>
                {lift.points.length >= 2 ? (
                  <LineChartWithCurrent
                    points={lift.points}
                    color={lift.color}
                    currentEstimate={lift.currentKg != null ? dspW(lift.currentKg, units) : null}
                    onDotClick={sid => onNavigateToSession?.(sid)}
                  />
                ) : (
                  <div style={{ color: "var(--text-dim)", fontSize: "14px", padding: "16px 0", textAlign: "center" }}>
                    Log at least 2 sessions to see chart
                  </div>
                )}
              </div>

              {/* Best records row */}
              <div style={{ padding: "0 12px 14px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {/* Best 1RM */}
                {lift.bestEntry && (
                  <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 12px", flex: "1 1 130px" }}>
                    <div style={S.label}>Best 1RM</div>
                    <div style={{ fontWeight: "700", color: "var(--text)", fontSize: "15px" }}>{fmtW(lift.bestKg, units)}</div>
                    <button
                      style={{ background: "transparent", border: "none", color: "var(--accent)", fontSize: "13px", cursor: "pointer", padding: "2px 0", fontFamily: FONT }}
                      onClick={() => onNavigateToSession?.(lift.bestEntry.session_id)}>
                      {lift.bestDate} →
                    </button>
                  </div>
                )}
                {/* Best 10RM */}
                {lift.best10rm && (
                  <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 12px", flex: "1 1 130px" }}>
                    <div style={S.label}>Best 10RM set</div>
                    <div style={{ fontWeight: "700", color: "var(--text)", fontSize: "15px" }}>
                      {fmtW(lift.best10rm.weight_kg, units)} × {lift.best10rm.reps}
                    </div>
                    <div style={{ color: "var(--text-dim)", fontSize: "13px" }}>
                      e1RM ≈ {fmtW(Math.round(lift.best10rm.e1rm), units)}
                    </div>
                    <button
                      style={{ background: "transparent", border: "none", color: "var(--accent)", fontSize: "13px", cursor: "pointer", padding: "2px 0", fontFamily: FONT }}
                      onClick={() => onNavigateToSession?.(lift.best10rm.sessionId)}>
                      {lift.best10rm.date} →
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {liftData.every(l => l.points.length === 0) && (
            <div style={{ color: "var(--text-dim)", fontSize: "15px", textAlign: "center", padding: "32px 0" }}>
              Complete sessions to see progress.
            </div>
          )}
        </>
      )}

      {/* ── Totals tab ── */}
      {sub === "totals" && (
        <>
          {/* Bodyweight prompt if missing */}
          {!bwKg && (
            <div style={{ color: "var(--warning)", fontSize: "14px", background: "var(--warning-dim)", border: "1px solid var(--border)", borderRadius: "6px", padding: "10px 14px", marginBottom: "12px" }}>
              Set your bodyweight in Settings → Setup → Profile to enable Wilks and DOTS scores.
            </div>
          )}

          {/* Scorecard */}
          <div style={S.card}>
            <div style={S.cardHead}><span style={S.h3}>Powerlifting Total (S + B + D)</span></div>
            <div style={S.cardBody}>
              {/* Per-lift row */}
              {pfData.map(l => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: l.color, fontWeight: "700", fontSize: "15px", width: "80px" }}>{l.name}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                    Best <span style={{ color: "var(--text)" }}>{l.bestKg != null ? fmtW(l.bestKg, units) : "—"}</span>
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                    Est. <span style={{ color: l.color }}>{l.currentKg != null ? fmtW(Math.round(l.currentKg * 2) / 2, units) : "—"}</span>
                  </span>
                </div>
              ))}

              {/* Totals */}
              <div style={{ marginTop: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ ...S.h3 }}>Total</span>
                  <div style={{ display: "flex", gap: "20px" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                      Best <span style={{ color: "var(--text)", fontWeight: "700" }}>{bestTotal != null ? fmtW(Math.round(bestTotal), units) : "—"}</span>
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                      Est. <span style={{ color: "var(--accent)", fontWeight: "700" }}>{currentTotal != null ? fmtW(Math.round(currentTotal), units) : "—"}</span>
                    </span>
                  </div>
                </div>

                {/* Wilks */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ ...S.h3 }}>Wilks</span>
                  <div style={{ display: "flex", gap: "20px" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                      Best <span style={{ color: "var(--text)", fontWeight: "700" }}>{bestWilks ?? "—"}</span>
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                      Est. <span style={{ color: "var(--accent)", fontWeight: "700" }}>{currentWilks ?? "—"}</span>
                    </span>
                  </div>
                </div>

                {/* DOTS */}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ ...S.h3 }}>DOTS</span>
                  <div style={{ display: "flex", gap: "20px" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                      Best <span style={{ color: "var(--text)", fontWeight: "700" }}>{bestDots ?? "—"}</span>
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                      Est. <span style={{ color: "var(--accent)", fontWeight: "700" }}>{currentDots ?? "—"}</span>
                    </span>
                  </div>
                </div>

                {!bwKg && (
                  <div style={{ color: "var(--text-dim)", fontSize: "13px", marginTop: "8px" }}>Wilks / DOTS require bodyweight</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Volume tab ── */}
      {sub === "volume" && (
        <div style={S.card}>
          <div style={S.cardHead}><span style={S.h3}>Session tonnage ({units})</span></div>
          <div style={{ padding: "8px" }}>
            {tonnageBars.length > 0
              ? <BarChart bars={tonnageBars} color="#1a3a4a" />
              : <div style={{ color: "var(--text-dim)", fontSize: "15px", padding: "16px", textAlign: "center" }}>No sessions yet.</div>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BACKUP / RESTORE ─────────────────────────────────────────────────────────

function BackupRestore({ rootSchema, exLib, onRestore }) {
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);

  function backup() {
    const data = JSON.stringify({ powerlift_backup: true, version: "1.1.0", backup_date: new Date().toISOString().split("T")[0], schema: rootSchema, exLib }, null, 2);
    const url  = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a    = document.createElement("a");
    a.href = url; a.download = `powerlift-${new Date().toISOString().split("T")[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  function restore(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.schema || !data.exLib) throw new Error("Missing schema or exLib fields");
        onRestore(data.schema, data.exLib);
        setErr(null);
      } catch (ex) { setErr(ex.message); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
      <button style={S.btn("primary")} onClick={backup}>⬇ Download Backup</button>
      <button style={S.btn()} onClick={() => fileRef.current?.click()}>⬆ Restore from File</button>
      <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={restore} />
      {err && <span style={{ color: "var(--danger)", fontSize: "14px", alignSelf: "center" }}>Error: {err}</span>}
    </div>
  );
}

// ─── SESSION PLAN BUILDER (module-level so preview helpers and edit loading can reuse it) ──

function buildSessionPlan(inst, tmpl, rootSchema) {
  const ph   = tmpl.phases[0];
  const week = inst.current_week;
  const day  = inst.current_day;

  // 531 wave weeks
  if (ph.wave_weeks) {
    const waveWeek = ph.wave_weeks.find(w => w.week === week);
    const mainLift = ph.main_lifts.find(l => l.day === day);
    if (!mainLift || !waveWeek) return null;
    const tm         = inst.training_maxes.find(t => t.exercise_id === mainLift.exercise_id)?.tm_kg || 100;
    const role       = inst.current_cycle_role;
    const roleConfig = tmpl.cycle_roles?.[role];
    const isAmrap    = roleConfig?.amrap_sets ?? true;
    const warmups    = calcWarmupSets(roundToNearest(waveWeek.core_sets[0].tm_pct * tm, 2.5), tmpl.warmup_protocol.start_weight_kg, tmpl.warmup_protocol.max_warmup_sets);
    const mainSets   = waveWeek.core_sets.map((s, i) => {
      const w    = roundToNearest(s.tm_pct * tm, 2.5);
      const reps = s.reps === "amrap" && !isAmrap ? 5 : s.reps;
      return { setIndex: i, weight: w, reps, isAmrap: s.reps === "amrap" && isAmrap, amrap_minimum: s.amrap_minimum, isWarmup: false, isDone: false, repsLogged: null, rpeLogged: null };
    });
    const exercises = [];
    exercises.push({ exercise_id: mainLift.exercise_id, role: "main",
      sets: [...warmups.map((w, i) => ({ setIndex: i, weight: w.weight, reps: w.reps, isWarmup: true, isDone: false, repsLogged: null, rpeLogged: null })), ...mainSets] });
    if (roleConfig?.supplemental?.type === "FSL") {
      const fslW = roundToNearest(waveWeek.core_sets[0].tm_pct * tm, 2.5);
      exercises.push({ exercise_id: mainLift.exercise_id, role: "supplemental", label: "FSL Back-off",
        sets: Array.from({ length: roleConfig.supplemental.sets }, (_, i) => ({ setIndex: i, weight: fslW, reps: roleConfig.supplemental.reps, isWarmup: false, isDone: false, repsLogged: null, rpeLogged: null })) });
    }
    return { exercises, week, day, weekLabel: waveWeek.week_label, role, mainLiftId: mainLift.exercise_id, tm, instanceId: inst.id };
  }

  // Leviathan
  if (ph.leviathan_weeks) {
    const levWeek  = ph.leviathan_weeks.find(w => w.week === week);
    const mainLift = ph.main_lifts.find(l => l.day === day);
    if (!mainLift || !levWeek) return null;
    const tm       = inst.training_maxes.find(t => t.exercise_id === mainLift.exercise_id)?.tm_kg || 100;
    const exercises = [];
    if (levWeek.is_deload) {
      exercises.push({ exercise_id: mainLift.exercise_id, role: "main", label: "Deload",
        sets: levWeek.deload_sets.map((s, i) => ({ setIndex: i, weight: roundToNearest(s.tm_pct * tm, 2.5), reps: s.reps, isWarmup: false, isDone: false, repsLogged: null, rpeLogged: null })) });
      (ph.assistance_by_day?.[String(day)] || []).forEach(a =>
        exercises.push({ exercise_id: a.exercise_id, role: "assistance",
          sets: Array.from({ length: a.deload_sets || 2 }, (_, i) => ({ setIndex: i, weight: 0, reps: a.deload_reps || 10, isWarmup: false, isDone: false, repsLogged: null, rpeLogged: null })) })
      );
    } else {
      const warmupSets = levWeek.warmup_sets.map((s, i) => ({ setIndex: i, weight: roundToNearest(s.tm_pct * tm, 2.5), reps: s.reps, isWarmup: true, isDone: false, repsLogged: null, rpeLogged: null }));
      const mainSingle = { setIndex: 0, weight: roundToNearest(levWeek.main_single.tm_pct * tm, 2.5), reps: 1, isWarmup: false, isDone: false, repsLogged: null, rpeLogged: null };
      exercises.push({ exercise_id: mainLift.exercise_id, role: "main", sets: [...warmupSets, mainSingle] });
      if (levWeek.ssl) {
        const sslW = roundToNearest(levWeek.ssl.tm_pct * tm, 2.5);
        exercises.push({ exercise_id: mainLift.exercise_id, role: "supplemental", label: `SSL — ${Math.round(levWeek.ssl.tm_pct * 100)}% TM`,
          sets: Array.from({ length: levWeek.ssl.sets }, (_, i) => ({ setIndex: i, weight: sslW, reps: levWeek.ssl.reps, isWarmup: false, isDone: false, repsLogged: null, rpeLogged: null })) });
      }
      (ph.assistance_by_day?.[String(day)] || []).forEach(a =>
        exercises.push({ exercise_id: a.exercise_id, role: "assistance",
          sets: Array.from({ length: a.sets }, (_, i) => ({ setIndex: i, weight: 0, reps: a.reps, isWarmup: false, isDone: false, repsLogged: null, rpeLogged: null })) })
      );
    }
    return { exercises, week, day, weekLabel: levWeek.week_label, role: inst.current_cycle_role || "leviathan", mainLiftId: mainLift.exercise_id, tm, instanceId: inst.id };
  }

  // StrongLifts
  if (ph.workout_templates) {
    const patIdx  = (inst.current_day - 1) % ph.session_alternation_pattern.length;
    const key     = ph.session_alternation_pattern[patIdx];
    const exercises = ph.workout_templates[key].map(te => {
      const liftW  = rootSchema?.lift_maxes?.find(l => l.exercise_id === te.exercise_id)?.one_rm_kg;
      const fakeW  = liftW ? roundToNearest(liftW * 0.7, 2.5) : 60;
      const warmups = te.set_scheme_type !== "single_top_set" ? calcWarmupSets(fakeW, tmpl.warmup_protocol.start_weight_kg, tmpl.warmup_protocol.max_warmup_sets) : [{ weight: 20, reps: 5 }];
      const work   = Array.from({ length: te.sets }, (_, i) => ({ setIndex: i, weight: fakeW, reps: te.reps, isWarmup: false, isDone: false, repsLogged: null, rpeLogged: null }));
      return { exercise_id: te.exercise_id, role: te.role,
        sets: [...warmups.map((w, i) => ({ setIndex: i, weight: w.weight, reps: w.reps, isWarmup: true, isDone: false, repsLogged: null, rpeLogged: null })), ...work] };
    });
    return { exercises, week: inst.current_week, day: inst.current_day, weekLabel: `Workout ${key}`, role: null, mainLiftId: null, instanceId: inst.id };
  }
  return null;
}

function getTemplateExercises(tmpl) {
  const ph = tmpl?.phases?.[0];
  if (!ph) return [];
  if (ph.main_lifts) return [...new Set(ph.main_lifts.map(l => l.exercise_id))];
  if (ph.workout_templates) {
    const ids = new Set();
    Object.values(ph.workout_templates).forEach(wt => wt.forEach(te => ids.add(te.exercise_id)));
    return [...ids];
  }
  return [];
}

function previewCycleSessions(inst, tmpl, rootSchema, count = 5) {
  const maxDay  = tmpl?.days_per_week || 4;
  const maxWeek = tmpl?.cycle_structure?.mesocycle_weeks || 3;
  const sessions = [];
  let d = inst.current_day, w = inst.current_week, c = inst.current_cycle;
  for (let i = 0; i < count; i++) {
    const fake = { ...inst, current_day: d, current_week: w, current_cycle: c };
    const plan = buildSessionPlan(fake, tmpl, rootSchema);
    if (plan) sessions.push({ plan, isNext: i === 0 });
    d++;
    if (d > maxDay) { d = 1; w++; }
    if (maxWeek && w > maxWeek) { w = 1; c++; }
  }
  return sessions;
}

// ─── TM REVIEW PANEL ──────────────────────────────────────────────────────────

function TmReviewPanel({ inst, tmpl, units, rootSchema, onChange }) {
  const increments = tmpl?.progression_model?.lift_increments || [];
  const tmPct      = tmpl?.progression_model?.initial_tm_percentage ?? 0.90;

  function getBestE1rm(exerciseId) {
    const entries = rootSchema.e1rm_log?.filter(e => e.exercise_id === exerciseId) || [];
    if (entries.length === 0) return null;
    return Math.max(...entries.map(e => e.e1rm_kg));
  }

  const [newTMs, setNewTMs] = useState(() =>
    inst.training_maxes.map(tm => {
      const inc   = increments.find(li => li.exercises?.includes(tm.exercise_id) || li.exercise_id === tm.exercise_id);
      const delta = inc?.increment_kg || 0;
      return { exercise_id: tm.exercise_id, current_kg: tm.tm_kg, new_kg: tm.tm_kg + delta };
    })
  );
  const [editIdx, setEditIdx] = useState(null);

  function apply() {
    const today = new Date().toISOString().split("T")[0];
    onChange({ ...rootSchema, programme_instances: rootSchema.programme_instances.map(i => i.id !== inst.id ? i : {
      ...i, needs_tm_review: false,
      training_maxes: i.training_maxes.map(tm => {
        const n = newTMs.find(t => t.exercise_id === tm.exercise_id);
        return n ? { ...tm, tm_kg: n.new_kg, last_updated: today } : tm;
      })
    })});
  }

  function skip() {
    onChange({ ...rootSchema, programme_instances: rootSchema.programme_instances.map(i =>
      i.id === inst.id ? { ...i, needs_tm_review: false } : i
    )});
  }

  const liftName = id => LIFT_META[id]?.name || id.replace("ex_", "");
  const editing  = editIdx != null ? newTMs[editIdx] : null;

  return (
    <>
      {editing != null && (
        <EditWeightModal
          weight={editing.new_kg} units={units}
          onClose={() => setEditIdx(null)}
          onConfirm={(kg) => { setNewTMs(prev => prev.map((t, i) => i === editIdx ? { ...t, new_kg: kg } : t)); setEditIdx(null); }}
        />
      )}
      <div style={{ ...S.card, borderColor: "var(--card-done-bdr)", marginBottom: "16px" }}>
        <div style={{ ...S.cardHead, background: "var(--success-dim)" }}>
          <span style={{ fontWeight: "bold", color: "var(--success)", fontSize: "15px" }}>Cycle Complete — Review TMs</span>
          <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>{tmpl?.name}</span>
        </div>
        <div style={S.cardBody}>
          <div style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "12px" }}>
            Tap New TM to edit. "Use e1RM" sets TM from your best estimated 1RM ({Math.round(tmPct * 100)}%).
          </div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Lift</th>
              <th style={S.th}>Best e1RM</th>
              <th style={S.th}>New TM</th>
            </tr></thead>
            <tbody>
              {newTMs.map((tm, i) => {
                const bestE1rm = getBestE1rm(tm.exercise_id);
                const fromE1rm = bestE1rm ? roundToNearest(bestE1rm * tmPct, 2.5) : null;
                return (
                  <tr key={i}>
                    <td style={S.td}>{liftName(tm.exercise_id)}</td>
                    <td style={S.td}>
                      {bestE1rm ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ color: "var(--text-muted)", fontSize: "15px" }}>{fmtW(bestE1rm, units)}</span>
                          <button style={S.btnSm("warning")} onClick={() =>
                            setNewTMs(prev => prev.map((t, j) => j === i ? { ...t, new_kg: fromE1rm } : t))
                          }>→{fmtW(fromE1rm, units)}</button>
                        </div>
                      ) : <span style={{ color: "var(--text-dim)", fontSize: "14px" }}>no data</span>}
                    </td>
                    <td style={S.td}>
                      <button style={S.btnSm("active")} onClick={() => setEditIdx(i)}>
                        {fmtW(tm.new_kg, units)} ✎
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ ...S.flex, marginTop: "14px", flexWrap: "wrap" }}>
            <button style={S.btn("success")} onClick={apply}>Update TMs →</button>
            <button style={S.btn()} onClick={skip}>Skip for now</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── SCHEMA SECTION ───────────────────────────────────────────────────────────

function SchemaSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={S.card}>
      <div style={{ ...S.cardHead, cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <span style={S.h3}>{title}</span>
        <span style={{ color: "var(--text-dim)", fontSize: "16px" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && <div style={S.cardBody}>{children}</div>}
    </div>
  );
}

// ─── NEW PROGRAMME PANEL ──────────────────────────────────────────────────────

function LiftSetsPreview({ exId, tmKg, tmpl, units }) {
  if (!tmKg || tmKg <= 0 || !tmpl) return null;
  const ph = tmpl.phases?.[0];
  if (!ph) return null;

  let rows = [];
  if (ph.wave_weeks && ph.main_lifts) {
    const mainLift = ph.main_lifts.find(l => l.exercise_id === exId);
    if (!mainLift) return null;
    rows = ph.wave_weeks.map(ww => ({
      label: ww.week_label,
      sets: ww.core_sets.map(s => ({ reps: s.reps, weight: roundToNearest(s.tm_pct * tmKg, 2.5) }))
    }));
  } else if (ph.leviathan_weeks && ph.main_lifts) {
    const mainLift = ph.main_lifts.find(l => l.exercise_id === exId);
    if (!mainLift) return null;
    rows = ph.leviathan_weeks.filter(w => !w.is_deload).map(w => ({
      label: w.week_label,
      sets: [{ reps: 1, weight: roundToNearest(w.main_single.tm_pct * tmKg, 2.5) }]
    }));
  } else {
    return null;
  }

  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "6px", padding: "10px 12px", marginTop: "8px" }}>
      <div style={{ ...S.label, marginBottom: "6px" }}>Top sets preview</div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "4px", flexWrap: "wrap" }}>
          <span style={{ color: "var(--text-dim)", fontSize: "13px", minWidth: "72px" }}>{row.label}</span>
          {row.sets.map((s, j) => (
            <span key={j} style={{ color: "var(--accent)", fontSize: "14px" }}>
              {s.reps === "amrap" ? "AMRAP" : s.reps}×{fmtW(s.weight, units)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function NewProgrammePanel({ rootSchema, exLib, onChange }) {
  const units = rootSchema.user_profile?.units || "kg";
  const [selectedId, setSelectedId] = useState("");
  const [step,       setStep]       = useState("template");
  const [inputMode,  setInputMode]  = useState("1rm");
  const [inputs,     setInputs]     = useState({});
  const tmpl  = rootSchema.programme_templates.find(t => t.id === selectedId);
  const tmPct = tmpl?.progression_model?.initial_tm_percentage ?? 0.90;

  function handleTemplateSelect(id) {
    setSelectedId(id);
    const t = rootSchema.programme_templates.find(t => t.id === id);
    const exIds = getTemplateExercises(t);
    const init = {};
    exIds.forEach(exId => {
      const existing = rootSchema.lift_maxes.find(l => l.exercise_id === exId);
      init[exId] = existing ? String(dspW(existing.one_rm_kg, units)) : "";
    });
    setInputs(init);
  }

  function getOneRmKg(exId) {
    const raw = parseFloat(inputs[exId]);
    if (!raw || raw <= 0) return null;
    const kg = toKg(raw, units);
    return inputMode === "1rm" ? kg : roundToNearest(kg / tmPct, 2.5);
  }
  function getTmKg(exId) {
    const oneRm = getOneRmKg(exId);
    return oneRm ? roundToNearest(oneRm * tmPct, 2.5) : null;
  }

  function start() {
    if (!tmpl) return;
    const today = new Date().toISOString().split("T")[0];
    const exIds = getTemplateExercises(tmpl);
    let newLiftMaxes = [...rootSchema.lift_maxes];
    exIds.forEach(exId => {
      const oneRmKg = getOneRmKg(exId);
      if (!oneRmKg) return;
      const idx = newLiftMaxes.findIndex(l => l.exercise_id === exId);
      const entry = { exercise_id: exId, one_rm_kg: oneRmKg, tested_date: today, method: "manual" };
      if (idx >= 0) newLiftMaxes[idx] = entry; else newLiftMaxes.push(entry);
    });
    const training_maxes = newLiftMaxes
      .filter(lm => exIds.length === 0 || exIds.includes(lm.exercise_id))
      .map(lm => ({
        exercise_id: lm.exercise_id,
        tm_kg: roundToNearest(lm.one_rm_kg * tmPct, 2.5),
        last_updated: today, cycle_when_set: 1
      }));
    const newInst = {
      id: `prog_inst_${Date.now()}`, template_id: selectedId, status: "active",
      started_date: today,
      current_phase_id: tmpl.phases?.[0]?.phase_id || null,
      current_cycle_role: selectedId === "531_fsl" ? "leader" : "standard",
      current_macrocycle_block: 1, current_cycle: 1, current_week: 1, current_day: 1,
      training_maxes, failure_tracking: [], phase_history: [], needs_tm_review: false
    };
    onChange({ ...rootSchema, lift_maxes: newLiftMaxes, programme_instances: [...rootSchema.programme_instances, newInst] });
    setSelectedId(""); setStep("template"); setInputs({});
  }

  const exIds = getTemplateExercises(tmpl);

  return (
    <SchemaSection title="Start New Programme">
      {step === "template" && (
        <>
          <div style={{ marginBottom: "14px" }}>
            <label style={S.label}>Template</label>
            <select style={{ ...S.select, width: "100%" }} value={selectedId} onChange={e => handleTemplateSelect(e.target.value)}>
              <option value="">— select —</option>
              {rootSchema.programme_templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {tmpl && (
            <div style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "14px" }}>
              TMs set at {Math.round(tmPct * 100)}% of 1RM.
              <div style={{ marginTop: "4px", color: "var(--text-dim)" }}>{tmpl.description}</div>
            </div>
          )}
          <button style={S.btn("primary")} onClick={() => setStep("maxes")} disabled={!selectedId}>
            Next: Enter Maxes →
          </button>
        </>
      )}
      {step === "maxes" && tmpl && (
        <>
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <button style={S.btnSm(inputMode === "1rm" ? "active" : "default")} onClick={() => setInputMode("1rm")}>Enter 1RM</button>
            <button style={S.btnSm(inputMode === "tm"  ? "active" : "default")} onClick={() => setInputMode("tm")}>Enter TM</button>
            <span style={{ color: "var(--text-dim)", fontSize: "13px", marginLeft: "4px" }}>TM = {Math.round(tmPct * 100)}% of 1RM</span>
          </div>
          {exIds.map(exId => {
            const exInfo  = exLib?.exercises?.find(e => e.id === exId) || { name: (LIFT_META[exId]?.name || exId.replace("ex_", "")) };
            const tmKg    = getTmKg(exId);
            const oneRmKg = getOneRmKg(exId);
            const otherVal = inputMode === "1rm"
              ? (tmKg    ? `TM → ${fmtW(tmKg, units)}`    : null)
              : (oneRmKg ? `1RM ≈ ${fmtW(oneRmKg, units)}` : null);
            return (
              <div key={exId} style={{ marginBottom: "18px" }}>
                <label style={S.label}>{exInfo.name} — {inputMode === "1rm" ? `1RM (${units})` : `Training Max (${units})`}</label>
                <input style={S.input} type="number" step={units === "lb" ? "5" : "2.5"}
                  value={inputs[exId] ?? ""}
                  onChange={e => setInputs(prev => ({ ...prev, [exId]: e.target.value }))} />
                {otherVal && <div style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>{otherVal}</div>}
                <LiftSetsPreview exId={exId} tmKg={tmKg} tmpl={tmpl} units={units} />
              </div>
            );
          })}
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={S.btn()} onClick={() => setStep("template")}>← Back</button>
            <button style={S.btn("primary")} onClick={start}>Start Programme →</button>
          </div>
        </>
      )}
    </SchemaSection>
  );
}

// ─── SETTINGS TAB (replaces RootSchemaView + ExerciseLibraryView) ──────────────

function SettingsTab({ rootSchema, exLib, onChange, onExLibChange, onRestore, themeOverride, onSetTheme }) {
  const [sub,         setSub]         = useState("setup");
  const [editTmModal, setEditTmModal] = useState(null);
  const units    = rootSchema.user_profile?.units || "kg";
  const restDefs = rootSchema.user_profile?.rest_defaults_seconds || DEFAULT_REST;

  function updateProfile(key, val) {
    onChange({ ...rootSchema, user_profile: { ...rootSchema.user_profile, [key]: val } });
  }
  function updateRestDefault(role, val) {
    const newDefs = { ...restDefs, [role]: parseInt(val) || 0 };
    onChange({ ...rootSchema, user_profile: { ...rootSchema.user_profile, rest_defaults_seconds: newDefs } });
  }
  function updateTM(instId, exId, tmKg) {
    onChange({ ...rootSchema, programme_instances: rootSchema.programme_instances.map(i =>
      i.id !== instId ? i : { ...i, training_maxes: i.training_maxes.map(t =>
        t.exercise_id === exId ? { ...t, tm_kg: tmKg } : t
      )}
    )});
  }
  function archiveInst(instId) {
    onChange({ ...rootSchema, programme_instances: rootSchema.programme_instances.map(i =>
      i.id === instId ? { ...i, status: "archived" } : i
    )});
  }
  function restoreInst(instId) {
    onChange({ ...rootSchema, programme_instances: rootSchema.programme_instances.map(i =>
      i.id === instId ? { ...i, status: "active" } : i
    )});
  }

  const liftName     = id => LIFT_META[id]?.name || id.replace("ex_", "");
  const activeInsts  = rootSchema.programme_instances.filter(i => i.status === "active");
  const archivedInsts= rootSchema.programme_instances.filter(i => i.status === "archived");

  return (
    <>
      {editTmModal && (
        <EditWeightModal
          weight={editTmModal.kg} units={units}
          onClose={() => setEditTmModal(null)}
          onConfirm={(kg) => { updateTM(editTmModal.instId, editTmModal.exId, kg); setEditTmModal(null); }}
        />
      )}
      <div style={S.h1}>Settings</div>
      <div style={S.subNav}>
        {[["setup","Setup"],["programmes","Programmes"],["library","Library"],["json","Raw JSON"]].map(([id,label]) => (
          <button key={id} style={S.btn(sub === id ? "active" : "default")} onClick={() => setSub(id)}>{label}</button>
        ))}
      </div>

      {/* ── Setup ── */}
      {sub === "setup" && (
        <>
          <SchemaSection title="Appearance">
            <div style={{ marginBottom: "4px", ...S.label }}>Theme</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button style={S.btn(!themeOverride ? "active" : "default")} onClick={() => onSetTheme(null)}>Auto (system)</button>
              <button style={S.btn(themeOverride === "light" ? "active" : "default")} onClick={() => onSetTheme("light")}>Light</button>
              <button style={S.btn(themeOverride === "dark"  ? "active" : "default")} onClick={() => onSetTheme("dark")}>Dark</button>
            </div>
          </SchemaSection>

          <SchemaSection title="Profile">
            <div style={{ marginBottom: "14px" }}>
              <label style={S.label}>Name</label>
              <input style={S.input} value={rootSchema.user_profile.name}
                onChange={e => updateProfile("name", e.target.value)} />
            </div>
            <div style={{ marginBottom: "4px" }}>
              <label style={S.label}>Bodyweight ({units}) — used for Wilks / DOTS</label>
              <input style={{ ...S.input, width: "140px" }} type="number" step={units === "lb" ? "1" : "0.5"} min="30"
                value={rootSchema.user_profile.bodyweight_kg
                  ? dspW(rootSchema.user_profile.bodyweight_kg, units)
                  : ""}
                placeholder="optional"
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  updateProfile("bodyweight_kg", v > 0 ? toKg(v, units) : null);
                }} />
            </div>
          </SchemaSection>

          <SchemaSection title="Rest Timer Defaults" defaultOpen={false}>
            <div style={{ color: "var(--text-dim)", fontSize: "14px", marginBottom: "14px" }}>Seconds of rest after each set type.</div>
            {[["main", "Main Lift"], ["supplemental", "Supplemental"], ["assistance", "Assistance"]].map(([role, label]) => (
              <div key={role} style={{ marginBottom: "12px" }}>
                <label style={S.label}>{label} (seconds)</label>
                <input style={{ ...S.input, width: "120px" }} type="number" step="15"
                  value={restDefs[role] ?? DEFAULT_REST[role]}
                  onChange={e => updateRestDefault(role, e.target.value)} />
              </div>
            ))}
          </SchemaSection>

          <SchemaSection title="Backup / Restore">
            <BackupRestore rootSchema={rootSchema} exLib={exLib} onRestore={onRestore} />
          </SchemaSection>
        </>
      )}

      {/* ── Programmes ── */}
      {sub === "programmes" && (
        <>
          <NewProgrammePanel rootSchema={rootSchema} exLib={exLib} onChange={onChange} />

          <SchemaSection title={`Active (${activeInsts.length})`}>
            {activeInsts.length === 0 && <div style={{ color: "var(--text-dim)", fontSize: "15px" }}>None. Start one above.</div>}
            {activeInsts.map(inst => {
              const tmpl = rootSchema.programme_templates.find(t => t.id === inst.template_id);
              return (
                <div key={inst.id} style={{ marginBottom: "20px" }}>
                  <div style={{ ...S.flex, marginBottom: "10px", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                    <div>
                      <div style={{ color: "var(--text)", fontWeight: "bold", fontSize: "16px" }}>{tmpl?.name || inst.template_id}</div>
                      <div style={{ color: "var(--text-dim)", fontSize: "14px", marginTop: "2px" }}>Cycle {inst.current_cycle} · W{inst.current_week}D{inst.current_day}</div>
                    </div>
                    <button style={S.btnSm("warning")} onClick={() => archiveInst(inst.id)}>Archive</button>
                  </div>
                  <table style={S.table}>
                    <thead><tr><th style={S.th}>Lift</th><th style={S.th}>Training Max</th></tr></thead>
                    <tbody>
                      {inst.training_maxes.map((tm, i) => (
                        <tr key={i}>
                          <td style={S.td}>{liftName(tm.exercise_id)}</td>
                          <td style={S.td}>
                            <button style={S.btnSm("active")}
                              onClick={() => setEditTmModal({ instId: inst.id, exId: tm.exercise_id, kg: tm.tm_kg })}>
                              {fmtW(tm.tm_kg, units)} ✎
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </SchemaSection>

          {archivedInsts.length > 0 && (
            <SchemaSection title={`Archived (${archivedInsts.length})`} defaultOpen={false}>
              {archivedInsts.map(inst => {
                const tmpl = rootSchema.programme_templates.find(t => t.id === inst.template_id);
                return (
                  <div key={inst.id} style={{ ...S.flex, justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: "15px" }}>{tmpl?.name || inst.template_id}</div>
                      <div style={{ color: "var(--text-dim)", fontSize: "13px", marginTop: "2px" }}>Started {inst.started_date} · Cycle {inst.current_cycle}</div>
                    </div>
                    <button style={S.btnSm()} onClick={() => restoreInst(inst.id)}>Restore</button>
                  </div>
                );
              })}
            </SchemaSection>
          )}
        </>
      )}

      {/* ── Library ── */}
      {sub === "library" && (
        <div>
          <div style={{ color: "var(--text-dim)", fontSize: "14px", marginBottom: "14px" }}>Edit the exercise library JSON directly.</div>
          <JsonViewer data={exLib} onSave={onExLibChange} />
        </div>
      )}

      {/* ── Raw JSON ── */}
      {sub === "json" && (
        <div>
          <div style={{ color: "var(--text-dim)", fontSize: "14px", marginBottom: "14px" }}>Edit the full schema JSON directly. Changes apply immediately.</div>
          <JsonViewer data={rootSchema} onSave={onChange} />
        </div>
      )}
    </>
  );
}

// ─── SESSION RUNNER ───────────────────────────────────────────────────────────

function SessionRunner({ rootSchema, exLib, onSessionComplete, onSchemaChange, onContextChange, editingSession, onEditDone }) {
  const units    = rootSchema.user_profile?.units || "kg";
  const restDefs = rootSchema.user_profile?.rest_defaults_seconds || DEFAULT_REST;

  const [phase,           setPhase]           = useState("pick");
  const [selectedInstId,  setSelectedInstId]  = useState(() => {
    const active = rootSchema.programme_instances.find(i => i.status === "active");
    return active?.id || null;
  });
  const [sessionPlan,     setSessionPlan]     = useState(null);
  const [currentExIdx,    setCurrentExIdx]    = useState(0);
  const [expandedSet,     setExpandedSet]     = useState(new Set([0]));
  const [setResults,      setSetResults]      = useState({});
  const [weightOverrides, setWeightOverrides] = useState({});
  const [resting,         setResting]         = useState(false);
  const [restSeconds,     setRestSeconds]     = useState(180);
  const [sessionNotes,    setSessionNotes]    = useState("");
  const [dayOverride,     setDayOverride]     = useState(null);
  const [weekWarnShown,   setWeekWarnShown]   = useState(false);
  const [logModal,          setLogModal]          = useState(null);
  const [weightModal,       setWeightModal]       = useState(null);
  const [lastRpeByExId,     setLastRpeByExId]     = useState({});
  const [restKey,           setRestKey]           = useState(0);   // increments on every new rest → remounts timer
  const [sessionDate,       setSessionDate]       = useState("");
  const [sessionTime,       setSessionTime]       = useState("");
  const [sessionDurationMins, setSessionDurationMins] = useState(null);
  const sessionStartTsRef = useRef(null);

  useEffect(() => {
    if (!editingSession) return;
    const inst = rootSchema.programme_instances.find(i => i.id === editingSession.programme_instance_id)
              || rootSchema.programme_instances.find(i => i.status === "active");
    const tmpl = inst ? rootSchema.programme_templates.find(t => t.id === inst.template_id) : null;
    const fakeInst = inst ? { ...inst, current_week: editingSession.week || inst.current_week, current_day: editingSession.day || inst.current_day } : null;
    const plan = fakeInst && tmpl ? buildSessionPlan(fakeInst, tmpl, rootSchema) : null;
    if (!plan) return;

    // Restore results AND weight overrides from the saved session
    const preResults  = {};
    const preOverrides = {};
    editingSession.exercises_performed?.forEach((ex, exIdx) => {
      ex.set_results?.forEach((s, si) => {
        // Restore weight for every set (so logged weights show, not template weights)
        if (s.weight_kg != null) preOverrides[`${exIdx}-${si}`] = s.weight_kg;
        if (s.success)
          preResults[`${exIdx}-${si}`] = { reps: s.reps_completed, rpe: s.rpe, done: true };
      });
    });

    // Find first exercise that isn't fully done
    const firstIncomplete = plan.exercises.findIndex((ex, exIdx) => {
      const wc = ex.sets.filter(s => s.isWarmup).length;
      return ex.sets.filter(s => !s.isWarmup).some((_, j) => !preResults[`${exIdx}-${wc + j}`]?.done);
    });

    setSelectedInstId(inst?.id || null);
    setSessionPlan({ ...plan, editingSessionId: editingSession.id });
    setSetResults(preResults);
    setWeightOverrides(preOverrides);
    setCurrentExIdx(firstIncomplete >= 0 ? firstIncomplete : 0);
    setExpandedSet(new Set([firstIncomplete >= 0 ? firstIncomplete : 0]));
    setSessionNotes(editingSession.notes || "");
    setSessionDate(editingSession.date || new Date().toISOString().split("T")[0]);
    setSessionTime(editingSession.start_time || new Date().toTimeString().slice(0, 5));
    setSessionDurationMins(editingSession.duration_minutes || null);
    setResting(false);
    sessionStartTsRef.current = Date.now();
    setPhase("session");
  }, [editingSession]);

  useEffect(() => {
    if (phase !== "session" || !sessionPlan) { onContextChange?.(null); return; }
    const ex = sessionPlan.exercises[currentExIdx];
    if (!ex) return;
    const wc = ex.sets.filter(s => s.isWarmup).length;
    const nextSetIdx = ex.sets.findIndex((_s, i) => i >= wc && !setResults[`${currentExIdx}-${i}`]?.done);
    const nextSet    = nextSetIdx >= 0 ? ex.sets[nextSetIdx] : null;
    const weight     = nextSet ? (weightOverrides[`${currentExIdx}-${nextSetIdx}`] ?? nextSet.weight) : null;
    const exInfo     = getExercise(ex.exercise_id, rootSchema, exLib);
    onContextChange?.({ weight, exName: exInfo.name });
  }, [phase, sessionPlan, currentExIdx, setResults, weightOverrides]);

  function getEffectiveWeight(exIdx, setIdx, set) {
    return weightOverrides[`${exIdx}-${setIdx}`] ?? set.weight;
  }

  function applyWeightOverride(exIdx, fromSetIdx, newKg, applyToAll) {
    const ex = sessionPlan.exercises[exIdx];
    if (applyToAll) {
      const updates = {};
      ex.sets.forEach((s, i) => {
        if (i >= fromSetIdx && !s.isWarmup && !setResults[`${exIdx}-${i}`]?.done)
          updates[`${exIdx}-${i}`] = newKg;
      });
      setWeightOverrides(prev => ({ ...prev, ...updates }));
    } else {
      setWeightOverrides(prev => ({ ...prev, [`${exIdx}-${fromSetIdx}`]: newKg }));
    }
    setWeightModal(null);
  }

  function logSet(exIdx, setIdx, reps, rpe, weightKg) {
    const ex             = sessionPlan.exercises[exIdx];
    const exerciseId     = ex.exercise_id;
    const wasAlreadyDone = !!setResults[`${exIdx}-${setIdx}`]?.done;
    if (weightKg !== undefined) {
      const updates = {};
      const currentSetIsWarmup = ex.sets[setIdx].isWarmup;
      if (!currentSetIsWarmup) {
        ex.sets.forEach((s, i) => {
          if (i >= setIdx && !s.isWarmup && !setResults[`${exIdx}-${i}`]?.done)
            updates[`${exIdx}-${i}`] = weightKg;
        });
      }
      updates[`${exIdx}-${setIdx}`] = weightKg;
      setWeightOverrides(prev => ({ ...prev, ...updates }));
    }
    if (rpe != null) setLastRpeByExId(prev => ({ ...prev, [exerciseId]: rpe }));
    setSetResults(r => ({ ...r, [`${exIdx}-${setIdx}`]: { reps, rpe, done: true } }));
    setLogModal(null);
    if (wasAlreadyDone) return;
    const nextSetIdx = setIdx + 1;
    if (nextSetIdx < ex.sets.length) {
      if (!ex.sets[nextSetIdx].isWarmup) {
        setRestSeconds(restDefs[ex.role] ?? DEFAULT_REST[ex.role] ?? 120);
        setResting(true);
        setRestKey(k => k + 1);
      }
    } else {
      const nextEx = exIdx + 1;
      if (nextEx < sessionPlan.exercises.length) {
        setCurrentExIdx(nextEx);
        setExpandedSet(prev => { const n = new Set(prev); n.add(nextEx); return n; });
        const nextRole = sessionPlan.exercises[nextEx].role || "assistance";
        setRestSeconds(restDefs[nextRole] ?? DEFAULT_REST[nextRole] ?? 90);
        setResting(true);
        setRestKey(k => k + 1);
      } else {
        // Auto-compute duration from session start
        if (sessionStartTsRef.current) {
          setSessionDurationMins(Math.round((Date.now() - sessionStartTsRef.current) / 60000));
        }
        setPhase("summary");
      }
    }
  }

  function toggleExpand(idx) {
    setExpandedSet(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  }

  function getAssistanceWeightOverrides(plan) {
    const overrides = {};
    const sessions = rootSchema.workout_sessions || [];
    plan.exercises.forEach((ex, exIdx) => {
      if (ex.role !== "assistance") return;
      if (ex.sets.some(s => s.weight > 0)) return; // already has a weight
      for (let si = sessions.length - 1; si >= 0; si--) {
        const ep = sessions[si].exercises_performed?.find(e => e.exercise_id === ex.exercise_id);
        if (!ep) continue;
        const lastWork = (ep.set_results || []).filter(s => !s.is_warmup && s.weight_kg > 0).slice(-1)[0];
        if (lastWork) {
          ex.sets.forEach((_, setIdx) => { overrides[`${exIdx}-${setIdx}`] = lastWork.weight_kg; });
          break;
        }
      }
    });
    return overrides;
  }

  function startSession() {
    const inst = rootSchema.programme_instances.find(i => i.id === selectedInstId);
    const tmpl = rootSchema.programme_templates.find(t => t.id === inst?.template_id);
    if (!inst || !tmpl) return;
    const plan = buildSessionPlan(inst, tmpl, rootSchema);
    if (!plan) return;
    const now = new Date();
    setSessionPlan(plan);
    setCurrentExIdx(0); setExpandedSet(new Set([0])); setSetResults({});
    setWeightOverrides(getAssistanceWeightOverrides(plan)); setResting(false);
    setSessionNotes("");
    setSessionDate(now.toISOString().split("T")[0]);
    setSessionTime(now.toTimeString().slice(0, 5));
    setSessionDurationMins(null);
    sessionStartTsRef.current = Date.now();
    setPhase("session");
  }

  // ── Render: SetRow ──────────────────────────────────────────────────────────
  function SetRow({ exIdx, setIdx, set }) {
    const result       = setResults[`${exIdx}-${setIdx}`];
    const done         = result?.done;
    const exEntry      = sessionPlan.exercises[exIdx];
    const exSets       = exEntry.sets;
    const isAssistance = exEntry.role === "assistance";
    const numWarmup    = exSets.filter(s => s.isWarmup).length;
    const setNum       = set.isWarmup ? "W" : (setIdx - numWarmup + 1);
    const weight       = getEffectiveWeight(exIdx, setIdx, set);
    const hint         = done ? getRpeHint(result.rpe, exEntry.role) : null;
    const isNext = !done && exIdx === currentExIdx &&
      exSets.slice(0, setIdx).filter(s => !s.isWarmup).every((_, j) => {
        const wc = numWarmup;
        return setResults[`${exIdx}-${wc + j}`]?.done;
      }) && (set.isWarmup || exSets.slice(numWarmup, setIdx).every((_, j) => setResults[`${exIdx}-${numWarmup + j}`]?.done));

    const rowBg     = done ? "var(--set-done-bg)"   : set.isWarmup ? "var(--set-warmup-bg)"   : isNext ? "var(--set-next-bg)"   : "var(--set-idle-bg)";
    const rowBorder = done ? "var(--set-done-bdr)"  : set.isWarmup ? "var(--set-warmup-bdr)"  : isNext ? "var(--set-next-bdr)"  : "var(--set-idle-bdr)";
    const plannedReps = set.reps === "amrap" ? "AMRAP" : `${set.reps} reps`;

    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px", marginBottom: "4px", background: rowBg, border: `1px solid ${rowBorder}`, borderRadius: "6px" }}>
          {/* Set number */}
          <div style={{ width: "22px", textAlign: "center", color: "var(--text-dim)", fontSize: "14px", flexShrink: 0, fontWeight: "600" }}>{setNum}</div>

          {/* Weight */}
          <button
            style={{ background: "transparent", border: `1px solid ${done ? rowBorder : "var(--border)"}`, color: weight > 0 ? "var(--accent)" : "var(--text-dim)", padding: "5px 10px", fontSize: "16px", fontFamily: FONT, cursor: (!done && weight > 0) ? "pointer" : "default", minWidth: "64px", borderRadius: "5px", fontWeight: "600" }}
            onClick={() => !done && weight > 0 && setWeightModal({ exIdx, setIdx, weight })}
            disabled={done || weight === 0}>
            {weight > 0 ? fmtW(weight, units) : "—"}
          </button>

          {/* Reps */}
          <div style={{ flex: 1, color: done ? "var(--warning)" : "var(--text-muted)", fontSize: "15px" }}>
            {done ? `${result.reps} reps` : plannedReps}
          </div>

          {/* RPE */}
          {!set.isWarmup && !isAssistance ? (() => {
            // Expected RPE: from set definition, or infer from role (AMRAP = high effort)
            const targetRpe = set.target_rpe ?? (set.isAmrap ? "8+" : exEntry.role === "main" ? "8" : "7");
            return (
              <div style={{ minWidth: "44px", color: done ? "var(--accent)" : "var(--text-dim)", fontSize: "14px", textAlign: "right" }}>
                {done && result.rpe != null ? `@${result.rpe}` : `@${targetRpe}`}
              </div>
            );
          })() : (
            <div style={{ minWidth: "44px" }} />
          )}

          {/* Log / Done */}
          {done ? (
            <button
              style={{ background: "transparent", border: "1px solid var(--card-done-bdr)", color: "var(--success)", fontSize: "18px", padding: "4px 8px", cursor: "pointer", flexShrink: 0, fontFamily: FONT, borderRadius: "5px", minWidth: "40px" }}
              onClick={() => setLogModal({ exIdx, setIdx, editReps: result.reps, editRpe: result.rpe, editWeight: weight })}
              title="Tap to edit">✓</button>
          ) : (
            <button
              style={{ ...S.btnSm("success"), minWidth: "52px", fontSize: "15px", padding: "7px 12px", flexShrink: 0, fontWeight: "700" }}
              onClick={() => setLogModal({ exIdx, setIdx })}>LOG</button>
          )}
        </div>
        {hint && (
          <div style={{ padding: "3px 10px 5px 42px", fontSize: "13px", color: "var(--warning)", background: "var(--warning-dim)", marginBottom: "3px", borderRadius: "0 0 5px 5px" }}>
            ↳ {hint}
          </div>
        )}
      </>
    );
  }

  // ── Render: ExCard ──────────────────────────────────────────────────────────
  function ExCard({ ex, exIdx }) {
    const isActive   = exIdx === currentExIdx;
    const isExpanded = expandedSet.has(exIdx);
    const exInfo     = getExercise(ex.exercise_id, rootSchema, exLib);
    const warmupSets = ex.sets.filter(s => s.isWarmup);
    const workSets   = ex.sets.filter(s => !s.isWarmup);
    const doneCount  = workSets.filter((_, i) => setResults[`${exIdx}-${warmupSets.length + i}`]?.done).length;
    const allDone    = workSets.length > 0 && doneCount === workSets.length;

    const roleColor  = ex.role === "main" ? "var(--role-main-bg)" : ex.role === "supplemental" ? "var(--role-supp-bg)" : "var(--role-asst-bg)";
    const roleBadge  = ex.role === "main" ? "MAIN" : ex.role === "supplemental" ? "SUPP" : "ASST";
    const cardBorder = allDone ? "var(--card-done-bdr)" : isActive ? "var(--card-active-bdr)" : "var(--border)";
    const headBg     = allDone ? "var(--success-dim)"   : isActive ? "var(--accent-dim)"       : "var(--surface-2)";

    return (
      <div style={{ ...S.card, borderColor: cardBorder }}>
        <div style={{ ...S.cardHead, cursor: "pointer", background: headBg, minHeight: "52px" }}
          onClick={() => toggleExpand(exIdx)}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {isActive && !allDone && <span style={{ color: "var(--accent)", fontSize: "13px" }}>▶</span>}
            <span style={S.badge(roleColor)}>{roleBadge}</span>
            <span style={{ fontWeight: "bold", fontSize: "16px", color: allDone ? "var(--success)" : isActive ? "var(--text)" : "var(--text-muted)" }}>
              {exInfo.name}
            </span>
            {ex.label && <span style={{ color: "var(--accent)", fontSize: "14px" }}>{ex.label}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "8px" }}>
            <span style={{ color: allDone ? "var(--success)" : "var(--text-muted)", fontSize: "15px", fontWeight: "600" }}>
              {allDone ? `✓${workSets.length}` : `${doneCount}/${workSets.length}`}
            </span>
            <span style={{ color: "var(--text-dim)", fontSize: "15px" }}>{isExpanded ? "▲" : "▼"}</span>
          </div>
        </div>
        <div style={{ display: isExpanded ? "block" : "none" }}>
          <div style={{ padding: "10px" }}>
            {ex.sets.map((set, setIdx) => SetRow({ exIdx, setIdx, set }))}
          </div>
        </div>
      </div>
    );
  }

  // ── Pick phase ──────────────────────────────────────────────────────────────
  if (phase === "pick") {
    const reviewInst  = rootSchema.programme_instances.find(i => i.status === "active" && i.needs_tm_review);
    const reviewTmpl  = reviewInst ? rootSchema.programme_templates.find(t => t.id === reviewInst.template_id) : null;
    const activeInsts = rootSchema.programme_instances.filter(i => i.status === "active");
    const selInst     = activeInsts.find(i => i.id === selectedInstId);
    const selTmpl     = selInst ? rootSchema.programme_templates.find(t => t.id === selInst.template_id) : null;
    const effectiveWeek = dayOverride?.week ?? selInst?.current_week ?? 1;
    const effectiveDay  = dayOverride?.day  ?? selInst?.current_day  ?? 1;
    const maxDay        = selTmpl?.days_per_week || 4;
    const maxWeek       = selTmpl?.cycle_structure?.mesocycle_weeks || 3;
    const isOverridden  = dayOverride != null;
    const isOtherWeek   = dayOverride && dayOverride.week !== selInst?.current_week;
    const previewInst   = selInst ? { ...selInst, current_week: effectiveWeek, current_day: effectiveDay } : null;
    const preview       = previewInst && selTmpl ? previewCycleSessions(previewInst, selTmpl, rootSchema, 5) : [];

    function handleStartSession() {
      if (dayOverride) {
        const inst = rootSchema.programme_instances.find(i => i.id === selectedInstId);
        const tmpl = rootSchema.programme_templates.find(t => t.id === inst?.template_id);
        if (!inst || !tmpl) return;
        const fakeInst = { ...inst, current_week: dayOverride.week, current_day: dayOverride.day };
        const plan = buildSessionPlan(fakeInst, tmpl, rootSchema);
        if (!plan) return;
        const nowOvr = new Date();
        setSessionPlan({ ...plan, overriddenFromWeek: inst.current_week, overriddenFromDay: inst.current_day });
        setCurrentExIdx(0); setExpandedSet(new Set([0])); setSetResults({});
        setWeightOverrides(getAssistanceWeightOverrides(plan)); setResting(false);
        setSessionNotes("");
        setSessionDate(nowOvr.toISOString().split("T")[0]);
        setSessionTime(nowOvr.toTimeString().slice(0, 5));
        setSessionDurationMins(null);
        sessionStartTsRef.current = Date.now();
        setPhase("session");
      } else {
        startSession();
      }
    }

    return (
      <div>
        <div style={S.h1}>Start Session</div>

        {reviewInst && reviewTmpl && (
          <TmReviewPanel inst={reviewInst} tmpl={reviewTmpl} units={units} rootSchema={rootSchema} onChange={onSchemaChange} />
        )}

        <div style={S.card}>
          <div style={S.cardHead}><span style={S.h3}>Active Programmes</span></div>
          <div style={S.cardBody}>
            {activeInsts.length === 0 && (
              <div style={{ color: "var(--text-dim)", fontSize: "15px" }}>No active programmes. Add one in Settings.</div>
            )}
            {activeInsts.map(i => {
              const t = rootSchema.programme_templates.find(t => t.id === i.template_id);
              const isSelected = selectedInstId === i.id;
              return (
                <div key={i.id}
                  onClick={() => { setSelectedInstId(i.id); setDayOverride(null); setWeekWarnShown(false); }}
                  style={{ padding: "14px", marginBottom: "8px", cursor: "pointer", borderRadius: "6px",
                    background: isSelected ? "var(--accent-dim)" : "var(--surface-2)",
                    border: `1px solid ${isSelected ? "var(--card-active-bdr)" : "var(--border)"}` }}>
                  <div style={{ fontWeight: "bold", color: "var(--text)", fontSize: "16px" }}>{t?.name || i.template_id}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>Cycle {i.current_cycle} · Week {i.current_week} · Day {i.current_day}</div>
                </div>
              );
            })}
          </div>
        </div>

        {selInst && selTmpl && (
          <div style={S.card}>
            <div style={S.cardHead}><span style={S.h3}>Session Select</span></div>
            <div style={S.cardBody}>
              <div style={{ color: "var(--text-dim)", fontSize: "14px", marginBottom: "12px" }}>
                Programme is at Week {selInst.current_week} · Day {selInst.current_day}. Choose a different session below — this won't change your programme position.
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
                <div>
                  <label style={S.label}>Week</label>
                  <select style={S.select} value={effectiveWeek} onChange={e => {
                    const w = parseInt(e.target.value);
                    if (w !== selInst.current_week && !weekWarnShown) setWeekWarnShown(true);
                    setDayOverride({ week: w, day: effectiveDay });
                  }}>
                    {Array.from({ length: maxWeek }, (_, i) => i + 1).map(w => (
                      <option key={w} value={w}>Week {w}{w === selInst.current_week ? " (current)" : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Day</label>
                  <select style={S.select} value={effectiveDay} onChange={e => setDayOverride({ week: effectiveWeek, day: parseInt(e.target.value) })}>
                    {Array.from({ length: maxDay }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>Day {d}{d === selInst.current_day && effectiveWeek === selInst.current_week ? " (current)" : ""}</option>
                    ))}
                  </select>
                </div>
                {isOverridden && (
                  <button style={{ ...S.btnSm("ghost") }} onClick={() => { setDayOverride(null); setWeekWarnShown(false); }}>
                    Reset to current
                  </button>
                )}
              </div>
              {isOtherWeek && (
                <div style={{ color: "var(--warning)", fontSize: "14px", marginTop: "10px", background: "var(--warning-dim)", border: "1px solid var(--border)", padding: "8px 12px", borderRadius: "6px" }}>
                  ⚠ Week {effectiveWeek} is not your current week. Saving won't advance your programme position.
                </div>
              )}
            </div>
          </div>
        )}

        <button style={{ ...S.btn("primary"), width: "100%", padding: "16px", fontSize: "18px", marginBottom: "24px" }}
          onClick={handleStartSession} disabled={!selectedInstId || !!reviewInst}>
          {reviewInst ? "Complete TM review above first" : "Begin Session →"}
        </button>

        {preview.length > 0 && (
          <>
            <div style={S.h1}>{isOverridden ? "Selected Session" : "Upcoming Sessions"}</div>
            {preview.map(({ plan, isNext }, idx) => (
              <div key={idx} style={{ ...S.card, marginBottom: "8px" }}>
                <div style={S.cardHead}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: "700", color: isNext ? "var(--text)" : "var(--text-muted)", fontSize: "15px" }}>
                      {isNext && <span style={{ color: "var(--accent)" }}>▶ </span>}
                      {plan.weekLabel} — Day {plan.day}
                      {plan.role && <span style={{ color: "var(--text-dim)", fontWeight: "normal", marginLeft: "8px", fontSize: "13px" }}>{plan.role}</span>}
                    </div>
                    {isNext && <div style={{ color: "var(--accent)", fontSize: "12px", marginTop: "2px", letterSpacing: "0.06em", textTransform: "uppercase" }}>{isOverridden ? "Selected" : "Next up"}</div>}
                  </div>
                </div>
                <div style={S.cardBody}>
                  {plan.exercises.map((ex, ei) => {
                    const exInfo   = getExercise(ex.exercise_id, rootSchema, exLib);
                    const workSets = ex.sets.filter(s => !s.isWarmup);
                    return (
                      <div key={ei} style={{ marginBottom: ei < plan.exercises.length - 1 ? "12px" : 0 }}>
                        <div style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "6px", fontWeight: "600", letterSpacing: "0.04em" }}>{exInfo.name}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                          {workSets.map((s, si) => (
                            <div key={si} style={{ background: "var(--set-idle-bg)", border: "1px solid var(--set-idle-bdr)", padding: "4px 9px", fontSize: "14px", borderRadius: "5px" }}>
                              <span style={{ color: "var(--accent)" }}>{fmtW(s.weight, units)}</span>
                              <span style={{ color: "var(--text-muted)", marginLeft: "5px" }}>×{s.reps === "amrap" ? "AMRAP" : s.reps}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  // ── Session phase ───────────────────────────────────────────────────────────
  if (phase === "session" && sessionPlan) {
    const totalEx = sessionPlan.exercises.length;
    const doneEx  = sessionPlan.exercises.filter((ex, i) => {
      const wc = ex.sets.filter(s => s.isWarmup).length;
      return ex.sets.filter(s => !s.isWarmup).every((_, j) => setResults[`${i}-${wc + j}`]?.done);
    }).length;

    const logModalData    = logModal    ? sessionPlan.exercises[logModal.exIdx]?.sets[logModal.setIdx] : null;
    const weightModalData = weightModal ? sessionPlan.exercises[weightModal.exIdx]?.sets[weightModal.setIdx] : null;

    return (
      <div>
        {logModal && logModalData && (
          <LogSetModal
            set={{ ...logModalData, weight: logModal.editWeight ?? getEffectiveWeight(logModal.exIdx, logModal.setIdx, logModalData) }}
            setLabel={`${getExercise(sessionPlan.exercises[logModal.exIdx].exercise_id, rootSchema, exLib).name} — Set ${logModal.setIdx + 1}`}
            onConfirm={(reps, rpe, weightKg) => logSet(logModal.exIdx, logModal.setIdx, reps, rpe, weightKg)}
            onClose={() => setLogModal(null)}
            units={units}
            defaultRpe={logModal.editRpe ?? lastRpeByExId[sessionPlan.exercises[logModal.exIdx]?.exercise_id]}
            defaultReps={logModal.editReps}
            isEdit={!!logModal.editReps}
          />
        )}
        {weightModal && weightModalData && (
          <EditWeightModal
            weight={weightModal.weight} units={units}
            onClose={() => setWeightModal(null)}
            onConfirm={(kg, applyAll) => applyWeightOverride(weightModal.exIdx, weightModal.setIdx, kg, applyAll)}
          />
        )}

        {/* Session header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px", gap: "8px" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--text)", letterSpacing: "0.04em" }}>{sessionPlan.weekLabel}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "2px" }}>Day {sessionPlan.day} · {doneEx}/{totalEx} exercises</div>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button style={S.btnSm("warning")} onClick={() => { setPhase("summary"); setResting(false); }}>Save</button>
            <button style={S.btnSm("danger")}  onClick={() => { setPhase("pick");    setResting(false); }}>Abandon</button>
          </div>
        </div>

        {resting && <RestTimer key={restKey} seconds={restSeconds} onDone={() => setResting(false)} />}

        {sessionPlan.exercises.map((ex, exIdx) => ExCard({ ex, exIdx }))}
      </div>
    );
  }

  // ── Summary phase ───────────────────────────────────────────────────────────
  if (phase === "summary") {
    const isEdit            = !!sessionPlan?.editingSessionId;
    const isOverrideSession = !!sessionPlan?.overriddenFromWeek;
    return (
      <div>
        <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--text)", marginBottom: "16px", letterSpacing: "0.04em" }}>
          {isEdit ? "Edit Session" : "Session Complete"}
        </div>
        {isOverrideSession && (
          <div style={{ color: "var(--text-muted)", fontSize: "14px", background: "var(--warning-dim)", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: "6px", marginBottom: "14px" }}>
            Week {sessionPlan.week} · Day {sessionPlan.day} — saved without advancing programme position.
          </div>
        )}
        <div style={S.card}>
          <div style={S.cardBody}>
            <div style={S.grid2}>
              <div>
                <label style={S.label}>Date</label>
                <input style={S.input} type="date" value={sessionDate}
                  onChange={e => setSessionDate(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Start time</label>
                <input style={S.input} type="time" value={sessionTime}
                  onChange={e => setSessionTime(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: "14px" }}>
              <label style={S.label}>Duration (minutes)</label>
              <input style={{ ...S.input, width: "130px" }} type="number" min="1" step="1"
                value={sessionDurationMins ?? ""}
                placeholder="optional"
                onChange={e => setSessionDurationMins(e.target.value ? parseInt(e.target.value) : null)} />
            </div>
            <div style={{ marginTop: "14px" }}>
              <label style={S.label}>Notes</label>
              <textarea style={S.textarea} value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)} placeholder="Session notes..." />
            </div>
          </div>
        </div>
        <button style={{ ...S.btn("primary"), width: "100%", padding: "16px", fontSize: "16px" }}
          onClick={() => {
            const planWithWeights = {
              ...sessionPlan,
              exercises: sessionPlan.exercises.map((ex, exIdx) => ({
                ...ex, sets: ex.sets.map((set, setIdx) => ({ ...set, weight: getEffectiveWeight(exIdx, setIdx, set) }))
              }))
            };
            onSessionComplete({
              plan: planWithWeights, results: setResults, notes: sessionNotes,
              sessionDate, sessionTime, sessionDurationMins,
              editingSessionId: sessionPlan.editingSessionId ?? null,
              skipProgression: isOverrideSession || isEdit,
            });
            setDayOverride(null); setWeekWarnShown(false);
            onEditDone?.(); setPhase("pick");
          }}>
          {isEdit ? "Update Session" : "Save Session"}
        </button>
        <button style={{ ...S.btn("ghost"), width: "100%", marginTop: "8px" }}
          onClick={() => setPhase("session")}>← Back to session</button>
      </div>
    );
  }

  return null;
}

// ─── HISTORY TAB ─────────────────────────────────────────────────────────────

function HistoryTab({ rootSchema, exLib, onEditSession, onDeleteSession, highlightSession, onHighlightClear }) {
  const units = rootSchema.user_profile?.units || "kg";
  const [expanded,   setExpanded]   = useState(highlightSession ?? null);
  const [confirmDel, setConfirmDel] = useState(null);
  const highlightRef = useRef(null);

  // Scroll to highlighted session on mount / change
  useEffect(() => {
    if (highlightSession && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return () => onHighlightClear?.();
  }, [highlightSession]);

  const sessions = [...(rootSchema.workout_sessions || [])]
    .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

  function instName(session) {
    const inst = rootSchema.programme_instances?.find(i => i.id === session.programme_instance_id);
    const tmpl = inst ? rootSchema.programme_templates?.find(t => t.id === inst.template_id) : null;
    return tmpl?.name || inst?.template_id || "Free session";
  }

  function sessionSummary(session) {
    const totals = { sets: 0, reps: 0, kg: 0 };
    session.exercises_performed?.forEach(ex =>
      ex.set_results?.forEach(s => {
        if (!s.is_warmup && s.success) {
          totals.sets++; totals.reps += s.reps_completed || 0;
          totals.kg += (s.weight_kg || 0) * (s.reps_completed || 0);
        }
      })
    );
    return totals;
  }

  if (sessions.length === 0) {
    return (
      <div>
        <div style={S.h1}>History</div>
        <div style={{ color: "var(--text-dim)", fontSize: "15px", textAlign: "center", padding: "40px 0" }}>No sessions recorded yet.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={S.h1}>History</div>
      {sessions.map(session => {
        const isOpen = expanded === session.id;
        const totals = sessionSummary(session);
        const name   = instName(session);
        return (
          <div key={session.id}
            ref={session.id === highlightSession ? highlightRef : null}
            style={{ ...S.card, marginBottom: "8px", borderColor: session.id === highlightSession ? "var(--accent)" : "var(--border)" }}>
            <div style={{ ...S.cardHead, cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : session.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: "700", color: "var(--text)", fontSize: "15px" }}>
                  {session.date}
                  <span style={{ color: "var(--text-muted)", fontWeight: "normal", marginLeft: "8px" }}>{name}</span>
                </div>
                <div style={{ color: "var(--text-dim)", fontSize: "13px", marginTop: "3px" }}>
                  {session.week ? `Wk ${session.week} · Day ${session.day}` : ""}
                  {totals.sets > 0 ? `  ·  ${totals.sets} sets · ${Math.round(totals.kg)}${units}` : ""}
                  {session.duration_minutes ? `  ·  ${session.duration_minutes}min` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                <button style={S.btnSm("warning")} onPointerDown={e => { e.stopPropagation(); onEditSession(session); }}>Edit</button>
                {confirmDel === session.id ? (
                  <>
                    <button style={S.btnSm("danger")} onPointerDown={e => { e.stopPropagation(); onDeleteSession(session.id); setConfirmDel(null); }}>Confirm</button>
                    <button style={S.btnSm("ghost")}  onPointerDown={e => { e.stopPropagation(); setConfirmDel(null); }}>✕</button>
                  </>
                ) : (
                  <button style={S.btnSm("danger")} onPointerDown={e => { e.stopPropagation(); setConfirmDel(session.id); setExpanded(null); }}>Del</button>
                )}
                <span style={{ color: "var(--text-dim)", fontSize: "15px" }}>{isOpen ? "▲" : "▼"}</span>
              </div>
            </div>
            {isOpen && (
              <div style={S.cardBody}>
                {session.notes && (
                  <div style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "12px", fontStyle: "italic", padding: "8px 12px", background: "var(--bg)", borderRadius: "5px" }}>
                    "{session.notes}"
                  </div>
                )}
                {session.exercises_performed?.map((ex, ei) => {
                  const exInfo   = getExercise(ex.exercise_id, rootSchema, exLib);
                  const workSets = ex.set_results?.filter(s => !s.is_warmup) || [];
                  return (
                    <div key={ei} style={{ marginBottom: "12px" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "6px", fontWeight: "600", letterSpacing: "0.04em" }}>{exInfo.name}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                        {workSets.map((s, si) => (
                          <div key={si} style={{ background: s.success ? "var(--set-done-bg)" : "var(--danger-dim)", border: `1px solid ${s.success ? "var(--set-done-bdr)" : "var(--danger-dim)"}`, padding: "4px 9px", fontSize: "14px", borderRadius: "5px" }}>
                            <span style={{ color: "var(--accent)" }}>{fmtW(s.weight_kg, units)}</span>
                            <span style={{ color: s.success ? "var(--success)" : "var(--danger)", marginLeft: "5px" }}>{s.reps_completed}×</span>
                            {s.rpe ? <span style={{ color: "var(--text-muted)", marginLeft: "4px" }}>@{s.rpe}</span> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [rootSchema,     setRootSchema]     = useState(null);
  const [exLib,          setExLib]          = useState(null);
  const [activeTab,      setActiveTab]      = useState("session");
  const [loading,        setLoading]        = useState(true);
  const [sessionContext,    setSessionContext]    = useState(null);
  const [editingSession,    setEditingSession]    = useState(null);
  const [highlightSession,  setHighlightSession]  = useState(null); // id to scroll/highlight in history
  const [user,           setUser]           = useState(null);
  const [authChecked,    setAuthChecked]    = useState(false);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [themeOverride, setThemeOverride] = useState(() => localStorage.getItem('pl-theme'));
  const sysDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  const isDark  = themeOverride ? themeOverride === 'dark' : sysDark;

  useEffect(() => {
    applyTheme(isDark ? DARK : LIGHT);
    if (themeOverride) localStorage.setItem('pl-theme', themeOverride);
    else               localStorage.removeItem('pl-theme');
  }, [isDark, themeOverride]);

  function handleSetTheme(val) { setThemeOverride(val); }

  // ── Auth + data load ──────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const authData = await api.auth.refresh();
      if (!authData) { setAuthChecked(true); setLoading(false); return; }
      api.setToken(authData.accessToken);
      setUser(authData.user);
      await loadAppData();
      setAuthChecked(true);
      setLoading(false);
    }
    init();
  }, []);

  async function loadAppData() {
    try {
      const [schemaData, exercisesData, templatesData] = await Promise.all([
        api.data.schema(), api.data.exercises(), api.data.templates(),
      ]);
      schemaData.programme_templates = templatesData;
      setRootSchema(schemaData);
      setExLib(exercisesData);
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  }

  async function handleLogin(loggedInUser) {
    setUser(loggedInUser);
    setLoading(true);
    await loadAppData();
    setLoading(false);
  }

  async function handleLogout() {
    try { await api.auth.logout(); } catch { /* ignore */ }
    api.clearToken();
    setUser(null); setRootSchema(null); setExLib(null);
  }

  function updateSchema(newSchema) {
    setRootSchema(newSchema);
    api.data.putSchema(newSchema).catch(err => console.error("Schema sync failed:", err));
  }
  function updateExLib(newLib) {
    setExLib(newLib);
    api.data.putExlib(newLib).catch(err => console.error("ExLib sync failed:", err));
  }
  function handleRestore(schema, lib) {
    schema.programme_templates = rootSchema.programme_templates;
    updateSchema(schema);
    updateExLib(lib);
  }
  function handleDeleteSession(sessionId) {
    updateSchema({
      ...rootSchema,
      workout_sessions: rootSchema.workout_sessions.filter(s => s.id !== sessionId),
      e1rm_log:         rootSchema.e1rm_log.filter(e => e.session_id !== sessionId),
    });
  }

  function handleNavigateToSession(sessionId) {
    setHighlightSession(sessionId);
    setActiveTab("history");
  }

  function toggleUnits() {
    const newUnits = (rootSchema.user_profile?.units || "kg") === "kg" ? "lb" : "kg";
    updateSchema({ ...rootSchema, user_profile: { ...rootSchema.user_profile, units: newUnits } });
  }

  function handleSessionComplete({ plan, results, notes, sessionDate, sessionTime, sessionDurationMins, editingSessionId, skipProgression }) {
    const dateStr = sessionDate || new Date().toISOString().split("T")[0];
    const inst    = rootSchema.programme_instances.find(i => i.id === plan.instanceId)
                 || rootSchema.programme_instances.find(i => i.status === "active");

    const exercisesPerformed = plan.exercises.map((ex, exIdx) => ({
      exercise_id: ex.exercise_id, role: ex.role,
      set_results: ex.sets.map((set, si) => {
        const r = results[`${exIdx}-${si}`];
        return {
          set_number: si + 1, weight_kg: set.weight,
          reps_completed: r?.reps ?? (typeof set.reps === "number" ? set.reps : 0),
          reps_target: set.reps, rpe: r?.rpe ?? null,
          success: r?.done ?? false, is_warmup: set.isWarmup,
          e1rm_kg: (!set.isWarmup && (r?.reps ?? 0) > 1) ? epley(set.weight, r.reps) : null
        };
      })
    }));

    const ts        = Date.now();
    const sessionId = editingSessionId ?? `session_${dateStr}_${ts}`;
    const newE1rms  = [];
    exercisesPerformed.forEach(ex =>
      ex.set_results.filter(s => !s.is_warmup && s.e1rm_kg).forEach(s =>
        newE1rms.push({ exercise_id: ex.exercise_id, session_id: sessionId, weight_kg: s.weight_kg, reps_completed: s.reps_completed, formula_used: "epley", e1rm_kg: s.e1rm_kg })
      )
    );

    const session = {
      id: sessionId, programme_instance_id: inst?.id,
      date: dateStr,
      start_time: sessionTime || new Date().toTimeString().slice(0, 5),
      duration_minutes: sessionDurationMins ?? null,
      cycle_role: plan.role, cycle: inst?.current_cycle,
      week: plan.week, day: plan.day, notes, exercises_performed: exercisesPerformed
    };

    const prevSessions = rootSchema.workout_sessions.filter(s => s.id !== sessionId);
    const prevE1rms    = rootSchema.e1rm_log.filter(e => e.session_id !== sessionId);

    let newInsts = [...rootSchema.programme_instances];
    if (inst && !skipProgression) {
      const tmpl = rootSchema.programme_templates.find(t => t.id === inst.template_id);
      let { current_day, current_week, current_cycle } = inst;
      const maxDay  = tmpl?.days_per_week || 4;
      const maxWeek = tmpl?.cycle_structure?.mesocycle_weeks || 3;
      let cycleCompleted = false;
      current_day++;
      if (current_day > maxDay)  { current_day = 1; current_week++; }
      if (maxWeek && current_week > maxWeek) { current_week = 1; current_cycle++; cycleCompleted = true; }
      const isTmBased = tmpl?.progression_model?.type === "training_max";
      newInsts = newInsts.map(i => i.id !== inst.id ? i : {
        ...i, current_day, current_week, current_cycle,
        needs_tm_review: isTmBased && cycleCompleted ? true : (i.needs_tm_review || false)
      });
    }

    updateSchema({
      ...rootSchema,
      workout_sessions:    [...prevSessions, session],
      e1rm_log:            [...prevE1rms, ...newE1rms],
      programme_instances: newInsts
    });
  }

  // ── Loading / auth gate ───────────────────────────────────────────────────
  if (!authChecked || loading) {
    return (
      <div style={{ ...S.app, alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ color: "var(--text-muted)", fontSize: "15px", letterSpacing: "0.1em" }}>LOADING...</div>
      </div>
    );
  }
  if (!user) return <AuthPage onLogin={handleLogin} />;

  const units = rootSchema.user_profile?.units || "kg";

  const tabs = [
    { id: "session",  icon: "▶",  label: "Run"      },
    { id: "history",  icon: "≡",  label: "History"  },
    { id: "progress", icon: "↗",  label: "Stats"    },
    { id: "plates",   icon: "⊞",  label: "Plates"   },
    { id: "settings", icon: "⚙",  label: "Settings" },
  ];

  return (
    <div style={S.app}>

      {/* ── Top header ─────────────────────────────────────────────────────── */}
      <header style={S.header}>
        <span style={S.headerLogo}>Powerlift</span>
        <div style={S.headerActions}>
          <button style={S.headerBtn} onClick={() => setThemeOverride(isDark ? "light" : "dark")} title="Toggle theme">
            {isDark ? "○" : "●"}
          </button>
          {rootSchema && (
            <button style={S.headerBtn} onClick={toggleUnits} title="Toggle kg / lb">
              {units.toUpperCase()}
            </button>
          )}
          <button style={{ ...S.headerBtn, color: "var(--danger)", borderColor: "var(--danger-dim)" }}
            onClick={handleLogout} title={`Logout (${user.username})`}>
            ⏻
          </button>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div style={S.main}>
        <div style={S.content}>
          {/* SessionRunner always mounted to preserve in-session state */}
          <div style={{ display: activeTab === "session" ? "block" : "none" }}>
            <SessionRunner
              rootSchema={rootSchema} exLib={exLib}
              onSessionComplete={handleSessionComplete}
              onSchemaChange={updateSchema}
              onContextChange={setSessionContext}
              editingSession={editingSession}
              onEditDone={() => { setEditingSession(null); setActiveTab("history"); }}
            />
          </div>

          {activeTab === "history"  && <HistoryTab rootSchema={rootSchema} exLib={exLib} onEditSession={s => { setEditingSession(s); setActiveTab("session"); }} onDeleteSession={handleDeleteSession} highlightSession={highlightSession} onHighlightClear={() => setHighlightSession(null)} />}
          {activeTab === "progress" && <ProgressView rootSchema={rootSchema} units={units} onNavigateToSession={handleNavigateToSession} />}
          {activeTab === "plates"   && <PlateCalculator units={units} sessionContext={sessionContext} />}
          {activeTab === "settings" && (
            <SettingsTab
              rootSchema={rootSchema} exLib={exLib}
              onChange={updateSchema} onExLibChange={updateExLib} onRestore={handleRestore}
              themeOverride={themeOverride} isDark={isDark} onSetTheme={handleSetTheme}
            />
          )}
        </div>
      </div>

      {/* ── Bottom tab bar ─────────────────────────────────────────────────── */}
      <nav style={S.bottomNav}>
        {tabs.map(t => (
          <button key={t.id} style={S.navTab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            <span style={S.navIcon}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}

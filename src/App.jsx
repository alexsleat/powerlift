import { useState, useEffect, useRef } from "react";
import { api } from "./api.js";
import AuthPage from "./AuthPage.jsx";

// ─── THEME ────────────────────────────────────────────────────────────────────

const MONO_FONT = "ui-monospace,'SFMono-Regular','SF Mono',Menlo,Consolas,'Liberation Mono',monospace";
const SANS_FONT = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";

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
  '--role-main-bg':    '#1a2a0f',  '--role-supp-bg':    '#0f1a2a',  '--role-asst-bg': '#111124',
  '--card-active-bdr': '#2a5a7a',  '--card-done-bdr':   '#2a4a2a',
  '--font-app':        MONO_FONT,  '--radius-card':     '8px',  '--radius-btn': '6px',  '--shadow-card': 'none',
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
  '--role-main-bg':    '#f0fdf4',  '--role-supp-bg':    '#eff6ff',  '--role-asst-bg': '#f5f3ff',
  '--card-active-bdr': '#0891b2',  '--card-done-bdr':   '#16a34a',
  '--font-app':        MONO_FONT,  '--radius-card':     '8px',  '--radius-btn': '6px',  '--shadow-card': 'none',
};

const DARK_MODERN = {
  '--bg':              '#0e0e11',
  '--surface':         '#17171c',
  '--surface-2':       '#1e1e26',
  '--surface-3':       '#252530',
  '--border':          '#2c2c3a',
  '--text':            '#f0f0f6',
  '--text-muted':      '#8a8aa8',
  '--text-dim':        '#505068',
  '--accent':          '#4da6ff',
  '--accent-dim':      '#102040',
  '--success':         '#34c170',
  '--success-dim':     '#0c2a18',
  '--danger':          '#e04848',
  '--danger-dim':      '#360c0c',
  '--warning':         '#e8a020',
  '--warning-dim':     '#382008',
  '--set-done-bg':     '#0c2a18',  '--set-done-bdr':    '#1a4828',
  '--set-warmup-bg':   '#0c1828',  '--set-warmup-bdr':  '#182840',
  '--set-next-bg':     '#281e04',  '--set-next-bdr':    '#504010',
  '--set-idle-bg':     '#131318',  '--set-idle-bdr':    '#22222e',
  '--role-main-bg':    '#0f2210',  '--role-supp-bg':    '#0e1824',  '--role-asst-bg': '#13131e',
  '--card-active-bdr': '#2a4e7c',  '--card-done-bdr':   '#1e4424',
  '--font-app':        SANS_FONT,  '--radius-card':     '16px',  '--radius-btn': '12px',  '--shadow-card': '0 2px 20px rgba(0,0,0,0.3)',
};

const LIGHT_MODERN = {
  '--bg':              '#f4f4f8',
  '--surface':         '#ffffff',
  '--surface-2':       '#f0f0f6',
  '--surface-3':       '#e8e8f2',
  '--border':          '#dcdcec',
  '--text':            '#16161e',
  '--text-muted':      '#585870',
  '--text-dim':        '#9898b8',
  '--accent':          '#1a80e0',
  '--accent-dim':      '#ddeeff',
  '--success':         '#0f9c48',
  '--success-dim':     '#dcf5e8',
  '--danger':          '#c83030',
  '--danger-dim':      '#fde0e0',
  '--warning':         '#c07818',
  '--warning-dim':     '#fef3d8',
  '--set-done-bg':     '#f0fdf4',  '--set-done-bdr':    '#a8e8c0',
  '--set-warmup-bg':   '#eef4ff',  '--set-warmup-bdr':  '#b8d4f8',
  '--set-next-bg':     '#fffbea',  '--set-next-bdr':    '#f0d870',
  '--set-idle-bg':     '#ffffff',  '--set-idle-bdr':    '#dcdcec',
  '--role-main-bg':    '#edf8f2',  '--role-supp-bg':    '#eef4ff',  '--role-asst-bg': '#f4f0ff',
  '--card-active-bdr': '#1a80e0',  '--card-done-bdr':   '#0f9c48',
  '--font-app':        SANS_FONT,  '--radius-card':     '16px',  '--radius-btn': '12px',  '--shadow-card': '0 2px 12px rgba(0,0,0,0.08)',
};

function applyTheme(vars) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

function getThemeVars(isDark, skin) {
  if (skin === "modern") return isDark ? DARK_MODERN : LIGHT_MODERN;
  return isDark ? DARK : LIGHT;
}

// Apply initial theme immediately (prevents flash of wrong theme on load)
{
  const stored     = localStorage.getItem('pl-theme');
  const storedSkin = localStorage.getItem('pl-theme-skin') || 'classic';
  const sysDark    = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  const initDark   = stored === 'light' ? false : stored === 'dark' ? true : sysDark;
  applyTheme(getThemeVars(initDark, storedSkin));
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

const FONT = "var(--font-app)";
const MONO_FONT_LITERAL = MONO_FONT; // for places that always need monospace (raw JSON editor)

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
    borderRadius: "var(--radius-btn)",
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
    borderRadius: "var(--radius-card)",
    boxShadow: "var(--shadow-card)",
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
    borderRadius: "var(--radius-btn)",
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
    borderRadius: "var(--radius-btn)",
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
    borderRadius: "var(--radius-btn)",
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
      borderRadius: "var(--radius-btn)",
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
      borderRadius: "var(--radius-btn)",
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
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
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
      <textarea style={{ ...S.textarea, minHeight: "500px", color: "var(--accent)", fontSize: "13px", fontFamily: MONO_FONT_LITERAL }}
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

// Smooth cubic bezier path through points using Catmull-Rom -> Bezier conversion
function smoothSvgPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

// Full-width line chart: actual weight (primary) + optional e1RM overlay + toggleable current estimate
function LineChartWithCurrent({ points, color, showE1rm, currentEstimate, onDotClick, uid }) {
  if (!points || points.length < 2) return null;
  const W = 400, H = 140, PAD = { t: 16, b: 26, l: 46, r: 18 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;
  const clipId = `clip_${uid}`, gradId = `grad_${uid}`;

  const weightVals = points.map(p => p.y);
  const e1rmVals   = showE1rm ? points.map(p => p.e1rm) : [];
  const allY = [
    ...weightVals,
    ...e1rmVals,
    ...(showE1rm && currentEstimate != null ? [currentEstimate] : []),
  ];
  const minY = Math.min(...allY), maxY = Math.max(...allY);
  const rangeY = maxY - minY || 1;
  const lo = minY - rangeY * 0.10, hi = maxY + rangeY * 0.10;
  const span = hi - lo;

  const tx = i => PAD.l + (i / (points.length - 1)) * cW;
  const ty = v => PAD.t + (1 - (v - lo) / span) * cH;

  const svgPts     = points.map((p, i) => ({ x: tx(i), y: ty(p.y) }));
  const svgE1rmPts = showE1rm ? points.map((p, i) => ({ x: tx(i), y: ty(p.e1rm) })) : [];

  const mainPath  = smoothSvgPath(svgPts);
  const e1rmPath  = showE1rm ? smoothSvgPath(svgE1rmPts) : "";
  const areaPath  = mainPath
    + ` L ${tx(points.length - 1).toFixed(1)},${(H - PAD.b).toFixed(1)}`
    + ` L ${PAD.l.toFixed(1)},${(H - PAD.b).toFixed(1)} Z`;

  const gridVals = [lo + span * 0.25, lo + span * 0.5, lo + span * 0.75].map(v => Math.round(v));
  const col = color || "var(--accent)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.22" />
          <stop offset="100%" stopColor={col} stopOpacity="0.02" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x={PAD.l} y={PAD.t - 4} width={cW} height={cH + 8} />
        </clipPath>
      </defs>

      {/* Grid lines */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={ty(v)} x2={W - PAD.r} y2={ty(v)}
            stroke="var(--border)" strokeWidth="0.6" strokeDasharray="3,4" />
          <text x={PAD.l - 5} y={ty(v) + 3.5} fill="var(--text-dim)" fontSize="8" textAnchor="end">{v}</text>
        </g>
      ))}

      {/* Axes */}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--border)" strokeWidth="1" />
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--border)" strokeWidth="1" />

      {/* Gradient area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} clipPath={`url(#${clipId})`} />

      {/* e1RM overlay line */}
      {showE1rm && e1rmPath && (
        <>
          <path d={e1rmPath} fill="none" stroke={col} strokeWidth="1.8"
            strokeDasharray="5,3" strokeOpacity="0.55" clipPath={`url(#${clipId})`} />
          {svgE1rmPts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={col} opacity="0.45" />
          ))}
        </>
      )}

      {/* Current estimate dashed line (only when e1RM overlay is on) */}
      {showE1rm && currentEstimate != null && (
        <>
          <line x1={PAD.l} y1={ty(currentEstimate)} x2={W - PAD.r} y2={ty(currentEstimate)}
            stroke="var(--warning)" strokeWidth="1.2" strokeDasharray="4,3" opacity="0.75" />
          <text x={W - PAD.r + 2} y={ty(currentEstimate) + 3.5} fill="var(--warning)" fontSize="7.5" textAnchor="start">now</text>
        </>
      )}

      {/* Main weight line */}
      <path d={mainPath} fill="none" stroke={col} strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${clipId})`} />

      {/* Dots — clickable */}
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        return (
          <circle
            key={i}
            cx={tx(i)} cy={ty(p.y)}
            r={isLast ? 5 : 3.5}
            fill={isLast ? col : "var(--surface)"}
            stroke={col} strokeWidth="2"
            style={{ cursor: p.sessionId ? "pointer" : "default" }}
            onClick={() => p.sessionId && onDotClick?.(p)}
          />
        );
      })}

      {/* X-axis labels: first and last only */}
      <text x={tx(0)} y={H - 6} fill="var(--text-dim)" fontSize="8.5" textAnchor="middle">{points[0].x}</text>
      <text x={tx(points.length - 1)} y={H - 6} fill="var(--text-dim)" fontSize="8.5" textAnchor="middle">{points[points.length - 1].x}</text>
    </svg>
  );
}

// Bottom-sheet popup showing a session's main sets for a given exercise
function SessionPopup({ session, exerciseId, units, onClose, onNavigate }) {
  if (!session) return null;
  const ex = (session.exercises_performed || []).find(
    e => e.exercise_id === exerciseId && e.role === "main"
  );
  const mainSets = (ex?.set_results || []).filter(s => !s.is_warmup && s.reps_completed > 0);
  const liftName = LIFT_META[exerciseId]?.name || exerciseId;
  const liftColor = LIFT_META[exerciseId]?.color || "var(--accent)";

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: "16px 16px 0 0", padding: "20px 20px 36px", width: "100%", maxWidth: "480px", boxShadow: "0 -6px 32px rgba(0,0,0,0.35)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: "var(--border)", margin: "0 auto 16px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "14px" }}>
          <span style={{ fontWeight: "700", fontSize: "17px", color: liftColor }}>{liftName}</span>
          <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>{session.date}</span>
        </div>

        {mainSets.length === 0 ? (
          <div style={{ color: "var(--text-dim)", fontSize: "14px", padding: "8px 0" }}>No main sets recorded</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
            {mainSets.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "var(--bg)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-dim)", fontSize: "13px", minWidth: "36px" }}>Set {s.set_number}</span>
                <span style={{ fontWeight: "700", fontSize: "15px", flex: 1, textAlign: "center" }}>
                  {fmtW(s.weight_kg, units)} × {s.reps_completed}
                </span>
                {s.e1rm_kg && (
                  <span style={{ color: liftColor, fontSize: "13px", minWidth: "70px", textAlign: "right" }}>
                    ≈ {fmtW(s.e1rm_kg, units)} 1RM
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          style={{ width: "100%", background: "var(--accent)", color: "var(--bg)", border: "none", borderRadius: "10px", padding: "13px", fontFamily: FONT, fontSize: "14px", fontWeight: "700", cursor: "pointer", letterSpacing: "0.05em" }}
          onClick={onNavigate}
        >
          View in History →
        </button>
      </div>
    </div>
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

// Best set per session for a given exercise (main role only, highest e1RM per session)
function getSessionBestSets(exerciseId, sessions) {
  return (sessions || [])
    .map(session => {
      const mainEx = (session.exercises_performed || []).find(
        ex => ex.exercise_id === exerciseId && ex.role === "main"
      );
      if (!mainEx) return null;
      let best = null;
      (mainEx.set_results || []).forEach(s => {
        if (!s.is_warmup && s.reps_completed > 0 && s.weight_kg > 0) {
          const e1rm = epley(s.weight_kg, s.reps_completed);
          if (!best || e1rm > best.e1rm) {
            best = { weight_kg: s.weight_kg, reps: s.reps_completed, e1rm, sessionId: session.id, date: session.date };
          }
        }
      });
      return best;
    })
    .filter(Boolean)
    .sort((a, b) => (a.date > b.date ? 1 : -1));
}

// Recency-weighted current e1RM from per-session best sets
function estimateCurrentE1rmFromSets(bestSets) {
  if (!bestSets.length) return null;
  const recent = bestSets.slice(-12);
  let sumW = 0, sumWV = 0;
  recent.forEach((s, i) => {
    const w = Math.exp(i / 4);
    sumW  += w;
    sumWV += w * s.e1rm;
  });
  return sumWV / sumW;
}

// Per-exercise history for the run-tab history strip.
// Returns { recentSessions (newest first, capped at n), buckets { heavy, moderate, light } }
function getExerciseHistory(exerciseId, sessions, n, repRanges) {
  const heavyMax = repRanges?.heavy_max    ?? 5;
  const modMax   = repRanges?.moderate_max ?? 10;
  const sorted   = [...(sessions || [])].sort((a, b) => (b.date > a.date ? 1 : -1));

  const recentSessions = [];
  const buckets = { heavy: null, moderate: null, light: null };

  sorted.forEach(session => {
    let sessionBest = null;
    const sessionBuckets = { heavy: null, moderate: null, light: null };

    (session.exercises_performed || []).forEach(ex => {
      if (ex.exercise_id !== exerciseId) return;
      (ex.set_results || []).forEach(s => {
        if (s.is_warmup || !s.reps_completed || !s.weight_kg) return;
        const r    = s.reps_completed;
        const e1rm = epley(s.weight_kg, r);
        const info = { weight_kg: s.weight_kg, reps: r, date: session.date, sessionId: session.id };

        // Best per session by e1RM
        if (!sessionBest || e1rm > epley(sessionBest.weight_kg, sessionBest.reps)) sessionBest = info;

        // Best per rep-bucket within this session (highest weight at that range)
        const bk = r <= heavyMax ? "heavy" : r <= modMax ? "moderate" : "light";
        if (!sessionBuckets[bk] || s.weight_kg > sessionBuckets[bk].weight_kg) sessionBuckets[bk] = info;
      });
    });

    if (sessionBest) recentSessions.push(sessionBest);
    ["heavy", "moderate", "light"].forEach(k => {
      if (!buckets[k] && sessionBuckets[k]) buckets[k] = sessionBuckets[k];
    });
  });

  return { recentSessions: recentSessions.slice(0, n), buckets };
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
  const [sub, setSub]           = useState("lifts");
  const [e1rmVisible, setE1rmVisible] = useState({});
  const [dotPopup, setDotPopup] = useState(null); // { sessionId, exerciseId }

  const mainLifts = ["ex_squat", "ex_deadlift", "ex_bench", "ex_ohp"];
  const pfLifts   = ["ex_squat", "ex_bench", "ex_deadlift"]; // for total/Wilks/DOTS
  const sessions  = rootSchema.workout_sessions || [];
  const bwKg      = rootSchema.user_profile?.bodyweight_kg || null;

  // Per-lift data — one point per session from main sets only
  const liftData = mainLifts.map(id => {
    const bestSets = getSessionBestSets(id, sessions);

    const points = bestSets.map(s => ({
      x:         s.date.substring(5),
      y:         dspW(s.weight_kg, units),
      e1rm:      dspW(s.e1rm, units),
      sessionId: s.sessionId,
      reps:      s.reps,
    }));

    const bestKg    = bestSets.length ? Math.max(...bestSets.map(s => s.e1rm)) : null;
    const bestEntry = bestKg != null ? bestSets.find(s => s.e1rm === bestKg) : null;
    const bestDate  = bestEntry?.date || null;
    const currentKg = estimateCurrentE1rmFromSets(bestSets);
    const best10rm  = getBest10rm(id, sessions);

    return { id, ...LIFT_META[id], points, bestKg, bestDate, bestEntry, currentKg, best10rm };
  });

  const popupSession = dotPopup ? sessions.find(s => s.id === dotPopup.sessionId) : null;

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
      {/* Session dot popup */}
      {dotPopup && (
        <SessionPopup
          session={popupSession}
          exerciseId={dotPopup.exerciseId}
          units={units}
          onClose={() => setDotPopup(null)}
          onNavigate={() => { setDotPopup(null); onNavigateToSession?.(dotPopup.sessionId); }}
        />
      )}

      <div style={S.h1}>Stats</div>
      <div style={S.subNav}>
        <button style={S.btn(sub === "lifts"  ? "active" : "default")} onClick={() => setSub("lifts")}>Lifts</button>
        <button style={S.btn(sub === "totals" ? "active" : "default")} onClick={() => setSub("totals")}>Totals</button>
        <button style={S.btn(sub === "volume" ? "active" : "default")} onClick={() => setSub("volume")}>Volume</button>
      </div>

      {/* ── Lifts tab ── */}
      {sub === "lifts" && (
        <>
          {liftData.map(lift => {
            const showE1rm = !!e1rmVisible[lift.id];
            return (
            <div key={lift.id} style={S.card}>
              {/* Card header */}
              <div style={{ ...S.cardHead, flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontWeight: "700", color: lift.color, fontSize: "16px" }}>{lift.name}</span>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginLeft: "auto", alignItems: "center" }}>
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
              <div style={{ padding: "8px 8px 0" }}>
                {lift.points.length >= 2 ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "4px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-dim)", letterSpacing: "0.04em" }}>Top set weight</span>
                      <button
                        style={{ background: showE1rm ? lift.color : "transparent", color: showE1rm ? "var(--bg)" : "var(--text-dim)", border: `1px solid ${showE1rm ? lift.color : "var(--border)"}`, borderRadius: "5px", padding: "3px 9px", fontSize: "11px", cursor: "pointer", fontFamily: FONT, letterSpacing: "0.04em", fontWeight: showE1rm ? "700" : "400" }}
                        onClick={() => setE1rmVisible(v => ({ ...v, [lift.id]: !v[lift.id] }))}
                      >
                        e1RM
                      </button>
                    </div>
                    <LineChartWithCurrent
                      points={lift.points}
                      color={lift.color}
                      showE1rm={showE1rm}
                      currentEstimate={lift.currentKg != null ? dspW(lift.currentKg, units) : null}
                      onDotClick={pt => setDotPopup({ sessionId: pt.sessionId, exerciseId: lift.id })}
                      uid={lift.id}
                    />
                  </>
                ) : (
                  <div style={{ color: "var(--text-dim)", fontSize: "14px", padding: "16px 0", textAlign: "center" }}>
                    Log at least 2 sessions to see chart
                  </div>
                )}
              </div>

              {/* Best records row */}
              <div style={{ padding: "8px 12px 14px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {/* Best 1RM */}
                {lift.bestEntry && (
                  <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 12px", flex: "1 1 130px" }}>
                    <div style={S.label}>Best 1RM</div>
                    <div style={{ fontWeight: "700", color: "var(--text)", fontSize: "15px" }}>{fmtW(lift.bestKg, units)}</div>
                    <button
                      style={{ background: "transparent", border: "none", color: "var(--accent)", fontSize: "13px", cursor: "pointer", padding: "2px 0", fontFamily: FONT }}
                      onClick={() => onNavigateToSession?.(lift.bestEntry.sessionId)}>
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
          ); })}
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
    const exercises  = [];
    if (waveWeek.is_deload) {
      exercises.push({ exercise_id: mainLift.exercise_id, role: "main", label: "Deload",
        sets: waveWeek.deload_sets.map((s, i) => ({ setIndex: i, weight: roundToNearest(s.tm_pct * tm, 2.5), reps: s.reps, isWarmup: false, isDone: false, repsLogged: null, rpeLogged: null })) });
    } else {
      const isAmrap    = roleConfig?.amrap_sets ?? true;
      const warmupObjs = waveWeek.warmup_sets
        ? waveWeek.warmup_sets.map(s => ({ weight: roundToNearest(s.tm_pct * tm, 2.5), reps: s.reps }))
        : calcWarmupSets(roundToNearest(waveWeek.core_sets[0].tm_pct * tm, 2.5), tmpl.warmup_protocol?.start_weight_kg ?? 20, tmpl.warmup_protocol?.max_warmup_sets ?? 3);
      const mainSets   = waveWeek.core_sets.map((s, i) => {
        const w    = roundToNearest(s.tm_pct * tm, 2.5);
        const reps = s.reps === "amrap" && !isAmrap ? 5 : s.reps;
        return { setIndex: i, weight: w, reps, isAmrap: s.reps === "amrap" && isAmrap, amrap_minimum: s.amrap_minimum, isWarmup: false, isDone: false, repsLogged: null, rpeLogged: null };
      });
      exercises.push({ exercise_id: mainLift.exercise_id, role: "main",
        sets: [...warmupObjs.map((w, i) => ({ setIndex: i, weight: w.weight, reps: w.reps, isWarmup: true, isDone: false, repsLogged: null, rpeLogged: null })), ...mainSets] });
      const fslConfig = waveWeek.fsl || (roleConfig?.supplemental?.type === "FSL" ? { sets: roleConfig.supplemental.sets, reps: roleConfig.supplemental.reps, tm_pct: waveWeek.core_sets[0].tm_pct } : null);
      if (fslConfig) {
        const fslW = roundToNearest(fslConfig.tm_pct * tm, 2.5);
        exercises.push({ exercise_id: mainLift.exercise_id, role: "supplemental", label: "FSL Back-off",
          sets: Array.from({ length: fslConfig.sets }, (_, i) => ({ setIndex: i, weight: fslW, reps: fslConfig.reps, isWarmup: false, isDone: false, repsLogged: null, rpeLogged: null })) });
      }
      (ph.assistance_by_day?.[String(day)] || []).forEach(a =>
        exercises.push({ exercise_id: a.exercise_id, role: "assistance",
          sets: Array.from({ length: a.sets }, (_, i) => ({ setIndex: i, weight: 0, reps: a.reps ?? a.reps_is_seconds ?? 0, isWarmup: false, isDone: false, repsLogged: null, rpeLogged: null })) })
      );
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

  // StrongLifts (and other linear-weight A/B templates)
  if (ph.workout_templates) {
    // Alternate by cumulative session count, not day-of-week — the 6-long A/B
    // pattern never advances past the weekly day reset otherwise, so every week
    // runs A,B,A permanently (C2).
    const daysPerWeek   = tmpl.days_per_week || 3;
    const weeksPerCycle = tmpl.cycle_structure?.mesocycle_weeks || 3;
    const sessionNumber = ((inst.current_cycle || 1) - 1) * weeksPerCycle * daysPerWeek
                        + ((inst.current_week || 1) - 1) * daysPerWeek
                        + ((inst.current_day || 1) - 1);
    const patIdx  = sessionNumber % ph.session_alternation_pattern.length;
    const key     = ph.session_alternation_pattern[patIdx];
    const exercises = ph.workout_templates[key].map(te => {
      // Working weight is tracked per lift on the instance and advanced by the
      // linear-progression logic on completion (C1). Fall back to a seed for
      // instances/lifts predating working_weights (empty bar when no 1RM data).
      const wwEntry = inst.working_weights?.find(w => w.exercise_id === te.exercise_id);
      const liftW   = rootSchema?.lift_maxes?.find(l => l.exercise_id === te.exercise_id)?.one_rm_kg;
      const seedW   = liftW ? roundToNearest(liftW * 0.7, 2.5) : 20;
      const workW   = Math.max(wwEntry?.weight_kg ?? seedW, 20);
      const warmups = te.set_scheme_type !== "single_top_set" ? calcWarmupSets(workW, tmpl.warmup_protocol.start_weight_kg, tmpl.warmup_protocol.max_warmup_sets) : [{ weight: 20, reps: 5 }];
      const work    = Array.from({ length: te.sets }, (_, i) => ({ setIndex: i, weight: workW, reps: te.reps, isWarmup: false, isDone: false, repsLogged: null, rpeLogged: null }));
      return { exercise_id: te.exercise_id, role: te.role,
        sets: [...warmups.map((w, i) => ({ setIndex: i, weight: w.weight, reps: w.reps, isWarmup: true, isDone: false, repsLogged: null, rpeLogged: null })), ...work] };
    });
    return { exercises, week: inst.current_week, day: inst.current_day, weekLabel: `Workout ${key}`, role: null, mainLiftId: null, instanceId: inst.id };
  }
  return null;
}

// Linear-weight progression (e.g. StrongLifts): advance each performed main
// lift's working weight — increment on a fully successful session, repeat the
// weight on failure, and deload after N consecutive failures (C1).
function updateLinearWeights(inst, tmpl, exercisesPerformed) {
  const pm = tmpl?.progression_model || {};
  const fh = pm.failure_handling || {};
  const deloadPct   = fh.deload_percentage ?? 0.1;
  const deloadAfter = fh.deload_after_consecutive_failures ?? 3;
  const incFor = (exId) => {
    const li = (pm.lift_increments || []).find(x => x.exercises?.includes(exId) || x.exercise_id === exId);
    return li?.increment_kg ?? 2.5;
  };
  const ww = [...(inst.working_weights || [])];
  for (const ex of exercisesPerformed) {
    if (ex.role !== "main") continue;
    const workSets = ex.set_results.filter(s => !s.is_warmup);
    if (workSets.length === 0) continue;
    const success = workSets.every(s => Number(s.reps_completed) >= Number(s.reps_target) && Number(s.reps_target) > 0);
    let idx = ww.findIndex(w => w.exercise_id === ex.exercise_id);
    if (idx < 0) {
      ww.push({ exercise_id: ex.exercise_id, weight_kg: workSets[0].weight_kg, consecutive_fails: 0 });
      idx = ww.length - 1;
    }
    const entry = ww[idx];
    if (success) {
      ww[idx] = { ...entry, weight_kg: roundToNearest(entry.weight_kg + incFor(ex.exercise_id), 2.5), consecutive_fails: 0 };
    } else {
      const fails = (entry.consecutive_fails || 0) + 1;
      ww[idx] = fails >= deloadAfter
        ? { ...entry, weight_kg: Math.max(roundToNearest(entry.weight_kg * (1 - deloadPct), 2.5), 20), consecutive_fails: 0 }
        : { ...entry, consecutive_fails: fails };
    }
  }
  return ww;
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
  const fh            = tmpl?.progression_model?.failure_handling || {};
  const usesAmrapGate = fh.tm_reset_rule === "if_amrap_below_expected";
  const resetPct      = fh.tm_reset_percentage ?? 0.1;

  function getBestE1rm(exerciseId) {
    const entries = rootSchema.e1rm_log?.filter(e => e.exercise_id === exerciseId) || [];
    if (entries.length === 0) return null;
    return Math.max(...entries.map(e => e.e1rm_kg));
  }

  // Flexible AMRAP gate: reset the TM instead of incrementing only when the
  // template opts in via tm_reset_rule AND the lift actually performed AMRAP
  // sets that fell short of their minimum in the latest cycle. 5s PRO variants
  // (amrap_sets: false) log no AMRAP sets, so they always take the increment.
  function amrapShortfall(exerciseId) {
    if (!usesAmrapGate) return false;
    const sessions = (rootSchema.workout_sessions || []).filter(s => s.programme_instance_id === inst.id);
    if (sessions.length === 0) return false;
    const latestCycle = Math.max(...sessions.map(s => s.cycle ?? 0));
    let sawAmrap = false, met = false;
    for (const s of sessions) {
      if ((s.cycle ?? 0) !== latestCycle) continue;
      for (const ex of (s.exercises_performed || [])) {
        if (ex.exercise_id !== exerciseId) continue;
        for (const set of (ex.set_results || [])) {
          if (!set.is_amrap) continue;
          sawAmrap = true;
          if (set.amrap_min == null || Number(set.reps_completed) >= Number(set.amrap_min)) met = true;
        }
      }
    }
    return sawAmrap && !met;
  }

  const [newTMs, setNewTMs] = useState(() =>
    inst.training_maxes.map(tm => {
      const inc   = increments.find(li => li.exercises?.includes(tm.exercise_id) || li.exercise_id === tm.exercise_id);
      const delta = inc?.increment_kg || 0;
      const reset = amrapShortfall(tm.exercise_id);
      const new_kg = reset ? roundToNearest(tm.tm_kg * (1 - resetPct), 2.5) : tm.tm_kg + delta;
      return { exercise_id: tm.exercise_id, current_kg: tm.tm_kg, new_kg, reset };
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
          {newTMs.some(t => t.reset) && (
            <div style={{ color: "var(--danger)", fontSize: "14px", marginBottom: "12px", fontWeight: "bold" }}>
              ⚠ One or more lifts missed the AMRAP minimum last cycle — their TM is suggested down {Math.round(resetPct * 100)}% instead of up.
            </div>
          )}
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
                      {tm.reset && (
                        <div style={{ color: "var(--danger)", fontSize: "12px", marginTop: "3px" }}>
                          AMRAP missed · reset −{Math.round(resetPct * 100)}%
                        </div>
                      )}
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
    rows = ph.wave_weeks.filter(ww => !ww.is_deload && ww.core_sets).map(ww => ({
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
    // Seed per-lift working weights for linear-progression templates (C1).
    const working_weights = tmpl.progression_model?.type === "linear_weight"
      ? exIds.map(exId => {
          const oneRm = getOneRmKg(exId);
          const seed  = oneRm ? Math.max(roundToNearest(oneRm * 0.7, 2.5), 20) : 20;
          return { exercise_id: exId, weight_kg: seed, consecutive_fails: 0 };
        })
      : [];
    const newInst = {
      id: `prog_inst_${Date.now()}`, template_id: selectedId, status: "active",
      started_date: today,
      current_phase_id: tmpl.phases?.[0]?.phase_id || null,
      current_cycle_role: selectedId === "531_fsl" ? "leader" : "standard",
      current_macrocycle_block: 1, current_cycle: 1, current_week: 1, current_day: 1,
      training_maxes, working_weights, failure_tracking: [], phase_history: [], needs_tm_review: false
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

function SettingsTab({ rootSchema, exLib, onChange, onExLibChange, onRestore, themeOverride, onSetTheme, themeSkin, onSetThemeSkin }) {
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
            <div style={{ marginBottom: "14px" }}>
              <div style={{ ...S.label, marginBottom: "8px" }}>Style</div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button style={S.btn(themeSkin === "classic" ? "active" : "default")} onClick={() => onSetThemeSkin("classic")}>Classic Nerd</button>
                <button style={S.btn(themeSkin === "modern"  ? "active" : "default")} onClick={() => onSetThemeSkin("modern")}>Modern</button>
              </div>
            </div>
            <div>
              <div style={{ ...S.label, marginBottom: "8px" }}>Mode</div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button style={S.btn(!themeOverride ? "active" : "default")} onClick={() => onSetTheme(null)}>Auto (system)</button>
                <button style={S.btn(themeOverride === "light" ? "active" : "default")} onClick={() => onSetTheme("light")}>Light</button>
                <button style={S.btn(themeOverride === "dark"  ? "active" : "default")} onClick={() => onSetTheme("dark")}>Dark</button>
              </div>
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

          <SchemaSection title="Workout History" defaultOpen={false}>
            {(() => {
              const histDefault = rootSchema.user_profile?.history_strip_default_open ?? false;
              const histSessions = rootSchema.user_profile?.history_strip_sessions ?? 4;
              const rr = rootSchema.user_profile?.rep_ranges || { heavy_max: 5, moderate_max: 10 };
              return (
                <>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={S.label}>History strip default state</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button style={S.btn(!histDefault ? "active" : "default")} onClick={() => updateProfile("history_strip_default_open", false)}>Collapsed</button>
                      <button style={S.btn(histDefault  ? "active" : "default")} onClick={() => updateProfile("history_strip_default_open", true)}>Open</button>
                    </div>
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={S.label}>Sessions to show</label>
                    <input style={{ ...S.input, width: "100px" }} type="number" min="1" max="20" step="1"
                      value={histSessions}
                      onChange={e => updateProfile("history_strip_sessions", Math.max(1, parseInt(e.target.value) || 4))} />
                  </div>
                  <div>
                    <label style={S.label}>Rep range boundaries</label>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "6px" }}>
                      <div>
                        <label style={{ ...S.label, fontSize: "12px" }}>Heavy max (1–?)</label>
                        <input style={{ ...S.input, width: "80px" }} type="number" min="1" max="20" step="1"
                          value={rr.heavy_max}
                          onChange={e => updateProfile("rep_ranges", { ...rr, heavy_max: Math.max(1, parseInt(e.target.value) || 5) })} />
                      </div>
                      <div>
                        <label style={{ ...S.label, fontSize: "12px" }}>Moderate max (?–?)</label>
                        <input style={{ ...S.input, width: "80px" }} type="number" min="2" max="50" step="1"
                          value={rr.moderate_max}
                          onChange={e => updateProfile("rep_ranges", { ...rr, moderate_max: Math.max(rr.heavy_max + 1, parseInt(e.target.value) || 10) })} />
                      </div>
                    </div>
                    <div style={{ color: "var(--text-dim)", fontSize: "12px", marginTop: "6px" }}>
                      Heavy 1–{rr.heavy_max} · Moderate {rr.heavy_max + 1}–{rr.moderate_max} · Light {rr.moderate_max + 1}+
                    </div>
                  </div>
                </>
              );
            })()}
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

// ─── EXERCISE HISTORY STRIP ───────────────────────────────────────────────────

function ExHistoryStrip({ exerciseId, role, sessions, units, n, repRanges, isOpen, onToggle, onNavigateToStats }) {
  const hist      = getExerciseHistory(exerciseId, sessions, n, repRanges);
  const isMain    = role === "main";
  const hasStats  = !!LIFT_META[exerciseId];
  const heavyMax  = repRanges?.heavy_max    ?? 5;
  const modMax    = repRanges?.moderate_max ?? 10;

  const noData = isMain
    ? hist.recentSessions.length === 0
    : !hist.buckets.heavy && !hist.buckets.moderate && !hist.buckets.light;

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      {/* Toggle row */}
      <div
        onClick={onToggle}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 12px", cursor: "pointer", background: "var(--surface-2)", userSelect: "none" }}
      >
        <span style={{ color: "var(--text-dim)", fontSize: "11px", letterSpacing: "0.07em", textTransform: "uppercase" }}>History</span>
        <span style={{ color: "var(--text-dim)", fontSize: "11px" }}>{isOpen ? "▴" : "▾"}</span>
      </div>

      {isOpen && (
        <div style={{ background: "var(--surface-2)", padding: "6px 12px 10px" }}>
          {noData ? (
            <div style={{ color: "var(--text-dim)", fontSize: "13px" }}>No history yet</div>
          ) : isMain ? (
            /* Main lift — last N sessions */
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {hist.recentSessions.map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ color: "var(--text-dim)", fontSize: "12px", flexShrink: 0 }}>{s.date}</span>
                  <span style={{ fontWeight: "700", fontSize: "14px", color: "var(--text)" }}>
                    {fmtW(s.weight_kg, units)} × {s.reps}
                  </span>
                  <span style={{ color: "var(--text-dim)", fontSize: "11px", flexShrink: 0 }}>
                    ≈ {fmtW(Math.round(epley(s.weight_kg, s.reps)), units)} 1RM
                  </span>
                </div>
              ))}
              {hasStats && (
                <button
                  style={{ alignSelf: "flex-start", background: "transparent", border: "none", color: "var(--accent)", fontSize: "12px", cursor: "pointer", padding: "4px 0 0", fontFamily: FONT }}
                  onClick={e => { e.stopPropagation(); onNavigateToStats?.(); }}
                >
                  → Stats
                </button>
              )}
            </div>
          ) : (
            /* Accessory — heavy / moderate / light buckets */
            <div style={{ display: "flex", gap: "6px" }}>
              {[
                { key: "heavy",    label: "Heavy",    range: `1–${heavyMax}` },
                { key: "moderate", label: "Moderate", range: `${heavyMax + 1}–${modMax}` },
                { key: "light",    label: "Light",    range: `${modMax + 1}+` },
              ].map(({ key, label, range }) => {
                const s = hist.buckets[key];
                return (
                  <div key={key} style={{ flex: "1 1 0", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 8px", minWidth: 0 }}>
                    <div style={{ color: "var(--text-dim)", fontSize: "10px", letterSpacing: "0.04em", marginBottom: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {label} ({range})
                    </div>
                    {s ? (
                      <>
                        <div style={{ fontWeight: "700", fontSize: "13px", color: "var(--text)" }}>{fmtW(s.weight_kg, units)} × {s.reps}</div>
                        <div style={{ color: "var(--text-dim)", fontSize: "11px" }}>{s.date.substring(5)}</div>
                      </>
                    ) : (
                      <div style={{ color: "var(--text-dim)", fontSize: "12px" }}>—</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SESSION RUNNER ───────────────────────────────────────────────────────────

function SessionRunner({ rootSchema, exLib, onSessionComplete, onSchemaChange, onContextChange, editingSession, onEditDone, onNavigateToStats }) {
  const units           = rootSchema.user_profile?.units || "kg";
  const restDefs        = rootSchema.user_profile?.rest_defaults_seconds || DEFAULT_REST;
  const histDefaultOpen = rootSchema.user_profile?.history_strip_default_open ?? false;
  const histN           = rootSchema.user_profile?.history_strip_sessions ?? 4;
  const repRanges       = rootSchema.user_profile?.rep_ranges || { heavy_max: 5, moderate_max: 10 };
  const isModern        = (rootSchema.user_profile?.theme || 'classic') === 'modern';

  const [phase,           setPhase]           = useState("pick");
  const [selectedInstId,  setSelectedInstId]  = useState(() => {
    const active = rootSchema.programme_instances.find(i => i.status === "active");
    return active?.id || null;
  });
  const [sessionPlan,     setSessionPlan]     = useState(null);
  const [currentExIdx,    setCurrentExIdx]    = useState(0);
  const [expandedSet,     setExpandedSet]     = useState(new Set([0]));
  const [histOpenSet,     setHistOpenSet]     = useState(new Set());  // tracks which exIdx are explicitly toggled
  const [viewExIdx,       setViewExIdx]       = useState(0);           // Modern theme: which exercise card is shown
  const [showExOverlay,   setShowExOverlay]   = useState(false);       // Modern theme: session overview overlay
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

  // ── Session draft (crash recovery) ─────────────────────────────────────────
  const DRAFT_KEY = 'pl-session-draft';

  const [draftOffer, setDraftOffer] = useState(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

  function restoreDraft(draft) {
    setSessionPlan(draft.sessionPlan);
    setSetResults(draft.setResults || {});
    setWeightOverrides(draft.weightOverrides || {});
    setCurrentExIdx(draft.currentExIdx || 0);
    setSessionNotes(draft.sessionNotes || "");
    setSessionDate(draft.sessionDate || new Date().toISOString().split("T")[0]);
    setSessionTime(draft.sessionTime || new Date().toTimeString().slice(0, 5));
    setExpandedSet(new Set([draft.currentExIdx || 0]));
    sessionStartTsRef.current = draft.sessionStartTs || Date.now();
    setResting(false);
    setDraftOffer(null);
    setViewExIdx(draft.currentExIdx || 0);
    setShowExOverlay(false);
    setPhase("session");
  }

  // Auto-save draft whenever session state changes
  useEffect(() => {
    if (phase !== "session" || !sessionPlan || sessionPlan.editingSessionId) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        sessionPlan, setResults, weightOverrides, currentExIdx,
        sessionNotes, sessionDate, sessionTime,
        sessionStartTs: sessionStartTsRef.current,
      }));
    } catch { /* storage full — ignore */ }
  }, [phase, sessionPlan, setResults, weightOverrides, currentExIdx, sessionNotes, sessionDate, sessionTime]);

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
    setViewExIdx(0);
    setShowExOverlay(false);
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
      // Only cascade weight to subsequent sets for assistance exercises (not main/supplemental
      // which have prescribed per-set weights that should remain unchanged)
      if (!currentSetIsWarmup && ex.role === "assistance") {
        ex.sets.forEach((s, i) => {
          if (i > setIdx && !s.isWarmup && !setResults[`${exIdx}-${i}`]?.done)
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

  // History strip: actual open state = default XOR explicitly toggled
  function isHistOpen(idx) { return histOpenSet.has(idx) ? !histDefaultOpen : histDefaultOpen; }
  function toggleHistOpen(idx) {
    setHistOpenSet(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
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
    clearDraft();
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
    setViewExIdx(0);
    setShowExOverlay(false);
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
    const activeExIdx = isModern ? viewExIdx : currentExIdx;
    const isNext = !done && exIdx === activeExIdx &&
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

  // ── Render: Session Overview Overlay (Modern) ───────────────────────────────
  function SessionOverviewOverlay() {
    return (
      <div
        style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }}
        onClick={() => setShowExOverlay(false)}
      >
        <div
          style={{ background: "var(--surface)", borderRadius: "var(--radius-card) var(--radius-card) 0 0", width: "100%", maxHeight: "82vh", overflowY: "auto", padding: "20px 16px 32px", boxShadow: "0 -8px 32px rgba(0,0,0,0.35)" }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ width: "40px", height: "4px", background: "var(--border)", borderRadius: "2px", margin: "0 auto 20px" }} />
          <div style={{ fontWeight: "700", fontSize: "18px", marginBottom: "16px" }}>{sessionPlan.weekLabel}</div>

          {sessionPlan.exercises.map((exItem, i) => {
            const exInfo   = getExercise(exItem.exercise_id, rootSchema, exLib);
            const wc       = exItem.sets.filter(s => s.isWarmup).length;
            const workSets = exItem.sets.filter(s => !s.isWarmup);
            const doneCnt  = workSets.filter((_, j) => setResults[`${i}-${wc + j}`]?.done).length;
            const isDone   = doneCnt === workSets.length && workSets.length > 0;
            const isCur    = i === viewExIdx;
            const rColor   = exItem.role === "main" ? "var(--role-main-bg)" : exItem.role === "supplemental" ? "var(--role-supp-bg)" : "var(--role-asst-bg)";
            const rLabel   = exItem.role === "main" ? "MAIN" : exItem.role === "supplemental" ? "SUPP" : "ASST";

            return (
              <button key={i}
                onClick={() => { setViewExIdx(i); setShowExOverlay(false); }}
                style={{ display: "block", width: "100%", textAlign: "left", background: isCur ? "var(--accent-dim)" : isDone ? "var(--success-dim)" : "var(--surface-2)", border: `1px solid ${isCur ? "var(--card-active-bdr)" : isDone ? "var(--card-done-bdr)" : "var(--border)"}`, borderRadius: "var(--radius-btn)", padding: "12px 14px", marginBottom: "8px", cursor: "pointer", fontFamily: FONT }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  {isDone && <span style={{ color: "var(--success)" }}>✓</span>}
                  {isCur && !isDone && <span style={{ color: "var(--accent)" }}>▶</span>}
                  <span style={S.badge(rColor)}>{rLabel}</span>
                  <span style={{ fontWeight: "700", fontSize: "16px", color: isDone ? "var(--success)" : isCur ? "var(--accent)" : "var(--text)" }}>{exInfo.name}</span>
                  <span style={{ marginLeft: "auto", color: "var(--text-dim)", fontSize: "13px" }}>{doneCnt}/{workSets.length}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {workSets.map((set, si) => {
                    const res = setResults[`${i}-${wc + si}`];
                    const w   = weightOverrides[`${i}-${wc + si}`] ?? weightOverrides[`${i}-all`] ?? set.weight;
                    const wTxt = w > 0 ? fmtW(w, units) : "—";
                    const rTxt = res?.done ? `${res.reps}` : set.reps === "amrap" ? "AMRAP" : `${set.reps}`;
                    return (
                      <span key={si} style={{ fontSize: "12px", padding: "3px 8px", borderRadius: "4px", background: res?.done ? "var(--set-done-bg)" : "var(--set-idle-bg)", border: `1px solid ${res?.done ? "var(--set-done-bdr)" : "var(--set-idle-bdr)"}`, color: res?.done ? "var(--success)" : "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {wTxt}×{rTxt}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}

          <button style={{ ...S.btn("ghost"), width: "100%", marginTop: "4px" }} onClick={() => setShowExOverlay(false)}>Close</button>
        </div>
      </div>
    );
  }

  // ── Render: ModernSessionPhase ───────────────────────────────────────────────
  function ModernSessionPhase() {
    const totalEx  = sessionPlan.exercises.length;
    const ex       = sessionPlan.exercises[viewExIdx];
    const exInfo   = getExercise(ex.exercise_id, rootSchema, exLib);
    const warmups  = ex.sets.filter(s => s.isWarmup);
    const workSets = ex.sets.filter(s => !s.isWarmup);
    const doneCnt  = workSets.filter((_, i) => setResults[`${viewExIdx}-${warmups.length + i}`]?.done).length;
    const allDone  = workSets.length > 0 && doneCnt === workSets.length;

    const doneExCnt = sessionPlan.exercises.filter((exItem, i) => {
      const wc = exItem.sets.filter(s => s.isWarmup).length;
      return exItem.sets.filter(s => !s.isWarmup).every((_, j) => setResults[`${i}-${wc + j}`]?.done);
    }).length;
    const allExDone = doneExCnt === totalEx;

    const prevEx   = viewExIdx > 0 ? sessionPlan.exercises[viewExIdx - 1] : null;
    const nextEx   = viewExIdx < totalEx - 1 ? sessionPlan.exercises[viewExIdx + 1] : null;
    const prevName = prevEx ? getExercise(prevEx.exercise_id, rootSchema, exLib).name : null;
    const nextName = nextEx ? getExercise(nextEx.exercise_id, rootSchema, exLib).name : null;
    const rColor   = ex.role === "main" ? "var(--role-main-bg)" : ex.role === "supplemental" ? "var(--role-supp-bg)" : "var(--role-asst-bg)";
    const rLabel   = ex.role === "main" ? "MAIN" : ex.role === "supplemental" ? "SUPP" : "ASST";

    const logModalData    = logModal    ? sessionPlan.exercises[logModal.exIdx]?.sets[logModal.setIdx]    : null;
    const weightModalData = weightModal ? sessionPlan.exercises[weightModal.exIdx]?.sets[weightModal.setIdx] : null;

    return (
      <div>
        {/* Modals */}
        {logModal && logModalData && (
          <LogSetModal
            set={{ ...logModalData, weight: logModal.editWeight ?? getEffectiveWeight(logModal.exIdx, logModal.setIdx, logModalData) }}
            setLabel={`${getExercise(sessionPlan.exercises[logModal.exIdx].exercise_id, rootSchema, exLib).name} — Set ${logModal.setIdx + 1}`}
            onConfirm={(reps, rpe, weightKg) => logSet(logModal.exIdx, logModal.setIdx, reps, rpe, weightKg)}
            onClose={() => setLogModal(null)} units={units}
            defaultRpe={logModal.editRpe ?? lastRpeByExId[sessionPlan.exercises[logModal.exIdx]?.exercise_id]}
            defaultReps={logModal.editReps} isEdit={!!logModal.editReps}
          />
        )}
        {weightModal && weightModalData && (
          <EditWeightModal weight={weightModal.weight} units={units}
            onClose={() => setWeightModal(null)}
            onConfirm={(kg, applyAll) => applyWeightOverride(weightModal.exIdx, weightModal.setIdx, kg, applyAll)}
          />
        )}
        {showExOverlay && SessionOverviewOverlay()}

        {/* Session header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "700" }}>{sessionPlan.weekLabel}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "2px" }}>Day {sessionPlan.day}</div>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button style={S.btnSm("warning")} onClick={() => { setPhase("summary"); setResting(false); }}>Save</button>
            <button style={S.btnSm("danger")}  onClick={() => { clearDraft(); setPhase("pick"); setResting(false); }}>Abandon</button>
          </div>
        </div>

        {/* Progress pill dots */}
        <div style={{ display: "flex", gap: "5px", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
          {sessionPlan.exercises.map((exItem, i) => {
            const wc   = exItem.sets.filter(s => s.isWarmup).length;
            const ws   = exItem.sets.filter(s => !s.isWarmup);
            const done = ws.every((_, j) => setResults[`${i}-${wc + j}`]?.done) && ws.length > 0;
            const cur  = i === viewExIdx;
            return (
              <button key={i} onClick={() => setViewExIdx(i)}
                style={{ width: cur ? "24px" : "8px", height: "8px", borderRadius: "4px", background: done ? "var(--success)" : cur ? "var(--accent)" : "var(--border)", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, transition: "width 0.2s, background 0.2s" }}
              />
            );
          })}
          <span style={{ color: "var(--text-dim)", fontSize: "12px", marginLeft: "4px" }}>{doneExCnt}/{totalEx}</span>
        </div>

        {resting && <RestTimer key={restKey} seconds={restSeconds} onDone={() => setResting(false)} />}

        {/* Exercise card */}
        <div style={{ background: "var(--surface)", border: `2px solid ${allDone ? "var(--card-done-bdr)" : "var(--card-active-bdr)"}`, borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", overflow: "hidden", marginBottom: "14px" }}>
          <div style={{ padding: "16px 16px 12px", background: allDone ? "var(--success-dim)" : "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={S.badge(rColor)}>{rLabel}</span>
              <span style={{ fontWeight: "700", fontSize: "20px", color: allDone ? "var(--success)" : "var(--text)" }}>{exInfo.name}</span>
              {allDone && <span style={{ color: "var(--success)", fontSize: "18px", marginLeft: "auto" }}>✓</span>}
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: "13px", marginTop: "4px" }}>{doneCnt}/{workSets.length} sets done</div>
          </div>
          <div style={{ padding: "12px" }}>
            {ex.sets.map((set, setIdx) => SetRow({ exIdx: viewExIdx, setIdx, set }))}
          </div>
          <ExHistoryStrip
            exerciseId={ex.exercise_id} role={ex.role}
            sessions={rootSchema.workout_sessions || []} units={units}
            n={histN} repRanges={repRanges}
            isOpen={isHistOpen(viewExIdx)} onToggle={() => toggleHistOpen(viewExIdx)}
            onNavigateToStats={onNavigateToStats}
          />
        </div>

        {/* Prev / Next navigation */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <button style={{ ...S.btn(prevEx ? "default" : "ghost"), flex: 1, fontSize: "14px", opacity: prevEx ? 1 : 0.3 }}
            disabled={!prevEx} onClick={() => setViewExIdx(v => v - 1)}>
            ◀ {prevName || "—"}
          </button>
          <button style={{ ...S.btn(nextEx ? "default" : "ghost"), flex: 1, fontSize: "14px", opacity: nextEx ? 1 : 0.3 }}
            disabled={!nextEx} onClick={() => setViewExIdx(v => v + 1)}>
            {nextName || "—"} ▶
          </button>
        </div>

        {/* All Done / Finish */}
        {allDone && (
          allExDone
            ? <button style={{ ...S.btn("success"), width: "100%", fontSize: "16px", padding: "14px", marginBottom: "8px" }}
                onClick={() => { setPhase("summary"); setResting(false); }}>
                Finish Session ✓
              </button>
            : nextEx
              ? <button style={{ ...S.btn("success"), width: "100%", fontSize: "16px", padding: "14px", marginBottom: "8px" }}
                  onClick={() => setViewExIdx(v => v + 1)}>
                  All Done · {nextName} ▶
                </button>
              : null
        )}

        {/* Session overview */}
        <button style={{ ...S.btn("ghost"), width: "100%", fontSize: "14px" }} onClick={() => setShowExOverlay(true)}>
          ≡ Session overview
        </button>
      </div>
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
          <ExHistoryStrip
            exerciseId={ex.exercise_id}
            role={ex.role}
            sessions={rootSchema.workout_sessions || []}
            units={units}
            n={histN}
            repRanges={repRanges}
            isOpen={isHistOpen(exIdx)}
            onToggle={() => toggleHistOpen(exIdx)}
            onNavigateToStats={onNavigateToStats}
          />
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
      clearDraft();
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
        setViewExIdx(0);
        setShowExOverlay(false);
        setPhase("session");
      } else {
        startSession();
      }
    }

    return (
      <div>
        <div style={S.h1}>Start Session</div>

        {draftOffer && !editingSession && (
          <div style={{ ...S.card, border: "1px solid var(--warning)", marginBottom: "16px" }}>
            <div style={S.cardBody}>
              <div style={{ color: "var(--warning)", fontWeight: "700", fontSize: "15px", marginBottom: "6px" }}>Unsaved session found</div>
              <div style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "14px" }}>
                {draftOffer.sessionPlan?.weekLabel} — Day {draftOffer.sessionPlan?.day}
                {draftOffer.sessionDate ? ` · ${draftOffer.sessionDate}` : ""}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button style={{ ...S.btn("primary"), flex: 1 }} onClick={() => restoreDraft(draftOffer)}>Resume →</button>
                <button style={{ ...S.btn("default"), flex: 1 }} onClick={() => { clearDraft(); setDraftOffer(null); }}>Discard</button>
              </div>
            </div>
          </div>
        )}

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

    const modals = (
      <>
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
      </>
    );

    if (isModern) {
      return ModernSessionPhase();
    }

    return (
      <div>
        {modals}

        {/* Session header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px", gap: "8px" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--text)", letterSpacing: "0.04em" }}>{sessionPlan.weekLabel}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "2px" }}>Day {sessionPlan.day} · {doneEx}/{totalEx} exercises</div>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button style={S.btnSm("warning")} onClick={() => { setPhase("summary"); setResting(false); }}>Save</button>
            <button style={S.btnSm("danger")}  onClick={() => { clearDraft(); setPhase("pick"); setResting(false); }}>Abandon</button>
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
            clearDraft();
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
    .sort((a, b) => {
      if (b.date !== a.date) return b.date > a.date ? 1 : -1;
      return (b.start_time || "").localeCompare(a.start_time || "");
    });

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
  const [themeSkin,     setThemeSkin]     = useState(() => localStorage.getItem('pl-theme-skin') || 'classic');
  const sysDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  const isDark  = themeOverride ? themeOverride === 'dark' : sysDark;

  useEffect(() => {
    applyTheme(getThemeVars(isDark, themeSkin));
    if (themeOverride) localStorage.setItem('pl-theme', themeOverride);
    else               localStorage.removeItem('pl-theme');
    localStorage.setItem('pl-theme-skin', themeSkin);
  }, [isDark, themeOverride, themeSkin]);

  // Sync skin from user_profile once data is loaded
  useEffect(() => {
    const profileSkin = rootSchema?.user_profile?.theme;
    if (profileSkin && profileSkin !== themeSkin) setThemeSkin(profileSkin);
  }, [rootSchema?.user_profile?.theme]); // eslint-disable-line

  function handleSetTheme(val) { setThemeOverride(val); }
  function handleSetThemeSkin(skin) {
    setThemeSkin(skin);
    if (rootSchema) updateSchema({ ...rootSchema, user_profile: { ...rootSchema.user_profile, theme: skin } });
  }

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
          // Unlogged sets record 0 reps (not the planned target) so skipped
          // work never inflates tonnage / history / best-set stats (B3).
          reps_completed: r?.reps ?? 0,
          reps_target: set.reps, rpe: r?.rpe ?? null,
          success: r?.done ?? false, is_warmup: set.isWarmup,
          // Persist AMRAP flag + minimum so TM review can gate increments only
          // for variants that actually prescribe AMRAP (5s PRO carries false).
          is_amrap: !!set.isAmrap,
          amrap_min: set.isAmrap ? (set.amrap_minimum ?? null) : null,
          // Include true singles: a 1-rep set has e1RM = weight (B4).
          e1rm_kg: (!set.isWarmup && (r?.reps ?? 0) >= 1) ? epley(set.weight, r.reps) : null
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
      const isLinear  = tmpl?.progression_model?.type === "linear_weight";
      const working_weights = isLinear ? updateLinearWeights(inst, tmpl, exercisesPerformed) : inst.working_weights;
      newInsts = newInsts.map(i => i.id !== inst.id ? i : {
        ...i, current_day, current_week, current_cycle,
        ...(isLinear ? { working_weights } : {}),
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
              onNavigateToStats={() => setActiveTab("progress")}
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
              themeSkin={themeSkin} onSetThemeSkin={handleSetThemeSkin}
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

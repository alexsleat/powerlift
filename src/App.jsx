import { useState, useEffect, useRef } from "react";
import { api } from "./api.js";
import AuthPage from "./AuthPage.jsx";

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

// ─── STYLES ───────────────────────────────────────────────────────────────────

const S = {
  app:      { fontFamily: "'Courier New', monospace", background: "#0f0f0f", color: "#e0e0e0", minHeight: "100vh", display: "flex", flexDirection: "column" },
  nav:      { display: "flex", gap: "2px", padding: "6px 8px", background: "#1a1a1a", borderBottom: "1px solid #333", overflowX: "auto", alignItems: "center", WebkitOverflowScrolling: "touch" },
  navBtn:   (a) => ({ padding: "10px 14px", background: a ? "#e0e0e0" : "#2a2a2a", color: a ? "#0f0f0f" : "#aaa", border: `1px solid ${a ? "#e0e0e0" : "#333"}`, cursor: "pointer", fontSize: "13px", fontFamily: "inherit", letterSpacing: "0.04em", whiteSpace: "nowrap", minHeight: "40px" }),
  navSep:   { width: "1px", height: "24px", background: "#333", margin: "0 4px", flexShrink: 0 },
  main:     { flex: 1, display: "flex", overflow: "hidden" },
  content:  { flex: 1, overflowY: "auto", padding: "14px", WebkitOverflowScrolling: "touch" },
  card:     { background: "#1a1a1a", border: "1px solid #2a2a2a", marginBottom: "12px" },
  cardHead: { padding: "10px 14px", background: "#222", borderBottom: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "space-between" },
  cardBody: { padding: "14px", overflowX: "auto" },
  h1:       { fontSize: "16px", fontWeight: "bold", color: "#e0e0e0", margin: "0 0 14px", letterSpacing: "0.1em", textTransform: "uppercase" },
  h3:       { fontSize: "13px", fontWeight: "bold", color: "#aaa", margin: "0", letterSpacing: "0.04em" },
  label:    { fontSize: "12px", color: "#777", display: "block", marginBottom: "4px", letterSpacing: "0.04em", textTransform: "uppercase" },
  mono:     { fontFamily: "'Courier New', monospace", fontSize: "13px", color: "#88c0d0" },
  // inputs are mainly used in non-session areas (Schema tab) — keep them
  input:    { background: "#0f0f0f", border: "1px solid #444", color: "#e0e0e0", padding: "8px 10px", fontSize: "14px", fontFamily: "inherit", width: "100%", boxSizing: "border-box", minHeight: "40px" },
  textarea: { background: "#0f0f0f", border: "1px solid #444", color: "#e0e0e0", padding: "10px", fontSize: "13px", fontFamily: "inherit", width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: "80px" },
  select:   { background: "#0f0f0f", border: "1px solid #444", color: "#e0e0e0", padding: "8px 10px", fontSize: "14px", fontFamily: "inherit", minHeight: "40px" },
  btn: (v = "default") => {
    const vs = {
      default:  { background: "#2a2a2a", color: "#ccc",    border: "1px solid #444" },
      primary:  { background: "#e0e0e0", color: "#0f0f0f", border: "1px solid #e0e0e0" },
      danger:   { background: "#2a1a1a", color: "#e06060", border: "1px solid #4a2a2a" },
      success:  { background: "#1a2a1a", color: "#60e060", border: "1px solid #2a4a2a" },
      active:   { background: "#1a2a3a", color: "#88c0d0", border: "1px solid #2a4a5a" },
      warning:  { background: "#2a2a1a", color: "#c0c060", border: "1px solid #4a4a2a" },
      ghost:    { background: "transparent", color: "#666", border: "1px solid #333" },
    };
    return { ...(vs[v] || vs.default), padding: "10px 16px", cursor: "pointer", fontSize: "14px", fontFamily: "inherit", letterSpacing: "0.04em", minHeight: "40px", WebkitTapHighlightColor: "transparent" };
  },
  btnSm: (v = "default") => {
    const vs = {
      default: { background: "#2a2a2a", color: "#ccc",    border: "1px solid #333" },
      success: { background: "#1a2a1a", color: "#60e060", border: "1px solid #2a4a2a" },
      danger:  { background: "#2a1a1a", color: "#e06060", border: "1px solid #4a2a2a" },
      active:  { background: "#1a2a3a", color: "#88c0d0", border: "1px solid #2a4a5a" },
      warning: { background: "#2a2a1a", color: "#c0c060", border: "1px solid #4a4a2a" },
    };
    return { ...(vs[v] || vs.default), padding: "5px 10px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", letterSpacing: "0.04em", WebkitTapHighlightColor: "transparent" };
  },
  table:  { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th:     { padding: "8px 10px", textAlign: "left", background: "#222", color: "#888", borderBottom: "1px solid #2a2a2a", fontSize: "12px", letterSpacing: "0.04em", textTransform: "uppercase" },
  td:     { padding: "8px 10px", borderBottom: "1px solid #1e1e1e", color: "#ccc", verticalAlign: "middle" },
  badge:  (c = "#333") => ({ display: "inline-block", background: c, color: "#ccc", padding: "2px 7px", fontSize: "10px", marginRight: "4px", border: "1px solid #555", letterSpacing: "0.06em" }),
  flex:   { display: "flex", alignItems: "center", gap: "8px" },
  grid2:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  subNav: { display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" },
  // Modal overlay
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modalBox: { background: "#1a1a1a", border: "1px solid #444", padding: "20px", width: "100%", maxWidth: "340px", boxSizing: "border-box" },
};

// ─── MODAL SHELL ──────────────────────────────────────────────────────────────

function Modal({ onClose, children }) {
  return (
    <div style={S.overlay} onPointerDown={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modalBox}>
        {children}
      </div>
    </div>
  );
}

// Reusable stepper row: label, - button, value display, + button
function Stepper({ label, value, onDec, onInc, display }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ ...S.label, marginBottom: "8px" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
        <button style={{ ...S.btn(), minWidth: "52px", fontSize: "22px", padding: "8px 0", borderRight: "none" }} onPointerDown={e => { e.preventDefault(); onDec(); }}> − </button>
        <div style={{ flex: 1, textAlign: "center", background: "#0f0f0f", border: "1px solid #444", borderLeft: "none", borderRight: "none", padding: "8px 4px", fontSize: "24px", color: "#e0e0e0", letterSpacing: "0.05em" }}>
          {display ?? value}
        </div>
        <button style={{ ...S.btn(), minWidth: "52px", fontSize: "22px", padding: "8px 0", borderLeft: "none" }} onPointerDown={e => { e.preventDefault(); onInc(); }}> + </button>
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
  const inc     = units === "lb" ? 2.5 : 1.25;
  const bigInc  = units === "lb" ? 5   : 2.5;
  const rpeStep = 0.5;
  const adjW = (delta) => setWeight(v => Math.max(0, Math.round((v + delta) * 100) / 100));

  return (
    <Modal onClose={onClose}>
      <div style={{ ...S.h3, marginBottom: "14px", color: isEdit ? "#c0c060" : "#aaa" }}>
        {isEdit ? "✎ Edit Set" : setLabel}
      </div>
      {isEdit && <div style={{ color: "#666", fontSize: "12px", marginBottom: "12px" }}>{setLabel}</div>}

      <Stepper label={`Weight (${units})`}
        value={weight}
        display={`${weight} ${units}`}
        onDec={() => adjW(-bigInc)}
        onInc={() => adjW(bigInc)}
      />
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {[-bigInc * 2, -bigInc, -inc, inc, bigInc, bigInc * 2].map(d => (
          <button key={d} style={{ ...S.btnSm(d < 0 ? "danger" : "success"), flex: 1, fontSize: "11px" }}
            onPointerDown={() => adjW(d)}>
            {d > 0 ? "+" : ""}{d}
          </button>
        ))}
      </div>

      <Stepper label="Reps completed"
        value={reps}
        onDec={() => setReps(r => Math.max(0, r - 1))}
        onInc={() => setReps(r => r + 1)}
      />

      {!set.isWarmup && (
        <Stepper label={`RPE (${rpe.toFixed(1)})`}
          value={rpe}
          display={rpe.toFixed(1)}
          onDec={() => setRpe(r => Math.max(1, Math.round((r - rpeStep) * 10) / 10))}
          onInc={() => setRpe(r => Math.min(10, Math.round((r + rpeStep) * 10) / 10))}
        />
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        <button style={{ ...S.btn(isEdit ? "warning" : "success"), flex: 1, fontSize: "16px" }}
          onPointerDown={() => onConfirm(reps, set.isWarmup ? null : rpe, toKg(weight, units))}>
          {isEdit ? "Update ✓" : "LOG ✓"}
        </button>
        <button style={{ ...S.btn("ghost"), flex: 0 }} onPointerDown={onClose}>✕</button>
      </div>
    </Modal>
  );
}

// ─── EDIT WEIGHT MODAL ────────────────────────────────────────────────────────

function EditWeightModal({ weight, units, onConfirm, onClose }) {
  const inc  = units === "lb" ? 2.5 : 1.25;
  const bigInc = units === "lb" ? 5 : 2.5;
  const [val, setVal] = useState(dspW(weight || 0, units));

  const adj = (delta) => setVal(v => Math.max(0, Math.round((v + delta) * 100) / 100));

  return (
    <Modal onClose={onClose}>
      <div style={{ ...S.h3, marginBottom: "4px", color: "#aaa" }}>Edit Weight</div>
      <Stepper label={`Weight (${units})`}
        value={val}
        display={`${val} ${units}`}
        onDec={() => adj(-bigInc)}
        onInc={() => adj(bigInc)}
      />
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {[-bigInc * 2, -bigInc, -inc, inc, bigInc, bigInc * 2].map(d => (
          <button key={d} style={{ ...S.btnSm(d < 0 ? "danger" : "success"), flex: 1, fontSize: "11px" }}
            onPointerDown={() => adj(d)}>
            {d > 0 ? "+" : ""}{d}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button style={{ ...S.btn("active"), flex: 1 }}
          onPointerDown={() => onConfirm(toKg(val, units), false)}>
          This Set
        </button>
        <button style={{ ...S.btn("primary"), flex: 1 }}
          onPointerDown={() => onConfirm(toKg(val, units), true)}>
          All Remaining
        </button>
        <button style={{ ...S.btn("ghost"), flex: 0 }} onPointerDown={onClose}>✕</button>
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
      <div style={{ ...S.flex, marginBottom: "8px", flexWrap: "wrap" }}>
        <button style={S.btn("primary")} onClick={save}>Apply Changes</button>
        <button style={S.btn()} onClick={() => setRaw(JSON.stringify(data, null, 2))}>Reset</button>
        {error && <span style={{ color: "#e06060", fontSize: "12px" }}>Error: {error}</span>}
      </div>
      <textarea style={{ ...S.textarea, minHeight: "500px", color: "#88c0d0", fontSize: "11px" }} value={raw} onChange={e => setRaw(e.target.value)} />
    </div>
  );
}

// ─── REST TIMER ───────────────────────────────────────────────────────────────
// Counts up from 0. remaining = target - elapsed. Goes negative after target.
// Never auto-fires onDone. User skips manually.

function RestTimer({ seconds, onDone }) {
  const [elapsed,  setElapsed]  = useState(0);
  const [running,  setRunning]  = useState(true);
  const iv = useRef(null);

  useEffect(() => {
    if (running) iv.current = setInterval(() => setElapsed(e => e + 1), 1000);
    else clearInterval(iv.current);
    return () => clearInterval(iv.current);
  }, [running]);

  const remaining   = seconds - elapsed;
  const isOvertime  = remaining < 0;
  const displaySecs = Math.abs(remaining);
  const mm = String(Math.floor(displaySecs / 60)).padStart(2, "0");
  const ss = String(displaySecs % 60).padStart(2, "0");
  const pct = Math.max(0, (remaining / seconds) * 100);

  const timerColor = isOvertime ? "#e06060" : pct > 40 ? "#60e060" : "#e0c060";

  return (
    <div style={{ ...S.card, marginBottom: "10px", borderColor: isOvertime ? "#4a2020" : "#2a2a2a" }}>
      <div style={S.cardHead}>
        <span style={{ ...S.h3, color: isOvertime ? "#e06060" : "#aaa" }}>
          {isOvertime ? `+${mm}:${ss} OVERTIME` : "Rest"}
        </span>
        <div style={S.flex}>
          <button style={S.btnSm(running ? "danger" : "success")} onClick={() => setRunning(r => !r)}>
            {running ? "Pause" : "Resume"}
          </button>
          <button style={S.btnSm("primary")} onClick={onDone}>Skip →</button>
        </div>
      </div>
      <div style={{ padding: "4px 14px 12px" }}>
        <div style={{ fontSize: "38px", fontFamily: "inherit", color: timerColor, letterSpacing: "0.1em", textAlign: "center", padding: "10px 0" }}>
          {isOvertime ? <span style={{ fontSize: "20px", color: "#e06060" }}>OVERTIME </span> : ""}{mm}:{ss}
        </div>
        <div style={{ height: "5px", background: "#222" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: timerColor, transition: "width 1s linear" }} />
        </div>
      </div>
    </div>
  );
}

// ─── SVG CHARTS ───────────────────────────────────────────────────────────────

function LineChart({ points, color }) {
  if (!points || points.length < 2) return (
    <div style={{ color: "#444", fontSize: "12px", padding: "16px 0", textAlign: "center" }}>Not enough data yet</div>
  );
  const W = 270, H = 90, PAD = { t: 10, b: 18, l: 36, r: 8 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;
  const ys = points.map(p => p.y);
  const minY = Math.min(...ys), maxY = Math.max(...ys), rangeY = maxY - minY || 1;
  const tx = i => PAD.l + (i / (points.length - 1)) * cW;
  const ty = v => PAD.t + (1 - (v - minY) / rangeY) * cH;
  const d  = points.map((p, i) => `${i === 0 ? "M" : "L"} ${tx(i).toFixed(1)} ${ty(p.y).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "90px" }}>
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="#2a2a2a" strokeWidth="1" />
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="#2a2a2a" strokeWidth="1" />
      <text x={PAD.l - 3} y={PAD.t + 4}     fill="#555" fontSize="8" textAnchor="end">{maxY.toFixed(1)}</text>
      <text x={PAD.l - 3} y={H - PAD.b + 1} fill="#555" fontSize="8" textAnchor="end">{minY.toFixed(1)}</text>
      <path d={d} fill="none" stroke={color || "#88c0d0"} strokeWidth="1.5" />
      {points.map((p, i) => <circle key={i} cx={tx(i)} cy={ty(p.y)} r={i === points.length - 1 ? 3 : 1.5} fill={color || "#88c0d0"} />)}
      <text x={tx(0)} y={H} fill="#444" fontSize="8" textAnchor="middle">{points[0].x}</text>
      {points.length > 2 && <text x={tx(points.length - 1)} y={H} fill="#444" fontSize="8" textAnchor="middle">{points[points.length - 1].x}</text>}
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
            <rect x={x} y={y} width={bW} height={bH} fill={color || "#2a4a5a"} />
            {bar.label && <text x={x + bW / 2} y={H - 2} fill="#444" fontSize="7" textAnchor="middle">{bar.label}</text>}
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

  // Update target when session context changes (e.g. user switches to Plates tab)
  useEffect(() => {
    if (sessionContext?.weight) setTarget(dspW(sessionContext.weight, units));
  }, [sessionContext?.weight, units]);

  const result   = calcPlates(target, bar, units);
  const maxPlate = units === "lb" ? 45 : 25;

  return (
    <div>
      <div style={S.h1}>Plate Calculator</div>

      {sessionContext?.exName && (
        <div style={{ ...S.card, borderColor: "#2a4a5a", marginBottom: "12px" }}>
          <div style={{ ...S.cardBody, padding: "10px 14px" }}>
            <div style={{ color: "#88c0d0", fontSize: "12px", marginBottom: "6px" }}>SESSION — NEXT SET</div>
            <div style={{ ...S.flex, justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
              <span style={{ color: "#ccc", fontSize: "14px" }}>{sessionContext.exName}</span>
              <button style={S.btnSm("active")}
                onClick={() => setTarget(dspW(sessionContext.weight, units))}>
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
                <div style={{ width: "18px", height: "8px", background: "#777", flexShrink: 0, alignSelf: "center" }} />
                {result.plates.slice().reverse().flatMap((p, i) =>
                  Array.from({ length: p.count }).map((_, j) => {
                    const h = Math.round(14 + (p.weight / maxPlate) * 46);
                    return (
                      <div key={`${i}-${j}`} title={`${p.weight}${units}`} style={{
                        width: "22px", height: `${h}px`, background: PLATE_COLORS[p.weight] || "#505050",
                        border: "1px solid #111", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        <span style={{ fontSize: "7px", color: "#fff", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{p.weight}</span>
                      </div>
                    );
                  })
                )}
                <div style={{ width: "18px", height: "8px", background: "#777", flexShrink: 0, alignSelf: "center" }} />
              </div>

              <div style={{ marginTop: "10px" }}>
                <div style={{ fontSize: "12px", color: "#888", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Per side</div>
                {result.plates.length === 0
                  ? <div style={{ color: "#666", fontSize: "13px" }}>Bar only</div>
                  : result.plates.map((p, i) => (
                    <div key={i} style={{ ...S.flex, fontSize: "14px", marginBottom: "4px" }}>
                      <span style={S.mono}>{p.count}×</span>
                      <div style={{ width: "14px", height: "14px", background: PLATE_COLORS[p.weight] || "#505050", border: "1px solid #222" }} />
                      <span style={{ color: "#ccc" }}>{p.weight}{units}</span>
                    </div>
                  ))
                }
                {result.remainder > 0.05 && (
                  <div style={{ color: "#e0c060", fontSize: "12px", marginTop: "8px" }}>
                    ⚠ {result.remainder.toFixed(2)}{units}/side unloaded
                  </div>
                )}
              </div>

              <div style={{ borderTop: "1px solid #2a2a2a", marginTop: "14px", paddingTop: "10px", ...S.flex, justifyContent: "space-between" }}>
                <span style={{ color: "#666", fontSize: "12px" }}>Total loaded</span>
                <span style={{ ...S.mono, fontSize: "16px" }}>{target}{units}</span>
              </div>
            </>
          ) : (
            <div style={{ color: "#555", fontSize: "13px" }}>Target must exceed bar weight.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PROGRESS VIEW ────────────────────────────────────────────────────────────

function ProgressView({ rootSchema, units }) {
  const [sub, setSub] = useState("e1rm");
  const mainLifts     = ["ex_squat", "ex_deadlift", "ex_bench", "ex_ohp"];

  const e1rmCharts = mainLifts.map(id => {
    const entries = (rootSchema.e1rm_log || [])
      .filter(e => e.exercise_id === id)
      .sort((a, b) => a.session_id > b.session_id ? 1 : -1);
    const points = entries.map(e => ({
      x: (e.session_id || "").replace("session_", "").substring(0, 10),
      y: dspW(e.e1rm_kg, units)
    }));
    const best = entries.length ? Math.max(...entries.map(e => dspW(e.e1rm_kg, units))) : null;
    return { id, ...LIFT_META[id], points, best };
  });

  const recentSessions = (rootSchema.workout_sessions || []).slice(-12);
  const tonnageBars    = recentSessions.map(s => ({
    label: (s.date || "").substring(5),
    value: dspW(sessionTonnage(s), units)
  }));
  const sessionRows = recentSessions.slice(-8).reverse().map(s => ({
    date:    s.date,
    day:     `W${s.week}D${s.day}`,
    tonnage: dspW(sessionTonnage(s), units).toFixed(0)
  }));

  return (
    <div>
      <div style={S.h1}>Progress</div>
      <div style={S.subNav}>
        <button style={S.btn(sub === "e1rm"   ? "active" : "default")} onClick={() => setSub("e1rm")}>1RM</button>
        <button style={S.btn(sub === "volume" ? "active" : "default")} onClick={() => setSub("volume")}>Volume</button>
      </div>

      {sub === "e1rm" && (
        <>
          <div style={S.grid2}>
            {e1rmCharts.map(lift => (
              <div key={lift.id} style={S.card}>
                <div style={S.cardHead}>
                  <span style={{ fontWeight: "bold", color: lift.color, fontSize: "13px" }}>{lift.name}</span>
                  {lift.best != null && <span style={{ ...S.mono, fontSize: "12px" }}>Best {lift.best}{units}</span>}
                </div>
                <div style={{ padding: "8px" }}>
                  <LineChart points={lift.points} color={lift.color} />
                </div>
              </div>
            ))}
          </div>
          {e1rmCharts.every(c => c.points.length < 2) && (
            <div style={{ color: "#555", fontSize: "13px", textAlign: "center", padding: "24px" }}>
              Complete sessions to see progress charts.
            </div>
          )}
        </>
      )}

      {sub === "volume" && (
        <>
          <div style={S.card}>
            <div style={S.cardHead}><span style={S.h3}>Tonnage per session ({units})</span></div>
            <div style={{ padding: "8px" }}>
              {tonnageBars.length > 0
                ? <BarChart bars={tonnageBars} color="#2a4a5a" />
                : <div style={{ color: "#555", fontSize: "13px", padding: "16px", textAlign: "center" }}>No sessions logged yet.</div>
              }
            </div>
          </div>
          {sessionRows.length > 0 && (
            <div style={S.card}>
              <div style={S.cardHead}><span style={S.h3}>Recent sessions</span></div>
              <div style={S.cardBody}>
                <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>Date</th><th style={S.th}>Day</th><th style={S.th}>Tonnage ({units})</th>
                  </tr></thead>
                  <tbody>
                    {sessionRows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ ...S.td, ...S.mono }}>{r.date}</td>
                        <td style={S.td}>{r.day}</td>
                        <td style={{ ...S.td, ...S.mono }}>{r.tonnage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
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
      <button style={S.btn("primary")} onClick={backup}>⬇ Backup</button>
      <button style={S.btn()} onClick={() => fileRef.current?.click()}>⬆ Restore</button>
      <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={restore} />
      {err && <span style={{ color: "#e06060", fontSize: "12px", alignSelf: "center" }}>Error: {err}</span>}
    </div>
  );
}

// ─── TM REVIEW PANEL ──────────────────────────────────────────────────────────

function TmReviewPanel({ inst, tmpl, units, rootSchema, onChange }) {
  const increments = tmpl?.progression_model?.lift_increments || [];
  const [newTMs, setNewTMs] = useState(() =>
    inst.training_maxes.map(tm => {
      const inc   = increments.find(li => li.exercises?.includes(tm.exercise_id) || li.exercise_id === tm.exercise_id);
      const delta = inc?.increment_kg || 0;
      return { exercise_id: tm.exercise_id, current_kg: tm.tm_kg, new_kg: tm.tm_kg + delta };
    })
  );
  const [editIdx, setEditIdx] = useState(null);

  function apply() {
    onChange({ ...rootSchema, programme_instances: rootSchema.programme_instances.map(i => i.id !== inst.id ? i : {
      ...i, needs_tm_review: false,
      training_maxes: i.training_maxes.map(tm => {
        const n = newTMs.find(t => t.exercise_id === tm.exercise_id);
        return n ? { ...tm, tm_kg: n.new_kg, last_updated: new Date().toISOString().split("T")[0] } : tm;
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
          weight={editing.new_kg}
          units={units}
          onClose={() => setEditIdx(null)}
          onConfirm={(kg) => {
            setNewTMs(prev => prev.map((t, i) => i === editIdx ? { ...t, new_kg: kg } : t));
            setEditIdx(null);
          }}
        />
      )}
      <div style={{ ...S.card, borderColor: "#2a4a2a", marginBottom: "16px" }}>
        <div style={{ ...S.cardHead, background: "#1a2a1a" }}>
          <span style={{ fontWeight: "bold", color: "#60e060", fontSize: "14px" }}>Cycle Complete — Review TMs</span>
          <span style={{ color: "#888", fontSize: "12px" }}>{tmpl?.name}</span>
        </div>
        <div style={S.cardBody}>
          <div style={{ color: "#888", fontSize: "12px", marginBottom: "12px" }}>
            Tap a value to edit. Confirm when ready.
          </div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Lift</th>
              <th style={S.th}>Old</th>
              <th style={S.th}>New (tap to edit)</th>
            </tr></thead>
            <tbody>
              {newTMs.map((tm, i) => (
                <tr key={i}>
                  <td style={S.td}>{liftName(tm.exercise_id)}</td>
                  <td style={{ ...S.td, color: "#666" }}>{fmtW(tm.current_kg, units)}</td>
                  <td style={S.td}>
                    <button style={S.btnSm("active")} onClick={() => setEditIdx(i)}>
                      {fmtW(tm.new_kg, units)} ✎
                    </button>
                  </td>
                </tr>
              ))}
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
        <span style={{ color: "#555", fontSize: "16px" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && <div style={S.cardBody}>{children}</div>}
    </div>
  );
}

// ─── NEW PROGRAMME PANEL ──────────────────────────────────────────────────────

function NewProgrammePanel({ rootSchema, onChange }) {
  const [selectedId, setSelectedId] = useState("");
  const tmpl = rootSchema.programme_templates.find(t => t.id === selectedId);

  function start() {
    if (!tmpl) return;
    const tmPct         = tmpl.progression_model?.initial_tm_percentage ?? 0.90;
    const training_maxes = rootSchema.lift_maxes.map(lm => ({
      exercise_id: lm.exercise_id,
      tm_kg: roundToNearest(lm.one_rm_kg * tmPct, 2.5),
      last_updated: new Date().toISOString().split("T")[0],
      cycle_when_set: 1
    }));
    const newInst = {
      id: `prog_inst_${Date.now()}`, template_id: selectedId, status: "active",
      started_date: new Date().toISOString().split("T")[0],
      current_phase_id: tmpl.phases?.[0]?.phase_id || null,
      current_cycle_role: selectedId === "531_fsl" ? "leader" : "standard",
      current_macrocycle_block: 1, current_cycle: 1, current_week: 1, current_day: 1,
      training_maxes, failure_tracking: [], phase_history: [], needs_tm_review: false
    };
    onChange({ ...rootSchema, programme_instances: [...rootSchema.programme_instances, newInst] });
    setSelectedId("");
  }

  return (
    <SchemaSection title="Start New Programme">
      <div style={{ marginBottom: "12px" }}>
        <label style={S.label}>Template</label>
        <select style={{ ...S.select, width: "100%" }} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          <option value="">— select —</option>
          {rootSchema.programme_templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      {tmpl && (
        <div style={{ fontSize: "12px", color: "#777", marginBottom: "12px" }}>
          TMs set at {Math.round((tmpl.progression_model?.initial_tm_percentage ?? 0.9) * 100)}% of current 1RMs.
          <div style={{ marginTop: "4px", color: "#555" }}>{tmpl.description}</div>
        </div>
      )}
      <button style={S.btn("primary")} onClick={start} disabled={!selectedId}>Start →</button>
    </SchemaSection>
  );
}

// ─── ROOT SCHEMA VIEW ─────────────────────────────────────────────────────────

function RootSchemaView({ rootSchema, exLib, onChange, onRestore }) {
  const [view,    setView]    = useState("structured");
  const [editTmModal, setEditTmModal] = useState(null); // { instId, exId, kg }
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

  const liftName = id => LIFT_META[id]?.name || id.replace("ex_", "");
  const activeInsts   = rootSchema.programme_instances.filter(i => i.status === "active");
  const archivedInsts = rootSchema.programme_instances.filter(i => i.status === "archived");

  return (
    <>
      {editTmModal && (
        <EditWeightModal
          weight={editTmModal.kg}
          units={units}
          onClose={() => setEditTmModal(null)}
          onConfirm={(kg) => { updateTM(editTmModal.instId, editTmModal.exId, kg); setEditTmModal(null); }}
        />
      )}
      <div>
        <div style={{ ...S.flex, marginBottom: "16px" }}>
          <button style={S.btn(view === "structured" ? "active" : "default")} onClick={() => setView("structured")}>UI</button>
          <button style={S.btn(view === "json"       ? "active" : "default")} onClick={() => setView("json")}>JSON</button>
        </div>

        {view === "json" ? <JsonViewer data={rootSchema} onSave={onChange} /> : (
          <>
            <SchemaSection title="Backup / Restore">
              <BackupRestore rootSchema={rootSchema} exLib={exLib} onRestore={onRestore} />
            </SchemaSection>

            <SchemaSection title="Profile">
              <div style={{ marginBottom: "12px" }}>
                <label style={S.label}>Name</label>
                <input style={S.input} value={rootSchema.user_profile.name} onChange={e => updateProfile("name", e.target.value)} />
              </div>
            </SchemaSection>

            <SchemaSection title="Rest Timer Defaults" defaultOpen={false}>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "12px" }}>Seconds of rest after each set type.</div>
              {[["main", "Main Lift"], ["supplemental", "Supplemental"], ["assistance", "Assistance"]].map(([role, label]) => (
                <div key={role} style={{ marginBottom: "10px" }}>
                  <label style={S.label}>{label} (seconds)</label>
                  <input style={{ ...S.input, width: "100px" }} type="number" step="15"
                    value={restDefs[role] ?? DEFAULT_REST[role]}
                    onChange={e => updateRestDefault(role, e.target.value)} />
                </div>
              ))}
            </SchemaSection>

            <NewProgrammePanel rootSchema={rootSchema} onChange={onChange} />

            <SchemaSection title={`Active Programmes (${activeInsts.length})`}>
              {activeInsts.length === 0 && <div style={{ color: "#555", fontSize: "13px" }}>None. Start one above.</div>}
              {activeInsts.map(inst => {
                const tmpl = rootSchema.programme_templates.find(t => t.id === inst.template_id);
                return (
                  <div key={inst.id} style={{ marginBottom: "20px" }}>
                    <div style={{ ...S.flex, marginBottom: "8px", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                      <div>
                        <div style={{ color: "#ccc", fontWeight: "bold", fontSize: "14px" }}>{tmpl?.name || inst.template_id}</div>
                        <div style={{ color: "#555", fontSize: "12px" }}>Cycle {inst.current_cycle} · W{inst.current_week}D{inst.current_day}</div>
                      </div>
                      <button style={S.btnSm("warning")} onClick={() => archiveInst(inst.id)}>Archive</button>
                    </div>
                    <table style={S.table}>
                      <thead><tr><th style={S.th}>Lift</th><th style={S.th}>TM</th></tr></thead>
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
                    <div key={inst.id} style={{ ...S.flex, justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                      <div>
                        <div style={{ color: "#666", fontSize: "13px" }}>{tmpl?.name || inst.template_id}</div>
                        <div style={{ color: "#444", fontSize: "11px" }}>Started {inst.started_date} · Cycle {inst.current_cycle}</div>
                      </div>
                      <button style={S.btnSm()} onClick={() => restoreInst(inst.id)}>Restore</button>
                    </div>
                  );
                })}
              </SchemaSection>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─── EXERCISE LIBRARY VIEW ────────────────────────────────────────────────────

function ExerciseLibraryView({ exLib, onChange }) {
  return (
    <div>
      <div style={S.h1}>Exercise Library</div>
      <JsonViewer data={exLib} onSave={onChange} />
    </div>
  );
}

// ─── SESSION RUNNER ───────────────────────────────────────────────────────────

function SessionRunner({ rootSchema, exLib, onSessionComplete, onSchemaChange, onContextChange }) {
  const units    = rootSchema.user_profile?.units || "kg";
  const restDefs = rootSchema.user_profile?.rest_defaults_seconds || DEFAULT_REST;

  const [phase,          setPhase]          = useState("pick");
  const [selectedInstId, setSelectedInstId] = useState(() => {
    const active = rootSchema.programme_instances.find(i => i.status === "active");
    return active?.id || null;
  });
  const [sessionPlan,    setSessionPlan]    = useState(null);
  const [currentExIdx,   setCurrentExIdx]   = useState(0);
  const [expandedSet,    setExpandedSet]    = useState(new Set([0]));
  const [setResults,     setSetResults]     = useState({});
  const [weightOverrides,setWeightOverrides]= useState({});
  const [resting,        setResting]        = useState(false);
  const [restSeconds,    setRestSeconds]    = useState(180);
  const [sessionNotes,   setSessionNotes]   = useState("");

  // Modal state lives here so it survives expand/collapse re-renders
  const [logModal,    setLogModal]    = useState(null); // { exIdx, setIdx }
  const [weightModal, setWeightModal] = useState(null); // { exIdx, setIdx, weight }
  const [lastRpeByExId, setLastRpeByExId] = useState({});

  // Notify parent of current context for Plates tab
  useEffect(() => {
    if (phase !== "session" || !sessionPlan) { onContextChange?.(null); return; }
    const ex   = sessionPlan.exercises[currentExIdx];
    if (!ex) return;
    const wc   = ex.sets.filter(s => s.isWarmup).length;
    // Find next undone work set
    const nextSetIdx = ex.sets.findIndex((_s, i) => i >= wc && !setResults[`${currentExIdx}-${i}`]?.done);
    const nextSet    = nextSetIdx >= 0 ? ex.sets[nextSetIdx] : null;
    const weight     = nextSet ? (weightOverrides[`${currentExIdx}-${nextSetIdx}`] ?? nextSet.weight) : null;
    const exInfo     = getExercise(ex.exercise_id, rootSchema, exLib);
    onContextChange?.({ weight, exName: exInfo.name });
  }, [phase, sessionPlan, currentExIdx, setResults, weightOverrides]);

  // ── helpers ───────────────────────────────────────────────────────────────

  function getEffectiveWeight(exIdx, setIdx, set) {
    return weightOverrides[`${exIdx}-${setIdx}`] ?? set.weight;
  }

  function applyWeightOverride(exIdx, fromSetIdx, newKg, applyToAll) {
    const ex = sessionPlan.exercises[exIdx];
    if (applyToAll) {
      const updates = {};
      ex.sets.forEach((s, i) => {
        if (i >= fromSetIdx && !s.isWarmup && !setResults[`${exIdx}-${i}`]?.done) {
          updates[`${exIdx}-${i}`] = newKg;
        }
      });
      setWeightOverrides(prev => ({ ...prev, ...updates }));
    } else {
      setWeightOverrides(prev => ({ ...prev, [`${exIdx}-${fromSetIdx}`]: newKg }));
    }
    setWeightModal(null);
  }

  function logSet(exIdx, setIdx, reps, rpe, weightKg) {
    const ex           = sessionPlan.exercises[exIdx];
    const exerciseId   = ex.exercise_id;
    const wasAlreadyDone = !!setResults[`${exIdx}-${setIdx}`]?.done;

    // If weight was changed in the modal, propagate to this set and all remaining undone work sets
    if (weightKg !== undefined) {
      const updates = {};
      ex.sets.forEach((s, i) => {
        if (i >= setIdx && !s.isWarmup && !setResults[`${exIdx}-${i}`]?.done) {
          updates[`${exIdx}-${i}`] = weightKg;
        }
      });
      // Always update the current set (even if "done" — this is an edit)
      updates[`${exIdx}-${setIdx}`] = weightKg;
      setWeightOverrides(prev => ({ ...prev, ...updates }));
    }
    if (rpe != null) setLastRpeByExId(prev => ({ ...prev, [exerciseId]: rpe }));
    setSetResults(r => ({ ...r, [`${exIdx}-${setIdx}`]: { reps, rpe, done: true } }));
    setLogModal(null);

    // Only advance / trigger rest timer if this is a fresh log (not an edit of a completed set)
    if (wasAlreadyDone) return;

    const nextSet = setIdx + 1;
    if (nextSet < ex.sets.length) {
      if (!ex.sets[nextSet].isWarmup) { setRestSeconds(restDefs[ex.role] ?? DEFAULT_REST[ex.role] ?? 120); setResting(true); }
    } else {
      const nextEx = exIdx + 1;
      if (nextEx < sessionPlan.exercises.length) {
        setCurrentExIdx(nextEx);
        setExpandedSet(prev => { const n = new Set(prev); n.add(nextEx); return n; });
        const nextRole = sessionPlan.exercises[nextEx].role || "assistance";
        setRestSeconds(restDefs[nextRole] ?? DEFAULT_REST[nextRole] ?? 90);
        setResting(true);
      } else {
        setPhase("summary");
      }
    }
  }

  function toggleExpand(idx) {
    setExpandedSet(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  }

  // ── session builder ───────────────────────────────────────────────────────

  function buildSessionPlan(inst, tmpl) {
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
        const liftW  = rootSchema.lift_maxes.find(l => l.exercise_id === te.exercise_id)?.one_rm_kg;
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

  function startSession() {
    const inst = rootSchema.programme_instances.find(i => i.id === selectedInstId);
    const tmpl = rootSchema.programme_templates.find(t => t.id === inst?.template_id);
    if (!inst || !tmpl) return;
    const plan = buildSessionPlan(inst, tmpl);
    if (!plan) return;
    setSessionPlan(plan);
    setCurrentExIdx(0);
    setExpandedSet(new Set([0]));
    setSetResults({});
    setWeightOverrides({});
    setResting(false);
    setPhase("session");
  }

  // ── render helpers ────────────────────────────────────────────────────────

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
    const isNext       = !done && exIdx === currentExIdx && exSets.slice(0, setIdx).filter(s => !s.isWarmup).every((_, j) => {
      const wc = numWarmup;
      return setResults[`${exIdx}-${wc + j}`]?.done;
    }) && (set.isWarmup || exSets.slice(numWarmup, setIdx).every((_, j) => setResults[`${exIdx}-${numWarmup + j}`]?.done));

    const rowBg     = done ? "#1a2a1a" : set.isWarmup ? "#1a1a2a" : isNext ? "#1e1c14" : "#141414";
    const rowBorder = done ? "#2a4a2a" : set.isWarmup ? "#2a2a4a" : isNext ? "#6a5a28" : "#1e1e1e";

    // Planned reps & RPE display
    const plannedReps = set.reps === "amrap" ? "AMRAP" : `${set.reps} reps`;
    const plannedRpe  = !set.isWarmup && !isAssistance ? "RPE?" : null;

    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", marginBottom: "3px", background: rowBg, border: `1px solid ${rowBorder}` }}>
          {/* Set number */}
          <div style={{ width: "24px", textAlign: "center", color: "#555", fontSize: "13px", flexShrink: 0 }}>{setNum}</div>

          {/* Weight — tap to edit (standalone weight modal, pre-log only) */}
          <button
            style={{ background: "transparent", border: "1px solid #2a2a2a", color: weight > 0 ? "#88c0d0" : "#555", padding: "4px 8px", fontSize: "14px", fontFamily: "inherit", cursor: (!done && weight > 0) ? "pointer" : "default", minWidth: "60px", letterSpacing: "0.02em" }}
            onClick={() => !done && weight > 0 && setWeightModal({ exIdx, setIdx, weight })}
            disabled={done || weight === 0}
          >
            {weight > 0 ? fmtW(weight, units) : "—"}
          </button>

          {/* Reps — planned or logged */}
          <div style={{ minWidth: "60px", color: done ? "#c08840" : "#a07030", fontSize: "13px" }}>
            {done ? `${result.reps} reps` : plannedReps}
          </div>

          {/* RPE — planned or logged (not for warmups or assistance) */}
          {!set.isWarmup && !isAssistance ? (
            <div style={{ minWidth: "44px", color: done ? "#8888e0" : "#444", fontSize: "12px" }}>
              {done && result.rpe ? `@${result.rpe}` : plannedRpe}
            </div>
          ) : (
            <div style={{ minWidth: "44px" }} />
          )}

          {/* Done checkmark (tappable to edit) or LOG button */}
          {done ? (
            <button
              style={{ background: "transparent", border: "1px solid #2a4a2a", color: "#60e060", fontSize: "16px", padding: "4px 8px", cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}
              onClick={() => setLogModal({ exIdx, setIdx, editReps: result.reps, editRpe: result.rpe, editWeight: weight })}
              title="Tap to edit">
              ✓
            </button>
          ) : (
            <button
              style={{ ...S.btnSm("success"), minWidth: "48px", fontSize: "13px", padding: "6px 10px", flexShrink: 0 }}
              onClick={() => setLogModal({ exIdx, setIdx })}>
              LOG
            </button>
          )}
        </div>
        {hint && (
          <div style={{ padding: "3px 10px 4px 42px", fontSize: "11px", color: "#c0c060", background: "#1a1a10", marginBottom: "2px" }}>
            ↳ {hint}
          </div>
        )}
      </>
    );
  }

  function ExCard({ ex, exIdx }) {
    const isActive   = exIdx === currentExIdx;
    const isExpanded = expandedSet.has(exIdx);
    const exInfo     = getExercise(ex.exercise_id, rootSchema, exLib);
    const warmupSets = ex.sets.filter(s => s.isWarmup);
    const workSets   = ex.sets.filter(s => !s.isWarmup);
    const doneCount  = workSets.filter((_, i) => setResults[`${exIdx}-${warmupSets.length + i}`]?.done).length;
    const allDone    = workSets.length > 0 && doneCount === workSets.length;
    const roleColor  = ex.role === "main" ? "#2a3a1a" : ex.role === "supplemental" ? "#1a2a3a" : "#1a1a2a";
    const roleBadge  = ex.role === "main" ? "MAIN" : ex.role === "supplemental" ? "SUPP" : "ASST";
    const cardBorder = allDone ? "#2a4a2a" : isActive ? "#4a7a9a" : "#2a2a2a";

    return (
      <div style={{ ...S.card, borderColor: cardBorder, boxShadow: isActive && !allDone ? "0 0 0 1px #2a5a7a" : "none" }}>
        <div style={{ ...S.cardHead, cursor: "pointer", background: allDone ? "#182818" : isActive ? "#0e1e2a" : "#1e1e1e", minHeight: "52px", borderBottom: isActive && !allDone ? "1px solid #2a4a6a" : "1px solid #2a2a2a" }}
          onClick={() => toggleExpand(exIdx)}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {isActive && !allDone && <span style={{ color: "#88c0d0", fontSize: "12px", letterSpacing: "0.08em" }}>▶</span>}
            <span style={S.badge(roleColor)}>{roleBadge}</span>
            <span style={{ fontWeight: "bold", fontSize: "14px", color: allDone ? "#60e060" : isActive ? "#e8e8ff" : "#888" }}>
              {exInfo.name}
            </span>
            {ex.label && <span style={{ color: "#88c0d0", fontSize: "12px" }}>{ex.label}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "8px" }}>
            <span style={{ color: allDone ? "#60e060" : "#555", fontSize: "13px" }}>
              {allDone ? `✓${workSets.length}` : `${doneCount}/${workSets.length}`}
            </span>
            <span style={{ color: "#444", fontSize: "14px" }}>{isExpanded ? "▲" : "▼"}</span>
          </div>
        </div>
        {/* display:none trick preserves DOM/input state */}
        <div style={{ display: isExpanded ? "block" : "none" }}>
          <div style={{ padding: "10px" }}>
            {ex.sets.map((set, setIdx) => (
              <SetRow key={setIdx} exIdx={exIdx} setIdx={setIdx} set={set} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── pick phase ────────────────────────────────────────────────────────────
  if (phase === "pick") {
    const reviewInst = rootSchema.programme_instances.find(i => i.status === "active" && i.needs_tm_review);
    const reviewTmpl = reviewInst ? rootSchema.programme_templates.find(t => t.id === reviewInst.template_id) : null;
    const activeInsts = rootSchema.programme_instances.filter(i => i.status === "active");

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
              <div style={{ color: "#555", fontSize: "13px" }}>No active programmes. Add one in the Schema tab.</div>
            )}
            {activeInsts.map(i => {
              const t = rootSchema.programme_templates.find(t => t.id === i.template_id);
              return (
                <div key={i.id} onClick={() => setSelectedInstId(i.id)}
                  style={{ padding: "12px", marginBottom: "8px", cursor: "pointer", minHeight: "56px",
                    background: selectedInstId === i.id ? "#1a2a3a" : "#1a1a1a",
                    border: `1px solid ${selectedInstId === i.id ? "#2a4a5a" : "#2a2a2a"}` }}>
                  <div style={{ fontWeight: "bold", color: "#e0e0e0", fontSize: "14px" }}>{t?.name || i.template_id}</div>
                  <div style={{ color: "#777", fontSize: "12px", marginTop: "4px" }}>Cycle {i.current_cycle} · Week {i.current_week} · Day {i.current_day}</div>
                </div>
              );
            })}
          </div>
        </div>
        <button style={{ ...S.btn("primary"), width: "100%", padding: "14px", fontSize: "16px" }}
          onClick={startSession} disabled={!selectedInstId || !!reviewInst}>
          {reviewInst ? "Complete TM review above first" : "Begin Session →"}
        </button>
      </div>
    );
  }

  // ── session phase ─────────────────────────────────────────────────────────
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
        {/* Modals — rendered outside card hierarchy so they don't remount with cards */}
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
            weight={weightModal.weight}
            units={units}
            onClose={() => setWeightModal(null)}
            onConfirm={(kg, applyAll) => applyWeightOverride(weightModal.exIdx, weightModal.setIdx, kg, applyAll)}
          />
        )}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px", gap: "8px" }}>
          <div>
            <div style={S.h1}>{sessionPlan.weekLabel}</div>
            <div style={{ color: "#555", fontSize: "12px", marginTop: "-10px" }}>Day {sessionPlan.day} · {doneEx}/{totalEx} done</div>
          </div>
          <button style={S.btnSm("danger")} onClick={() => { setPhase("pick"); setResting(false); }}>Abandon</button>
        </div>

        {/* Timer — rendered ONCE at session level, not inside any card (prevents restart on expand/collapse) */}
        {resting && <RestTimer key={`rest-${currentExIdx}`} seconds={restSeconds} onDone={() => setResting(false)} />}

        {/* Exercise cards */}
        {sessionPlan.exercises.map((ex, exIdx) => (
          <ExCard key={exIdx} ex={ex} exIdx={exIdx} />
        ))}
      </div>
    );
  }

  // ── summary phase ─────────────────────────────────────────────────────────
  if (phase === "summary") {
    return (
      <div>
        <div style={S.h1}>Session Complete</div>
        <div style={S.card}>
          <div style={S.cardBody}>
            <label style={S.label}>Notes</label>
            <textarea style={S.textarea} value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} placeholder="Session notes..." />
          </div>
        </div>
        <button style={{ ...S.btn("primary"), width: "100%", padding: "14px", fontSize: "16px" }}
          onClick={() => {
            // Bake weight overrides into plan before saving
            const planWithWeights = {
              ...sessionPlan,
              exercises: sessionPlan.exercises.map((ex, exIdx) => ({
                ...ex,
                sets: ex.sets.map((set, setIdx) => ({
                  ...set, weight: getEffectiveWeight(exIdx, setIdx, set)
                }))
              }))
            };
            onSessionComplete({ plan: planWithWeights, results: setResults, notes: sessionNotes });
            setPhase("pick");
          }}>
          Save Session
        </button>
      </div>
    );
  }

  return null;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [rootSchema,     setRootSchema]     = useState(null);
  const [exLib,          setExLib]          = useState(null);
  const [activeTab,      setActiveTab]      = useState("session");
  const [loading,        setLoading]        = useState(true);
  const [sessionContext, setSessionContext] = useState(null); // { weight, exName } for Plates tab
  const [user,           setUser]           = useState(null);
  const [authChecked,    setAuthChecked]    = useState(false);

  useEffect(() => {
    async function init() {
      // Try to silently restore the session using the httpOnly refresh-token cookie
      const authData = await api.auth.refresh();
      if (!authData) {
        setAuthChecked(true);
        setLoading(false);
        return;
      }
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
        api.data.schema(),
        api.data.exercises(),
        api.data.templates(),
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
    try { await api.auth.logout(); } catch { /* ignore network errors on logout */ }
    api.clearToken();
    setUser(null);
    setRootSchema(null);
    setExLib(null);
  }

  function updateSchema(newSchema) {
    setRootSchema(newSchema);
    // Fire-and-forget — UI updates immediately, server syncs in background
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
  function toggleUnits() {
    const newUnits = (rootSchema.user_profile?.units || "kg") === "kg" ? "lb" : "kg";
    updateSchema({ ...rootSchema, user_profile: { ...rootSchema.user_profile, units: newUnits } });
  }

  function handleSessionComplete({ plan, results, notes }) {
    const now     = new Date();
    const dateStr = now.toISOString().split("T")[0];
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

    const ts = Date.now();
    const newE1rms = [];
    exercisesPerformed.forEach(ex =>
      ex.set_results.filter(s => !s.is_warmup && s.e1rm_kg).forEach(s =>
        newE1rms.push({ exercise_id: ex.exercise_id, session_id: `session_${dateStr}_${ts}`, weight_kg: s.weight_kg, reps_completed: s.reps_completed, formula_used: "epley", e1rm_kg: s.e1rm_kg })
      )
    );

    const session = {
      id: `session_${dateStr}_${ts}`, programme_instance_id: inst?.id,
      date: dateStr, start_time: now.toTimeString().slice(0, 5),
      cycle_role: plan.role, cycle: inst?.current_cycle,
      week: plan.week, day: plan.day, notes, exercises_performed: exercisesPerformed
    };

    let newInsts = [...rootSchema.programme_instances];
    if (inst) {
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
      workout_sessions:    [...rootSchema.workout_sessions, session],
      e1rm_log:            [...rootSchema.e1rm_log, ...newE1rms],
      programme_instances: newInsts
    });
  }

  if (!authChecked || loading) return <div style={{ color: "#aaa", padding: "24px", fontFamily: "monospace", fontSize: "14px" }}>Loading...</div>;
  if (!user) return <AuthPage onLogin={handleLogin} />;

  const units = rootSchema.user_profile?.units || "kg";
  const tabs  = [
    { id: "session",  label: "▶ Run"   },
    { id: "plates",   label: "⊞ Plates" },
    { id: "progress", label: "↗ Stats" },
    { id: "root",     label: "⚙ Schema" },
    { id: "exlib",    label: "Ex Lib"  },
  ];

  return (
    <div style={S.app}>
      <nav style={S.nav}>
        {tabs.map(t => (
          <button key={t.id} style={S.navBtn(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
        <div style={{ flex: 1, minWidth: "4px" }} />
        <div style={S.navSep} />
        <button style={{ ...S.navBtn(false), minWidth: "44px" }} onClick={toggleUnits} title="Toggle kg / lb">
          {units.toUpperCase()}
        </button>
        <div style={S.navSep} />
        <button style={{ ...S.navBtn(false), fontSize: "12px", minWidth: "52px" }} onClick={handleLogout} title={`Logout (${user.username})`}>
          ⏻ Out
        </button>
      </nav>

      <div style={S.main}>
        <div style={S.content}>
          {/* SessionRunner is ALWAYS mounted (just hidden) so session state persists across tab switches */}
          <div style={{ display: activeTab === "session" ? "block" : "none" }}>
            <SessionRunner
              rootSchema={rootSchema}
              exLib={exLib}
              onSessionComplete={handleSessionComplete}
              onSchemaChange={updateSchema}
              onContextChange={setSessionContext}
            />
          </div>

          {activeTab === "plates"   && <PlateCalculator units={units} sessionContext={sessionContext} />}
          {activeTab === "progress" && <ProgressView rootSchema={rootSchema} units={units} />}
          {activeTab === "root"     && <RootSchemaView rootSchema={rootSchema} exLib={exLib} onChange={updateSchema} onRestore={handleRestore} />}
          {activeTab === "exlib"    && <ExerciseLibraryView exLib={exLib} onChange={updateExLib} />}
        </div>
      </div>
    </div>
  );
}

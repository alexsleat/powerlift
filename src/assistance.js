// ─── ASSISTANCE SCHEMA FIELDS ─────────────────────────────────────────────────
// Three optional fields on `assistance_by_day` entries, all additive — a template
// without them behaves exactly as before:
//
//   rep_range   [min, max]  work in a band instead of hitting one number forever
//   timing      enum        where in the session the movement belongs; the useful
//                           value is "between_supplemental_sets", which puts arm
//                           and core work inside the FSL rests it would otherwise
//                           be dropped after
//   progression object      when to suggest more load, so accessory weight stops
//                           being whatever was last typed in
//
// Pure functions, kept out of App.jsx so the fiddly parts (window allocation,
// trigger evaluation) can be unit tested — see assistance.test.js.

export const DEFAULT_TIMING = 'after_main';
const KNOWN_TIMINGS = ['after_main', 'between_supplemental_sets', 'between_main_sets', 'warmup'];
const KNOWN_TRIGGERS = ['top_of_range_all_sets', 'top_of_range_first_set'];

// [min, max] when the entry declares a usable band, else null.
// `reps` stays authoritative for anything that isn't a valid range, and timed
// work (reps_is_seconds) never has one — a band of seconds isn't the same idea.
export function repRangeOf(entry) {
  const r = entry?.rep_range;
  if (!Array.isArray(r) || r.length !== 2) return null;
  if (entry?.reps_is_seconds != null) return null;
  const [min, max] = r;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min <= 0 || max < min) return null;
  return [min, max];
}

// The target to show and log against: the band's top when there is one.
export function targetRepsOf(entry) {
  const range = repRangeOf(entry);
  if (range) return range[1];            // trust rep_range over a disagreeing `reps`
  return entry?.reps ?? entry?.reps_is_seconds ?? 0;
}

// Unknown values degrade to after_main rather than throwing, so a template
// written against a newer enum still loads on an older build.
export function timingOf(entry, { hasSupplemental = false } = {}) {
  const t = entry?.timing;
  if (!KNOWN_TIMINGS.includes(t)) return DEFAULT_TIMING;
  // Interleaving is meaningless with nothing to interleave into.
  if (t === 'between_supplemental_sets' && !hasSupplemental) return DEFAULT_TIMING;
  return t;
}

// Allocate assistance sets into the rest windows after each supplemental set,
// front-loaded: window i is the rest following supplemental set i. Entries are
// served in order and never share a window — doing two different movements in
// one rest defeats the point. Sets that don't fit stay where they were, after
// the main work.
//
// Returns plain JSON-safe annotations (the session plan is mirrored to
// localStorage as a draft, so no Maps or Sets here).
export function planInterleave(exercises) {
  const suppIdx = exercises.findIndex(e => e.role === 'supplemental');
  if (suppIdx < 0) return exercises;

  const windows = exercises[suppIdx].sets.filter(s => !s.isWarmup).length;
  if (windows === 0) return exercises;

  const bySuppSet = {};      // supplemental set index -> [{ exIdx, setIdx }]
  let nextWindow = 0;

  exercises.forEach((ex, exIdx) => {
    if (ex.role !== 'assistance' || ex.timing !== 'between_supplemental_sets') return;
    const interleaved = [];
    ex.sets.forEach((set, setIdx) => {
      if (set.isWarmup || nextWindow >= windows) return;
      (bySuppSet[nextWindow] ||= []).push({ exIdx, setIdx });
      interleaved.push(setIdx);
      nextWindow += 1;
    });
    if (interleaved.length) {
      ex.interleavedInto = suppIdx;
      ex.interleavedSets = interleaved;
    }
  });

  if (Object.keys(bySuppSet).length) exercises[suppIdx].interleavedAfter = bySuppSet;
  return exercises;
}

// Did this session's working sets hit the top of the band?
function sessionQualifies(session, exerciseId, topReps, trigger) {
  const ex = (session.exercises_performed || []).find(e => e.exercise_id === exerciseId);
  if (!ex) return null;
  const working = (ex.set_results || []).filter(s => !s.is_warmup);
  const logged  = working.filter(s => Number(s.reps_completed) > 0);
  if (!logged.length) return null;

  const reached = trigger === 'top_of_range_first_set'
    ? Number(logged[0].reps_completed) >= topReps
    : logged.length === working.length && logged.every(s => Number(s.reps_completed) >= topReps);

  return { qualified: reached, weightKg: Number(logged[0].weight_kg) || 0 };
}

// A *suggestion* to add load, never an automatic change: the lifter decides.
// Returns { fromKg, toKg, incrementKg, sessions, trigger } or null.
export function progressionSuggestion({ entry, exerciseId, sessions = [], currentWeightKg = 0 }) {
  const cfg = entry?.progression;
  if (!cfg || !KNOWN_TRIGGERS.includes(cfg.trigger)) return null;

  // Progression is defined relative to the band, so it needs one.
  const range = repRangeOf(entry);
  if (!range) return null;

  // 0 means "progresses some other way" — bodyweight range, added load we can't
  // infer. Say nothing and let the notes speak.
  const increment = Number(cfg.increment_kg);
  if (!Number.isFinite(increment) || increment <= 0) return null;

  const need = Math.max(1, Math.trunc(cfg.consecutive_sessions ?? 1));

  // Newest first, only sessions that actually contain the movement.
  const relevant = [];
  for (let i = sessions.length - 1; i >= 0 && relevant.length < need; i--) {
    const outcome = sessionQualifies(sessions[i], exerciseId, range[1], cfg.trigger);
    if (outcome) relevant.push(outcome);
  }
  if (relevant.length < need) return null;
  if (!relevant.every(r => r.qualified)) return null;

  // All at the same load, or the streak isn't a streak — someone who added
  // weight last session hasn't yet earned the next jump.
  const base = relevant[0].weightKg;
  if (!(base > 0)) return null;
  if (!relevant.every(r => Math.abs(r.weightKg - base) < 0.01)) return null;

  const toKg = Math.round((base + increment) * 100) / 100;
  // Already taken (or exceeded) this session — nothing to suggest.
  if (currentWeightKg >= toKg - 0.01) return null;

  return { fromKg: base, toKg, incrementKg: increment, sessions: need, trigger: cfg.trigger };
}

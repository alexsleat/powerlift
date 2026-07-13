---
name: review-remediation
description: Progress on fixing the database-branch code-review findings (powerlift-database-branch-review.md)
metadata:
  type: project
---

Working through `powerlift-database-branch-review.md` findings by severity, in credit-conscious batches. Branch: `database`.

**Batch 1 done (2026-07-13):** A1, A2, B1 (server/routes/data.js — ownership checks via `assertOwnership`, reconciling PUT via `deleteAbsent`, upsert instead of INSERT OR IGNORE for workout_sessions, scoped ON CONFLICT DO UPDATE, 409 on cross-tenant id). D1, D2 (`.github/workflows/docker-image.yml` — `dockerfile:`→`file:`, added SHA tags; deleted duplicate `docker.yml`).

Fixes rely on the client always sending the FULL schema (whole-schema sync, confirmed by review B10), so absent ids = deleted.

**Batch 2 done (2026-07-13):** A3 (data.js structural validation + index.js dataLimiter 120/min + body limit 10mb→2mb), A4 (access TTL 24h→15m), A5 (refresh rotation + pruneExpiredTokens on /refresh), A6 (secure cookie defaults on in production), A7 (nginx.conf security headers + CSP), A8 (escapeHtml username in reset email), A9 (jwt algorithms:['HS256']), A10 (register/reset max lengths + username charset), A12 (SQLITE_CONSTRAINT_UNIQUE code check), A13 (forgotLimiter 5/hr), A16 (removed nodemailer). B3 (App.jsx:3230 unlogged sets → reps_completed 0), B4 (App.jsx:3233 e1rm for reps >= 1).

**Batch 3 done (2026-07-13):** C1 (StrongLifts linear progression — new `working_weights` array on instance seeded in start(), read in buildSessionPlan StrongLifts branch, advanced by new module-level `updateLinearWeights()` on session complete: +increment on full success, repeat on fail, 10% deload after 3 consecutive fails, min 20kg bar, empty-bar 20kg fallback when no 1RM). C2 (A/B alternation now indexes by cumulative session count `(cycle-1)*weeksPerCycle*daysPerWeek + (week-1)*daysPerWeek + (day-1)` instead of day-of-week). working_weights passes through server as part of instance JSON blob (no server change needed).

**Batch 4 done (2026-07-13):** C3 (5/3/1 AMRAP gating, FLEXIBLE per user request re: 5s PRO). handleSessionComplete now persists `is_amrap` + `amrap_min` on each set_result (from plan set.isAmrap/set.amrap_minimum). TmReviewPanel `amrapShortfall()` gates the TM suggestion: reset −`tm_reset_percentage` instead of +increment ONLY when `progression_model.failure_handling.tm_reset_rule === "if_amrap_below_expected"` AND the lift actually logged AMRAP sets below their minimum in the latest cycle. 5s PRO (amrap_sets:false) logs is_amrap:false → never gated → normal increment. UI shows danger banner + per-row "AMRAP missed · reset" badge.
IMPORTANT CAVEAT: gate is currently DORMANT in practice — only `531_fsl` has tm_reset_rule, but its role never rotates from initial "leader" (5s PRO) to "anchor" (AMRAP) because C4 (role rotation) is unimplemented. Mechanism is correct & will fire once C4 lands or a template opts in. Also NOT done: the in-session live AMRAP warning (review C3 sub-item) — feasible since session logging already has set.isAmrap (App.jsx:2496), just not wired.

**Not yet done:** A11, A14, A15, A17, A18, B2, B5–B10, C4–C12, D3–D6, E1–E3. Node/npm NOT installed — can't run syntax checks locally.

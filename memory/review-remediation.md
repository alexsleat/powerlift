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
The C3 gate was dormant until C4 landed (batch 5) — it now fires during anchor blocks. Still NOT done: the in-session live AMRAP warning (review C3 sub-item) — feasible since session logging already has set.isAmrap, just not wired.

**Batch 5 done (2026-08-17):** C4 (macrocycle role rotation) plus two template-data fixes the user asked for after spotting them in the app.
- C4: module-level `macrocycleRoles()` / `roleForBlock()` / `blockLabel()` in App.jsx. Pattern entries without a `cycle_roles` definition are SKIPPED (so `7th_week_deload` never runs as a block — every cycle already ends in a deload week), giving 531_fsl a repeating leader → leader → anchor. `current_macrocycle_block` increments on cycle completion in handleSessionComplete, which also records `tm_review_role` (the block that just finished). TmReviewPanel honours `macrocycle_structure.tm_increase_after`: when the finished role isn't listed (the anchor) it suggests HOLDING the TM (delta 0) with a warning banner to retest. Also fixed: 5s PRO now flattens ALL core sets to 5 reps (`main_set_variant === "5s_pro"`), not just the AMRAP slot — previously a leader 3s week ran 3,3,5. previewCycleSessions projects the block forward so previews past a cycle boundary show the right role. Role/block shown on the Run and Settings programme cards.
- Anchor template `531_anchor_351_fsl` was running 3/5/1 (threes first, fives as a no-PR buffer); user wanted standard 5/3/1 with a PR set every week. Swapped weeks 1↔2, added AMRAP to both, fixed labels + name. **Id deliberately left as `531_anchor_351_fsl`** — instances link by id.
- StrongLifts Workout A had Deadlift 1×5 as its third lift; corrected to Barbell Row 5×5 (deadlift stays in B only). Added `ex_barbell_row` to exercise.json + LIFT_META + the template's lift_increments.
- Seeding: exercise.json now UPSERTS on every boot (was gated on `count === 0`, so new library entries never reached an existing deployment); `GET /api/data/exercises` unions missing built-ins into a user's saved `user_exlib`, which otherwise shadows the global table entirely. The `exercises` table is written only by the seeder, so this can't clobber user data.

**Not yet done:** A11, A14, A15, A17, A18, B2, B5–B10, C5–C12, D3–D6, E1–E3. Also unimplemented: joker sets (`joker_set_rules` on the 531_fsl anchor role is dead config). No UI to edit an instance's Cycle/Week/Day — the user works around it with the per-session week override (see [[user-training-setup]]).

Node/npm NOT installed and the Docker daemon isn't running, so no local syntax/build check is possible — JSON is validated with python, JSX by reading it back.

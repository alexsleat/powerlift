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

**Not yet done:** A11, A14, A15, A17, A18, B2, B5–B10, C1–C12, D3–D6, E1–E3. Suggested next batch (per review order #4): C1–C3 (StrongLifts progression + A/B alternation, 5/3/1 AMRAP gating — core training logic, all in App.jsx buildSessionPlan / TM review). Node/npm NOT installed on this dev machine — can't run syntax checks locally.

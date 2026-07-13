---
name: review-remediation
description: Progress on fixing the database-branch code-review findings (powerlift-database-branch-review.md)
metadata:
  type: project
---

Working through `powerlift-database-branch-review.md` findings by severity, in credit-conscious batches. Branch: `database`.

**Batch 1 done (2026-07-13):** A1, A2, B1 (server/routes/data.js — ownership checks via `assertOwnership`, reconciling PUT via `deleteAbsent`, upsert instead of INSERT OR IGNORE for workout_sessions, scoped ON CONFLICT DO UPDATE, 409 on cross-tenant id). D1, D2 (`.github/workflows/docker-image.yml` — `dockerfile:`→`file:`, added SHA tags; deleted duplicate `docker.yml`).

Fixes rely on the client always sending the FULL schema (whole-schema sync, confirmed by review B10), so absent ids = deleted.

**Not yet done:** A3–A18, B2–B10, C1–C12, D3–D6, E1–E3. Suggested next batch (per review order #3): A3 (validation/rate-limit), A4–A8 (token hygiene, secure cookies, nginx headers, email escaping), B3 (skipped sets), B4 (singles in e1RM). Then C1–C3 (training logic). Node/npm NOT installed on this dev machine — can't run syntax checks locally.

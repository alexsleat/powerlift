---
name: user-training-setup
description: Alex's live 5/3/1 anchor cycle state and how they work around the app's fixed programme position
metadata:
  type: project
---

As of 2026-08-17 Alex is mid-way through an anchor block on the `531_anchor_351_fsl` template and has already done its 5s week (logged with `week: 2`, from before the template was reordered — see [[review-remediation]] batch 5).

They chose to finish the block using the Run screen's **per-session week override** (pick Week 2, then Week 3) rather than have the programme position corrected. Consequences to remember when advising:

- Override sessions set `skipProgression`, so the instance's Cycle/Week/Day never advances and `needs_tm_review` never fires. TMs have to be bumped by hand via the TM ✎ buttons in Settings → Programmes.
- There is no UI to edit an instance's position. The other routes are Backup → edit JSON → Restore, or adding an editor (offered and declined 2026-08-17).

**Why:** they'd rather not have code added for a one-off realignment.

**How to apply:** don't assume the programme position reflects what they actually trained this block, and don't propose a position editor again unless they ask.

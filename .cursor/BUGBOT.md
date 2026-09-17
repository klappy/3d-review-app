# Promotion review is comment-only

Review both the transitional `phase-0/walking-skeleton` → `main` baseline PR and future `main` → `production` promotion PRs **comment-only**: no Autofix, direct commits, rebases or other writes to their shared head branches. The settled target is `main` for DEV and `production` for production; applying the provider cutover is separately gated.

Report findings with paths, evidence and suggested changes. Corrections belong on an isolated owned branch and a separately reviewed PR; they must pass the current gates before integration. Do not alter auth/contract, report or Design work owned by another claim.

See [the release runbook](../docs/release.md) and live kitchen HYGIENE 3. This instruction file is policy, not proof that the Bugbot service's Autofix setting is disabled; the coordinator must verify that setting before opening a promotion. Required `Cursor Bugbot` means literal `SUCCESS` on the current head, not `NEUTRAL`, queued or in-progress. Do not fabricate a success result to unblock a merge.

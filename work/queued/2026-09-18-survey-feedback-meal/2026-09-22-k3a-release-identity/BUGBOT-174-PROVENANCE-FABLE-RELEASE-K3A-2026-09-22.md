# BUGBOT PR174 — provenance evidence (read-only; Fable release worker, K3a)
Observed 2026-09-22 16:05:55Z–16:07Z (oddkit_time). Status: **RELEASE BLOCKED on corrective review.** No authored edits; no writes to 3d-review-app; Auggie holds fix custody and triage. Read-only token only (contents:read, pull_requests:read).

## Live PR174 state at 16:06Z
- Head **907bd5d2** unchanged (branch ref readback = 907bd5d2). Autofix has pushed nothing yet.
- Check-runs on 907bd5d2: `Cursor Bugbot` completed **neutral** (3 findings, review 16:00:30Z); `Cursor Bugbot Autofix` **in_progress** (app 1210556); `Workers Builds: 3d-review-dev` completed success (preview build, not a plate).
- PR is 28 commits / 28 files against main 9f2e4b44 because it carries PR171's accepted source lineage plus my one metadata commit. Bugbot reviewed the whole diff-to-main, not just the six metadata paths.

## The three findings — exact locations and blame at c9bf
| # | Sev | File:line (907bd5d2) | Introducing commit (git blame at c9bf) | In my six paths? |
|---|---|---|---|---|
| 1 | Medium | ui/assess/scope.js:193 (+228–234, 265–270) — workspace/workspaces/projects/project renders omit eyebrow+h1 when kit shell absent (`/assess/` non-kit host) | **b918faa6** "K3a normal-root read adapter" | No |
| 2 | Medium | ui/assess/assess.js:578 (+ui/kit/tree.js:16–37) — `#demo-notice` inserted via `app.before()` as sibling of `[data-content]`; kit repaint preserves only content mount + header host, so demo disclosure disappears | **b918faa6** | No |
| 3 | Low | ui/assess/scope.js:62 (+307–316) — second `data-act="retry"` (languages) added, but `bindRetry` binds `querySelector` first match only; languages Retry inert when both fail | **f52fce62** (review F1–F3 fix) | No |

**All three defects live in the accepted K3a functional source (c9bf), not in the 0.16.0 metadata commit 907bd5d2** — `git diff --name-only c9bf..907bd5d2` touches 0 files under ui/. They were not caught by the bounded independent ACCEPT 83d605cf (which inspected the two-path stacking delta and ran 15 root tests) nor by the earlier b918faa review.

## Implications for release identity (for Auggie/root triage; not decisions of mine)
- The 0.16.0 canonical record (cookbook 20d51447) cites c9bf as accepted source. If the fix lands as a new source head, the record's "Exact source" and the app pin's base change: manifest cookbook_commit stays (record unchanged) only if the canonical record is amended to the corrected head; otherwise a new canonical revision is needed. Version number 0.16.0 is unaffected as long as nothing has shipped under it (nothing has).
- Autofix pushing to `release/k3a-0.16.0-20260922` would land unreviewed source on my release branch (HYGIENE line 3 promotion-PR caveat; here the PR targets main, not production, so the ruleset permits it, but review of the exact new head remains required). I will not rebase, amend, force-push or otherwise touch the branch while Autofix is in progress.
- Whatever head results, the six metadata paths must be re-verified against it: byte copies still equal the pin blobs, `npm run stamp`/version-stamp/typecheck rerun, six-path diff recomputed from the new source base.

## What I will do on explicit safe handoff (and not before)
Re-read head; re-run stamp/version-stamp/typecheck at the exact new head; recompute diff vs the corrected source base; report allowed differences exactly; amend receipt. No source edits unless custody is explicitly handed to me.

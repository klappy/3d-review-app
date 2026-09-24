# Stacking fix receipt + 30-minute-release ACK — Fable local
Observed 15:16:44Z start; receipt written ~15:22Z. Review read: INDEPENDENT-CLAMP-REVIEW-185ede97 @ kitchen 47ec1bc4.

## Fix (ui/index.html only; 13 paths)
- Cause: `header.top`, `aside` and content each carry `backdrop-filter` (own stacking contexts, z auto) — later siblings painted over the header's absolutely positioned menu. Fix: `.rv header.top{position:relative;z-index:40}` and `.rv .shell{position:relative;z-index:1}`. Clamp and keyboard behaviour retained.
- Head **`c9bf2b1e0ad3e9ae1d679cb286959a5b21bab822`** (remote readback equal). 435/435 `node --test`, `tsc` clean, wrangler `--local` asset proof at c9bf2b1e. Stable bundle rebuilt: manifest app_head c9bf2b1e, output sha256 8e0d57f6eb423442…. PR #171 comment posted.
- Proof (browser probe `openmenu=1`, actual `document.elementFromPoint` at each item centre + dispatched click reaching the item; Escape/focus/context recorded): **all 5 items hit and clicked at 195×422 (long email), 390×844, 720×450 (long email) and 1440×900**; Escape closes and returns focus in all four; context panel hidden on phone cases (open by design on desktop). File `evidence/k3a-menu-hit-proof-c9bf2b1.json`. Headers unchanged 75/57px.
- Reviewer: delta from 185ede97 is one CSS pair + a rule guard; affected hit/keyboard proof above.

## ACK — Chris policy: 30-minute sprints, ship a release every 30 minutes; full rollout target 4–6 h
ACK. Superseding the one-batch strategy for my work: every increment lands on its own branch/PR with head, tests, wrangler proof and browser evidence; review/DEV/production gates stay real; Auggie runs the releases; I do not deploy.

### Smallest coherent first increment (releasable now, pending gates)
**R1 = K3a at c9bf2b1e** — compact kit shell on the real root (workspaces/workspace/projects/project reads + retained actions; assessment/survey/permissions/feedback routes unchanged inside the shell). Independently usable today. Blocking checks (owner): independent acceptance of c9bf2b1e (hit proof + PNGs — reviewer), DEV promotion + real-auth smoke on DEV (coordinator/service gates), canonical pin (coordinator). My side is complete unless review finds more.

### Next increment prepared (no idle): R2 = K3b1 feedback-in-place
Ready to start the moment SOURCE FIRE lands: worktree plan, 6 known conflicts, `.assetsignore` amendment request (blocker #22), probe hooks planned. 30-minute slot 1: merge + conflicts + boot/intercept reconciliation + suites green. Slot 2: focus containment + stale/privacy regressions + browser probe → releasable R2.

## Reassessment against the 4–6 h target (honest; scope not reduced)
Critical path (sequential on the shared assess.js/feedback seam, single writer): R1 gates → R2 K3b1 (2 slots) → K3b writes/permissions/report/survey kit presentations (the largest remaining body: ~8 acceptance rows across existing controllers; 4–6 slots) → K6 whole-batch visual/route/state proof. Sequential padding I can remove: no re-boarding, harness/manifest/probe tooling already exists and is reused per head, gates run per increment instead of at the end.
Bounded work another authorized Claude cook could own **without file collisions with my seam** (assess.js, scope.js, index.html, feedback*, kit/app-adapter, kit/core, kit/tree): (a) **K4 participant + print** — `ui/participate/*`, `ui/participant-*.js`, `ui/stage-screens.*` (print) with their own tests; (b) **K5 legacy/code/export** — `ui/legacy/*`, `ui/public-entry.js`, `ui/shared-link.js`, `ui/report-*.js`; (c) **K6 evidence tooling** — the 90-capability matrix runner and PNG capture pipeline against each declared bundle (evidence-only files). Each needs its own dish/custody from Auggie; they touch no K3 path.
Best case with two parallel cooks and ≤30-min review turnarounds: R1 accepted + R2 shipped + K3b core reads/writes presented ≈ 4–6 h of my active time is plausible for **K3a+K3b1+K3b-core**; **K4/K5 in parallel** could fit the same window; **K6 whole-batch proof + final canonical release** is the limiting dependency — it can only start once all increments exist, and its independent review is not in my control. Likely: 6–8 h wall clock for the full set assuming no new blocking findings. What I will not do: claim the 4–6 h as a promise, or drop acceptance rows to fit it.

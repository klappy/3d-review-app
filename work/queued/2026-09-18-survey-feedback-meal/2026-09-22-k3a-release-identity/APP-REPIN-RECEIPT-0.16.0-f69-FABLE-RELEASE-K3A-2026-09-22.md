# APP REPIN RECEIPT — 0.16.0 on corrected source f69 (Fable release worker, K3a)
Observed (oddkit_time): FIRE read 17:44:17Z; chain verified + gate 17:44–17:45Z; branch created and read back 17:45Z (actual START); commit, checks, push and PR by 17:46Z; this receipt 17:46:16Z. Release preparation only — NOT merged, NOT deployed, NOT tagged. K5 checkpoint 10cd7e0c untouched; PR174 and cloud untouched.

## Immutable canonical chain verified (local git, cookbook clone)
- Cookbook PR103 merged: merge commit **3e31ad2f72c739f2c993906ca7bd25667a980c0f**, parents 20d51447 (prior main) + a5abe0c7 (my amendment head); cookbook main == 3e31ad2f at read.
- `git rev-parse 3e31ad2f:planning/2026-09-16-parity-build/releases/0.16.0.md` = 651e97ac291417bb364b91bc6505d40288712475, sha256 d16c0aa5223963572732db7588a9b09ce3a144315fe642de92e8f48e11119bea.
- `…/releases.json` = 4b6c03e0867a7a541b4c2de156f7bfc58f3d06d3, sha256 7d5c98da351eca19c95babb79fb37a1e87961ba36c34fcc2da27670365e3a9bb.
- Both merged blobs byte-identical (cmp) to the amendment I authored. Drift check: PR175 head still f69ac5c3cadcd848fdf3537d57867df2f81c9a6e, open; PR174 still 907bd5d2; no prior `release/k3a-0.16.0-f69*` ref.
- Note: the PR103 head check-runs endpoint returned no `check_runs` field to my read token at 17:44Z; the "3 checks SUCCESS, no findings" statement is Auggie's FIRE text, not re-observed by me.

## Gate at final revision
oddkit_gate planning→execution: invocations 1–2 mis-detected as captain-escalation (trigger words "author"/"worker performs"); invocation 3 **PASS 4/4**, knowledge_base. Preflight/challenge for this order were run at 17:04Z (see CANONICAL-AMENDMENT-RECEIPT); the repin is the same order's second half at the same scope.

## App candidate
- Branch `release/k3a-0.16.0-f69-repin-20260922` from exact f69; one commit **fb6b2e05508166cb508446f730730003721aee52**, tree e4611046402d54e1e767c0d30874d8585c0c7113, author/committer klappy no-reply. Remote ref readback = fb6b2e05.
- PR **klappy/3d-review-app#176** https://github.com/klappy/3d-review-app/pull/176 — head fb6b2e05 → main (base 9f2e4b44), non-draft, assigned klappy, no review requested.
- `git diff --stat f69..fb6b2e05`: **3 files** (+32/−12); paths outside the six = **0**. Changed: release/cookbook/0.16.0.md and releases.json (`git hash-object` = pin blobs 651e97ac / 4b6c03e0); release/release-manifest.json (version 0.16.0 unchanged, cookbook_commit 3e31ad2f, two records with the blob/sha256 above, changelog.sections = pinned 0.16.0 entry). Unchanged because unneeded: package.json 0.16.0, package-lock.json root + packages[""] 0.16.0, test/version-stamp.test.ts (no literal or path moved).

## Observed checks at fb6b2e05 (worker, sandbox clone)
- `npm run stamp` → `stamp-version: 0.16.0+fb6b2e0 (release_source 3e31ad2)`.
- `npx vitest run test/version-stamp.test.ts` → 16 passed / 0 failed (includes: manifest records recompute blob/sha256 from the copies; changelog.sections deep-equal pinned json; markdown bullets equal json; health build `0.16.0+<sha7>`; MCP serverInfo 0.16.0; generated files ignored).
- `npm run typecheck` → exit 0. Generated src/version.generated.ts and ui/changelog.json remain git-ignored. No full-suite, build, DEV or provider claim.

## Remaining gates (named, not closed)
Independent exact-head review of #176; Cursor Bugbot App 1210556 SUCCESS + every attached check on fb6b2e05; candidate-specific issue14/cargo hold disposition; guarded merge by Auggie → observed DEV push-event build/version/deployment (expect `0.16.0+<merge sha7>`, release_source 3e31ad2) and root desktop/phone journey → separate same-version/same-pin production PR with effective Bugbot comment-only configuration evidence and independent review. No exception from167/169. Owner available for corrections on this branch.

# CHECKLIST — K3a release-metadata sprint (Fable release worker, under Auggie)
Revision 2 — observed 2026-09-22T16:07Z (oddkit_time). **Status: RELEASE BLOCKED on corrective review — NOT completed.** Canonical slice merged (cookbook 20d51447); app metadata PR174 head 907bd5d2 open; Cursor Bugbot neutral with 3 findings in accepted K3a source (not the six metadata paths); Autofix in_progress; Auggie owns fix custody. Worker holds branch untouched, read-only until explicit safe handoff. Provenance: BUGBOT-174-PROVENANCE-FABLE-RELEASE-K3A-2026-09-22.md.

## Blocked-state checklist (current)
- [x] canonical slice — PR102 merged 20d51447, blobs a0f0173c / 5e644077 verified
- [x] app metadata slice — PR174 head 907bd5d2 from c9bf; 6/6 paths, stamp 0.16.0+c9bf2b1, 16/16, typecheck 0
- [ ] **BLOCKED** independent exact-head review — 3 Bugbot findings (scope.js:193 titles; assess.js:578 demo notice; scope.js:62 retry) require corrected source; Autofix writing
- [ ] re-verify six paths against corrected head (byte copies, stamp, tests, typecheck, diff) — after handoff
- [ ] canonical record amendment if accepted source head moves from c9bf — Auggie/root disposition
- [ ] Bugbot SUCCESS + all attached checks on the final head
- [ ] issue14/cargo hold disposition; guarded merge; DEV observation; separate production PR with configuration evidence
Original revision-1 checklist retained below for lineage.

Revision 1 — observed server_time 2026-09-22T15:36:57Z (oddkit_time). Status then: READY / AWAITING EXACT FIRE. Supersedes two lines of CLAIM f268df33 (corrections below). No cookbook/app writes performed at that time.

## Corrections to CLAIM f268df33 (owner errata, no new claims)
- Chronology: the CLAIM said the 15:48Z slot "was already past by claim time (15:33Z)". That was arithmetic error, not observation. Observed: claim commit landed before 15:33Z; 15:48Z slot was still 15 minutes ahead. Forecast (not observed): a 30-minute canonical increment started at FIRE cannot land by 15:48Z; a fired-at-15:40Z increment forecasts ~16:10Z. Any actual miss will be reported at the observed clock, never back-dated.
- PR scope: GitAuth issued `pull_requests:write` scoped to 3d-review-cookbook and 3d-review-app on request (15:36:59Z, expires 16:36:59Z; contents stays read on that token; a separate contents:write token will be minted per repo at FIRE). Verified by reading cookbook open PRs: 20 open, only release-numbered PR is #99 (0.15.0 @ 7c1bd9e). **No 0.16 PR exists.** I can open PRs myself; Auggie/root fallback not needed unless the write token is refused.

## Checklist — canonical slice (increment 1, 30 min after FIRE)
- [ ] oddkit_time; refresh cookbook main SHA, branches, tags, open PRs, releases.json `current` — abort on any 0.16 collision
- [ ] mint contents:write token scoped to 3d-review-cookbook only
- [ ] branch `release/0.16.0-kit-root-20260922` from refreshed cookbook main
- [ ] author `planning/2026-09-16-parity-build/releases/0.16.0.md` — candidate; scope = accepted K3a root/navigation @ c9bf2b1 (PR171), source acceptance 83d605cf cited; test counts read fresh from c9bf, no inherited 435; persona sentiment NOT MEASURED; no tag/date/released
- [ ] prepend 0.16.0 entry to `releases.json`, set `current` 0.16.0, preserve every prior entry byte-for-byte (diff shows additions only); sections mirror 0.16.0.md bullets verbatim
- [ ] commit (author klappy no-reply), push branch, open normal PR → main; assign operator, no review request
- [ ] return: PR URL, head SHA, blob ids + sha256 for both files, to this dish (RECEIPT file) — no merge by me

## Checklist — app slice (increment 2, only after immutable canonical merge)
- [ ] read merged cookbook main SHA (immutable pin); `git rev-parse <pin>:<path>` both records; sha256 both
- [ ] fresh drift review: PR171 head still c9bf2b1? if moved → stop, report
- [ ] mint contents:write token scoped to 3d-review-app only; branch `release/k3a-0.16.0-20260922` from c9bf2b1
- [ ] byte-copy `release/cookbook/0.16.0.md`, `release/cookbook/releases.json`
- [ ] `release/release-manifest.json`: version 0.16.0, cookbook_commit <pin>, two records (path/blob_sha/sha256), changelog.sections = json entry
- [ ] `package.json` version only; `package-lock.json` root + packages[""].version only
- [ ] `test/version-stamp.test.ts`: current-release literals only (0.14.5→0.16.0 at lines 28, 49, 61–62, 67, 74, 79, 86, 114, 130, 162, 164); logic and historical fixtures untouched
- [ ] `npm run stamp` → expect `0.16.0+<sha7> (release_source <pin7>)`; version-stamp suite; `npm run typecheck` — record exact counts/failures, no pass claimed until observed
- [ ] `git diff --stat c9bf2b1..HEAD` = exactly six paths; generated files still ignored
- [ ] push, open PR → main (draft until independent review), assign operator
- [ ] return: PR URL, head/base/tree SHAs, canonical pin, test output, remaining gates (independent review, Bugbot App 1210556 SUCCESS, issue14/cargo hold disposition, Bugbot comment-only setting evidence for later promotion) — no merge, deploy, tag by me

## Standing boundaries
No product behavior change; no edits outside the 2+6 paths; no touch of PR171/K3b/K4/0.15 cargo; no main/production write; no force push; no manual deploy; tokens scrubbed after each write; existing auth boundaries only.

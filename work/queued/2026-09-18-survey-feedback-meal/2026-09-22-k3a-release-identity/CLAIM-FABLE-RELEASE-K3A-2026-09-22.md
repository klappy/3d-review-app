# CLAIM — Fable K3a release-metadata worker (third local Fable, under Auggie)
2026-09-22 (America/New_York; observed server_time 2026-09-22T15:28Z–15:32Z via oddkit_time). Status: OWNER CLAIM / READINESS ONLY / NOT FIRED. Order read: TICKET.md blob 42ff1a4d @ kitchen 1043a6fe; INDEPENDENT-PLAN-REVIEW-2026-09-22.md (ACCEPT) @ kitchen main 2f9ff316.

## Authentic identity
- Surface: fresh Claude Cowork local session in the CoS project, task 07f7043c / worker 77bbdfa3, distinct from the first Fable (K3a source, `app/` + `evidence/`) and the second (K4, `worker-k4-participant/`). Model observed: claude-fable-5-1 (effort setting not observable; not claimed).
- Runtime observed: isolated Linux sandbox, node v22.23.2, npm 10.9.8, git 2.34.1. Only `/Users/chrisklapp/Documents/3d-review-fable` mounted. Own subfolder created: `worker-release-k3a/` (app/, cookbook/, evidence/). Sibling worker trees NOT touched.
- Role: release-metadata cook under Auggie. Not CoS chair. No product behavior changes; no merge or deploy by me.

## Immutable inputs read (GitAuth klappy installation, contents:read, HTTP 200)
- kitchen line check: KITCHEN.md, health-code/RULINGS.md, LANES.md, HYGIENE.md 1.30.0 (line 3 pass/plate, 19 one-version-one-place, 3D Review supersession 2026-09-17, 20 queue workers pull).
- 3d-review-app: PR171 open draft, head design-batch/fable-k3a-20260922 @ c9bf2b1e0ad3e9ae1d679cb286959a5b21bab822 → main; main 9f2e4b44 (merge #167). package.json 0.14.5; package-lock root + packages[""] 0.14.5; release/release-manifest.json version 0.14.5, cookbook_commit 97af53e83624d3992884ad1d2520b34bd61b74af, records 0.14.5.md blob 91bea67f / sha256 c994a986…, releases.json blob c381466d / sha256 c9831b19…. test/version-stamp.test.ts literals: "0.14.5" at lines 28, 49, 61–62, 67, 74, 79, 86, 114, 130, 162, 164. Branch release/k3a-0.16.0-20260922: ABSENT. Tags: 10 (v0.2.0…v0.8.0), no v0.15/v0.16.
- 3d-review-cookbook: main ac10348b (moved past the app pin 97af53e; pin still resolves). releases.json@main current 0.14.5, 33 record files, no 0.15.0/0.16.0 on main. Branch release/feedback-in-place-0.15.0 @ 7c1bd9e4 carries current 0.15.0 (historical open candidate — retained, untouched). Branch release/0.16.0-kit-root-20260922: ABSENT. Remote tags: 0.
- Local clone verification: `git rev-parse 97af53e:…/0.14.5.md` = 91bea67f49a04d7cf59579d014bb3b9cff90f061, sha256 c994a98623c2692fd5e81fbeee9c3e0d6b7bee936eb1f2c79cbf27db887367c7; `…/releases.json` = c381466dfc0054473c5bd648809b6294a5531b88, sha256 c9831b19f1c1ff53f8741b6e0f533a0be19d16d7b00b7c55f39af1fa8a5f2eb6. Both match the manifest byte-for-byte.
- Version authority read: app docs/release.md@c9bf lines 68, 77, 80 (MINOR under 0.y for changed accepted behaviour; candidate until root tag step; same-version DEV→production). 0.16.0 MINOR is collision-free as of 15:31Z reads; refresh again before every write.

## Local runtime proof at c9bf (baseline, no candidate edits)
- `npm ci` locked deps OK (23s). `npm run stamp` → `0.14.5+c9bf2b1 (release_source 97af53e)`; generated src/version.generated.ts and ui/changelog.json are git-ignored (`!!`).
- `npx vitest run test/version-stamp.test.ts` → 16/16 passed. `npm run typecheck` → tsc clean. Evidence files under worker-release-k3a/evidence/.

## Custody ACK — exact paths (ticket 42ff1a4d)
Canonical (klappy/3d-review-cookbook, branch release/0.16.0-kit-root-20260922, normal PR): 1 planning/2026-09-16-parity-build/releases/0.16.0.md (new) · 2 planning/2026-09-16-parity-build/releases/releases.json (prepend 0.16.0 candidate; preserve every prior entry; no tag/date/released).
App (klappy/3d-review-app, branch release/k3a-0.16.0-20260922 from c9bf, only after immutable canonical merge): 3 release/cookbook/0.16.0.md · 4 release/cookbook/releases.json (byte copies) · 5 release/release-manifest.json · 6 package.json version only · 7 package-lock.json root + packages[""].version only · 8 test/version-stamp.test.ts current-release literals only.
Everything else read-only. No edits to PR171 branch, K3b/K4 branches, 0.15 cargo, scripts/config/generated files or controllers. No main/production write, merge, tag, deploy or force push. Generated files never hand-authored.

## Gates (actual, this owner)
- oddkit_preflight 15:31:51Z: FOUND; DoD klappy://canon/definition-of-done; constraints surfaced: governance-change-discipline, release-validation-gate (same-session smoke is not validation); pitfalls: test output for logic, reference decisions.
- oddkit_challenge (planning) 15:31:56Z: CHALLENGED, knowledge_base, tensions none, block_until_addressed false. Responses: confidence = working belief on fresh reads at cited refs (15:31Z), not a reservation; comparison target = open 0.15.0 candidate @ 7c1bd9e (described above) vs new 0.16.0; disconfirmer = any 0.16 ref/PR/index entry appearing before write, or head drift from c9bf → retract and return to Auggie; assumption under test = major-zero MINOR reading of docs/release.md line 80, validated by independent review; no new term coined.
- oddkit_gate planning→execution: invocations 1–3 NOT_READY (two mis-detected as captain-escalation on the words "coordinator/independent review"; one 2/4 with irreversibility and constraints unstated); invocation 4 with both stated PASS 4/4, governance_source knowledge_base. Owner gate PASS is a prerequisite, not FIRE.

## Own promise (binds only at Auggie SOURCE FIRE)
First 30-minute increment (canonical slice): refresh cookbook index/branches/tags; create release/0.16.0-kit-root-20260922 from cookbook main; author 0.16.0.md and releases.json entry from actual c9bf evidence (source acceptance 83d605cf, current test counts read fresh, no inherited 435); push; open normal PR; return PR URL, head SHA, both blob ids and sha256 to this dish. Forecast after independent canonical merge: one further 30-minute increment for the six app paths (byte copies, manifest, package/lock, test literals), `npm run stamp` + version-stamp suite + typecheck output, full `git diff --stat c9bf..head` proving only six paths differ, PR opened against main. Retracts on version collision, head drift, or byte mismatch — reported, not skipped.

## Blockers / capability gaps (exact, not simulated)
- Auggie callback channel not observed in this session; return is this session + this Git receipt. No recipient ACK invented.
- GitAuth token lacks pull_requests scope: cookbook PR list returns 403 (app PR list readable). PR opening at FIRE needs `pull_requests:write`; PR-level collision check on cookbook currently relies on branch/tag/index reads only.
- Mounted worktree refuses some unlink operations (git index.lock/pack tmp warnings); reads, stamp, tests and typecheck succeeded. If a commit fails on the mount, fallback is a sandbox-local clone with evidence mirrored into worker-release-k3a/evidence/.
- 3d-review-app and cookbook write capability untested (first tested at FIRE by branch creation). Bugbot App 1210556 comment-only setting evidence not observable to me; remains a named prerequisite for later promotion, not for this preparation.

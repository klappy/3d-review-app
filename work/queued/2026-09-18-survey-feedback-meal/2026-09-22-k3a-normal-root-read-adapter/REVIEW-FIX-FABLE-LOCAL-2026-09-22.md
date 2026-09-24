# REVIEW FIX — Fable local K3a, independent code review b918faa (F1–F3)
Observed clock: ACK 2026-09-22T14:29:57Z; gate 14:32:16Z. Owner: Fable local Cowork delegate (claim 3dfbd195). Review read at kitchen 7096aa3c.

## ACK
All three findings accepted as required corrections and applied on the owned branch to the successor of 5ba6e392 (head before fix: 7dca20bd). No new worker, no permission change, browser work preserved.

## Fix commit
- `f52fce62d3294559ba3b39d26c91bc8bc8393a75` on `design-batch/fable-k3a-20260922` (remote ref readback equal). Draft PR #171 updated by push. Diff vs the K2 merge 8ae3546 still touches exactly the thirteen ticket paths (outside: none).
- F1 (`ui/assess/scope.js`): new `swap(ctx, root, page, next)` — retry and the workspace/project `reload` closures replace the DOM only while `ctx.isCurrent()` holds, and pass the new model to `ctx.pageModel` so the shell is re-synced from the same data (`ui/assess/assess.js` runPage supplies `pageModel`, no-op when stale or when the page is not the top-level content).
- F2 (`ui/assess/assess.js` ctxFor): `ctx.go` is bound to the creating render generation + identity like `api`/`apiFull`/`note`; a late completion cannot navigate or note. (It cannot undo an already dispatched write — presentation guard only, as the review states.) `setToken` deliberately left unguarded: a minted session is identity-level state and dropping it silently would be less truthful.
- F3 (`ui/kit/app-adapter.js`): `role` is the loaded current-scope role or empty — never 'Member'/'Guest'; `ui/kit/core.js` chrome and `ui/kit/tree.js` footer omit the " · " separator when the role is empty.

## Disconfirming regressions (author copies of the reviewer's cases)
- `test/kit-root.integration.test.mjs`: "F1: a retry that completes after navigation never overwrites the newer route; a current retry re-syncs the shell"; "F2: a create completion arriving after navigation does not redirect the newer route" (deferred synthetic SUCCESS for the single POST /v2/workspaces, no real request); "F3: viewer-only identity shows no synthesized role; scope role appears only where loaded".
- `ui/kit/app-adapter.test.mjs`: shell-model case extended (signed-in without scope role → role ''; viewer-only project → 'Viewer' in shell and tree).
- Proof they disconfirm: with the five product files stashed back to 7dca20bd and the new tests kept, `node --test` reports the three F-cases + the adapter case FAILING (4 fail / 13 pass); at f52fce62 they pass.
- Full run at f52fce62: `node --test` over all ui/test suites **429 pass / 0 fail**; `npm run typecheck` clean.

## Regenerated proof at f52fce62
- Harness rebuilt: `evidence/k3a-harness/{index.html,manifest.json,build-harness.mjs}` in the approved folder; manifest `app_head` f52fce62, 26 modules → sha256/blob; output sha256 324319682e02516a….
- Observed in Mac Chrome (file://, synthetic transport, read-only screenshots): desk 1440×900 `identity=viewer` `#project/p2` → header "Signed in · Viewer", crumbs Projects › Hill project VIEWER, "Assessments are not visible to you here.", "Languages could not be loaded. Retry" (distinct settled states, no empty success); phone 390×844 `identity=viewer` `#workspaces` → header "Signed in" with NO role label, tree rows carry their own loaded VIEWER badges. Earlier owner journeys unchanged in structure. Reproduce via `frames.html?identity=…&view=desk|phone&hash=…`.

## Gate at final revision (oddkit_gate, governance knowledge_base)
- First invocation NOT_READY 3/4 (irreversibility phrasing not matched — recorded, not counted). Corrected invocation naming what cannot be undone: **PASS 4/4** planning→execution (decisions_locked, dod_defined, irreversibility_assessed, constraints_satisfied) at 14:32:16Z.

## Still open (not claimed)
Reviewer's note on workspace-owner duplicate project cards (read region vs retained management region): present by design of the retained action region and visible in the #workspace/w1 desktop capture; awaiting visual-proof assessment against the no-duplicate-read criterion rather than declared resolved. Asset-exclusion runtime proof (Wrangler 404 for kit/app-adapter.test.mjs) not run here (no wrangler dev in this session). Frozen-reference fidelity, DEV/production and K3b–K6 remain separate.

## Amendment — captain role clarification (observed 14:33:12Z)
Ruling recorded by Auggie: roles are exactly **Owner, Member, Viewer**. Reconciled with the controller contract (`src/policy.ts` RANK owner|member|viewer; `scope.js` CAN_EDIT owner|member).
- Commit `46b23d104d35fedd5d1d63eecfe8d124b67a384c` (remote readback equal; PR #171 updated). `ui/kit/app-adapter.js` exports `ROLE_LABEL`/`roleLabel()`: strict map owner→Owner, member→Member, viewer→Viewer (case-insensitive input); Viewer displays as Viewer; missing or unknown (e.g. 'admin') yields NO label — a separate condition, nothing invented. Applied to shell role, crumbs badge, tree node badges and the direct-grant node.
- Tests: `ui/kit/app-adapter.test.mjs` role-contract case (all three labels in shell/tree/workspace/assessment models; unknown not promoted; actions always []); `test/kit-root.integration.test.mjs` end-to-end per identity at #project/p1 — header "Signed in · Owner|Member|Viewer", crumbs badge, current tree row badge; write regions follow only the controller permission (owner: create/rename/add-language; member: create/add-language; viewer: none); no kit level menu ever rendered. F1–F3 disconfirmers unchanged and passing.
- `node --test` **431/431**; `tsc` clean; thirteen paths only (outside: none).
- Harness/manifest rebuilt at 46b23d10 (output sha256 fcc8e3c03a375f3e…). Chrome observed desk 1440×900 `identity=member` `#project/p1`: "Signed in · Member", crumbs Projects › River Valley MEMBER, tree MEMBER badges, member forms (create assessment, add language; no rename). Earlier viewer captures at f52fce62 ("Signed in · Viewer" at p2; no label at #workspaces where no scope role is loaded) remain consistent with the ruling.
- Gate: no transition changed since PASS 4/4 at 14:32:16Z (same mode, corrective revision); not re-run.

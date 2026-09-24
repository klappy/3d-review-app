# CLAIM/ACK — Fable local, K3b2 workspace lifecycle (same owner, four paths)
Observed 15:57Z. Read: TICKET @ kitchen f2f81db8; independent plan ACCEPT d1212a87 (by pointer). Status: **custody ACK + estimate + owner gates only — no product edits until Auggie FIRE and the accepted PR172 successor is named.**

## Custody ACK (exactly four paths)
ui/assess/scope.js (workspaces/workspace render/bind + minimal shared write guard only); ui/assess/scope.test.mjs; test/kit-root.integration.test.mjs; test/fixtures/kit-root-transport.js. No assess.js/kit/global styles/.assetsignore/participant/feedback/backend/metadata edits; scope escape → bounded amendment. Frozen interface honoured: pages.* load/render/bind, ctx api/esc/enc/go/note/state/routes/isCurrent/pageModel, form ids create-workspace/add-project/rename-form and item-scoped data-remove, existing swap()/pageModel.
Serial custody note: `ui/.assetsignore` stays mine; the K4 participant test-asset exclusion line will be applied by me only on Auggie's exact line, never concurrently.

## Seam as read today at efb53588 (basis for the estimate)
- scope.js `workspaces.render`: kit read cards + `data-action-region` with `#create-workspace`. `workspace.render`: kit head/cards + action region with names-only `[data-remove]` rows, `#add-project` (candidates select, status-aware), `#rename-form` (owner). All handlers already call the real endpoints listed in the ticket through `write()`.
- Currentness gap to close (assumption to falsify with a negative test first): `write()` re-enables its controls in `finally` regardless of `ctx.isCurrent()`, so a late completion could re-enable a detached/new-view control; `ctx.go` after create is already generation-bound (F2), `swap()` already guards reload (F1). Fix = minimal guard inside owned scope.js.

## Own increment plan and range (binds at FIRE)
- Sprint 1 (30 min): workspaces list → kit create form (real `#create-workspace`, native required/maxlength, escaped names) → POST /v2/workspaces → route only to the returned id; missing-id and refusal/uncertain outcomes truthful; stale success/rejection after route change neither navigates nor re-enables; desktop/phone browser proof; exact head/tests.
- Sprint 2 (30 min): workspace page — one kit project card carrying its permitted remove action (no duplicate rows), add-project candidates (loaded/failed/empty distinct), owner rename; two-project distinct POST/DELETE targets; grant disclosure retained; pending action cannot fire twice; reload via pageModel updates card + tree; role cases owner/member/viewer.
- Likely: 2 slots (60–75 min active); range 2–3 slots if the negative tests expose more currentness seams. Not a promise of full P04 until all seven outcomes pass.

## Owner gates (planning, exact)
- `oddkit challenge` (planning) 15:57:03Z: **CHALLENGED, block_until_addressed=false, tensions []**, one generic prerequisite left honestly open ("principle not anchored to multiple cases" — this is one seam at one head; no principle claimed).
- Preflight/gate to be run at FIRE against the named accepted base (not now, to avoid a stale gate).

## Dependencies / blockers
Accepted PR172 handoff (independent real-browser review passed at efb53588; release gates Auggie's); Auggie FIRE naming the exact base; independent four-path review d1212a87 (pointer received).

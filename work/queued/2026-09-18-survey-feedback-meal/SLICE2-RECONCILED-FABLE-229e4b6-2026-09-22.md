# Slice 2 reconciled successor — accepted cloud 66570472 merged (participant integrator)
2026-09-22. Order 6bea8164 + independent ACCEPT ddfbb428 read 18:08Z; ACK; merge pushed 18:09:08Z; successor proof complete 18:11Z. Active effort ≈ 3 min. Status: SUCCESSOR CANDIDATE FOR INDEPENDENT EXACT-HEAD REVIEW / NOT ACCEPTED / NOT RELEASED. Original 78301eb evidence (d224f9fa, evidence/slice2/) preserved as historical.

## Head
- **229e4b62475ac2c7dea3f938a136682ec0ed4735**, tree **8b2ee72d3c2d311e77e1c322f68a4111f332dd76** (= the reviewer's predicted tree, byte-exact), parents 78301eb54f0d27199cb3bbb4e6048292880645d8 + 66570472a439e5a59c433fede030cb19ff7369fc. Remote readback equal; PR #177 now at this head.
- Merge was clean (no hand edits). 66570472 is a direct child of base fb6b2e05 (merge-base fb6b2e05). Alternative 1768e513 / PR #178 not consumed.
- Delta 78301eb→229e4b6: exactly the seven cloud paths (+39/−8): test/kit-root.integration.test.mjs (+3 parent-link assertions inside slice1 tests), ui/assess/assess.js (workspace.role kept in the guarded cache), identity-reset.test.mjs, scope.js (pageBack: non-kit host keeps ← All workspaces / ← All projects; kit host relies on crumbs), scope.test.mjs, kit/app-adapter.js (role-less cache no longer hides a later-loaded role; cached role kept), kit/app-adapter.test.mjs.
- Union vs base fb6b2e05: exactly **24 paths** (19 + the 5 newly permitted). package.json / package-lock.json / release/* byte-identical to base; canonical 3e31ad2f and 0.16 metadata untouched; no version allocated.
- Both root regression blocks present (26 tests in kit-root.integration.test.mjs incl. slice1 + K3b1 groups); .assetsignore still exactly one assess/feedback-modal.test.mjs + one kit/participant-presentation.test.mjs.

## Gates (this owner)
oddkit_preflight FOUND (canon-integration-audit, DoD). oddkit_gate: two invocations misrouted to execution→captain-escalation on operational vocabulary (recorded, not counted); third planning→execution NOT_READY 3/4 (irreversibility wording); fourth with irreversibility stated **PASS 4/4** at 18:08:51Z. Entry-only; final validation is the coordinator's.

## Tests at 229e4b6 (stamp 0.16.0+229e4b6, release_source 3e31ad2)
- == group 1
- # tests 89
- # pass 89
- # fail 0
- == group 2
- # tests 48
- # pass 48
- # fail 0
- == app-adapter + shell + coordinator (cloud-touched kit)
- # tests 73
- # pass 73
- # fail 0
- == vitest
-  Test Files  2 passed (2)
-       Tests  22 passed (22)
- == typecheck
- tsc exit 0
Composed baseline 89+48+22 = 159 (158 + the new scope parent-link test) plus kit app-adapter/shell/coordinator 73 — all green; tsc exit 0.

## Wrangler local assets at 229e4b6 (evidence/slice2-229e4b6/wrangler-assets.txt)
404: /kit/participant-presentation.test.mjs, /assess/feedback-modal.test.mjs, /assess/scope.test.mjs, /kit/app-adapter.test.mjs, /assess/identity-reset.test.mjs. 200 + sha256: /, /assess/, /participate/, page.js, participant-view.js, kit/views-participant.js, assess.js, scope.js, app-adapter.js, feedback-modal.js, feedback.js, client-release.js, changelog.js, changelog.json. Served bytes == committed bytes at HEAD for all eight runtime modules (MATCH ×8). client-release.js identifies the successor: commit 229e4b62…, version 0.16.0, release_source 3e31ad2f… (provisional).

## Browser proof at 229e4b6 (isolated headless Chromium, empty contexts, repo dataset() route allowlist installed pre-navigation, mutations refused, non-local aborted) — evidence/slice2-229e4b6/browser/compose.json + PNGs; desktop 1440×900 and phone 390×844 each
- Cloud-corrected parent links, non-kit host /assess/#workspace/w1: h1 "Field team", `#page-root a.back[href=#workspaces]` present; click → #workspaces "Your workspaces"; #project/p1 → back → #projects; no #rv mounted.
- Kit host #workspace/w1: no a.back inside content; crumbs [Workspaces, Field team] with role badge Owner; crumb click → #workspaces "Workspaces" (desktop; crumbs collapsed on phone by design); #project/p1 crumbs [Projects, Field team, River Valley], no duplicate back link.
- Cold-role arrival at #workspace/w1 as member and viewer: badge Member / Viewer, #who = that identity, tree roles [Member, Member, Viewer] / [Viewer ×3], one h1; #project/p1 badge follows; action region present for member, absent for viewer.
- Feedback (owner, #project/p1): unsaved input + URL preserved through open/close; dialog outside #rv; Tab ×8 / Shift+Tab contained; payload keys [experience, note, require_authenticated], experience [client_release, context, host, occurred_at, surface], client_release.commit = 229e4b62…, no auth header, no email/principal/id/Bearer leak; refusal → truthful uncertain status; Escape → focus back on #account-menu-toggle. Held completion after route change suppressed, draft cleared, identity intact.
- Root Retry offered on failed languages read; demo: one disclosure, write refused "Not allowed here.", zero data reads/POSTs.
- Participant (evidence/slice2-229e4b6/participant, zoom): journey both viewports (headers 74/70), busy/uncertain/recover, closed, rate-limit, resume, link swap, demo zero requests, keyboard; 390×2 no overflow, Version reachable/openable by pointer and keyboard in all four cases. 0 step errors, 0 page errors anywhere.
51 PNGs + harness sha256 in png-sha256.txt.

## Coverage boundary (explicit)
Browser-proven: the above. Source-only: feedback ok/reject server branches (root test 5), backend provenance validation (vitest). Not exercised: native browser zoom, native IME, real backend actions, live users/logout/data. Slice1 production remains the first and separate release; duplicate-check ruling and all release gates stay with the coordinator.

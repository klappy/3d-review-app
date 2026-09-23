# Slice 2 increment 2 — browser composition, assets, source PR (participant integrator)
2026-09-22 17:57Z (13:57 ET). Active effort since START ≈ 5 min. Head unchanged **78301eb54f0d27199cb3bbb4e6048292880645d8** (tree 39911fa9, parents c339a40f + 98ab8e9f; base fb6b2e05). Status: CANDIDATE READY FOR INDEPENDENT EXACT-HEAD REVIEW / NOT ACCEPTED / NOT RELEASED.

## Source PR
Draft **PR #177** `integration/slice2-participant-feedback-20260922` → `release/k3a-0.16.0-f69-repin-20260922` (the coordinator's selected base; retarget is the coordinator's call). No merge authority claimed; slice1 PR #176 untouched.

## Stamp / identity (after commit)
stamp-version: 0.16.0+78301eb (release_source 3e31ad2f). Generated ui/client-release.js served at /client-release.js: {version 0.16.0, commit 78301eb5…, release_source 3e31ad2f…, build_uuid null} — inherited 0.16 metadata explicitly PROVISIONAL until the separate slice2 release order. Feedback payloads carry this loaded-client identity (see below), not a later health value.

## Wrangler local assets at head (evidence/slice2/wrangler-assets.txt)
Both new tests 404: /kit/participant-presentation.test.mjs, /assess/feedback-modal.test.mjs; inherited exclusions 404 (app-adapter, participant-view, controller, scope tests). 200 with sha256: /, /participate/, page.js, participant-view.js, kit/views-participant.js, assess/assess.js, feedback-modal.js, feedback.js, client-release.js, changelog.js, changelog.json, kit css. Served bytes == committed bytes at HEAD for page.js, participant-view.js, views-participant.js, assess.js, feedback-modal.js, feedback.js (all MATCH).

## Browser composition (isolated headless Chromium, empty contexts, Wrangler dev --local; the repo's own test/fixtures/kit-root-transport dataset('owner') installed as a pre-navigation route allowlist; every mutation refused 405 unless the case says otherwise; non-local aborted) — evidence/slice2/browser/compose.json + PNGs
Desktop 1440×900 and phone 390×844, identical results:
- Root: #project/p1 → h1 "River Valley" (exactly one h1), #who "Account: synthetic-owner@example.invalid"; #project/p2 → "Hill project" with Retry offered on the failed languages read.
- Feedback: unsaved "unsaved draft" typed into #create-assessment; open from the account menu → native dialog outside #rv, URL unchanged, initial focus on the textarea; 8×Tab and Shift+Tab all stay inside the dialog; submit → POST /v2/feedback body keys exactly [experience, note, require_authenticated], experience keys [client_release, context, host, occurred_at, surface], client_release.commit = 78301eb5…, no authorization header, no leak of email / principal / "Bearer" / entity ids; synthetic refusal → truthful "could not confirm … nothing will retry automatically" status; Escape → dialog closed, focus returned to #account-menu-toggle, unsaved input still "unsaved draft", URL and h1 unchanged.
- Stale completion: feedback POST held, Escape, route → #workspaces, then release → dialog stays closed, late receipt never painted, reopened draft empty, account identity intact.
- Demo ?demo=1: exactly one #demo-notice, h1 "Workspaces", create-workspace submit → "Not allowed here.", zero /v2 data reads (health only), zero POSTs.
- Zero page errors in every case.
Participant (evidence/slice2/participant, zoom): full journey intro→question→multi→review→receipt both viewports (headers 74/70); busy/uncertain/recover, closed, rate-limit, resume, link swap (no token in DOM), demo zero requests/storage, keyboard order; 390×2 no overflow, Version reachable by pointer and keyboard on all four viewport/zoom cases. 0 step errors.
Harness sources and 43 PNG sha256 in evidence/slice2/png-sha256.txt.

## Not exercised / honest gaps
Native browser zoom (CSS-zoom emulation only). Native OS input methods. Feedback "ok"/"reject" server responses in the real browser (covered by root test 5 in jsdom; browser ran refuse + held-ok only). No live credentials, writes or DEV/production access.

## Gates
Entry gate (planning→execution PASS 4/4 at 17:49Z) is entry-only. Final-revision validation: I did not run oddkit_validate on this head myself — coordinator's completion validation and independent exact-head review remain; canonical identity, checks, DEV and production gates are separate and slice1-first.

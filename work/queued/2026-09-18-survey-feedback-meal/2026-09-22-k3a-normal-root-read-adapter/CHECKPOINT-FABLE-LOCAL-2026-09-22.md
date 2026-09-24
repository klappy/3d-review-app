# CHECKPOINT — Fable local K3a first integrated normal-root checkpoint
Owner: Fable local Cowork delegate (claim 3dfbd195, gate 446b188b). FIRE: SOURCE-FIRE-FABLE-LOCAL-2026-09-22.md @ kitchen b1d2cd83.

## Clock (observed via oddkit_time; corrected)
- START (observed): 2026-09-22T14:07Z — branch `design-batch/fable-k3a-20260922` created from `9f2e4b44dff62b4c4d4d25eb058e23a144c7f4e1` (HTTP 201, readback equal): app write proven.
- This receipt written at observed 14:27:51Z → **~21 minutes active effort since START**, inside the 90-minute promise.
- CORRECTION: two interim chat checkpoints carried inferred stamps ("14:22Z", "14:41Z/+34m"); they were not clock-observed and are withdrawn. Only START, this receipt, and the claim/gate files carry observed times. Waits for access/provider: none after FIRE.

## Source
- Head: `7dca20bd6dc76f9560f3e3841cac60add197af0c`. Ancestry: 9f2e4b44 → 3e0ce04 (merge K1 45dee530) → 8ae3546 (merge K2 73a995e5) → b918faa6 (feat) → 5ba6e392 (fix) → a7cfce02 → 7dca20bd (refinements from browser observation).
- Accepted K1/K2 bytes incorporated exactly once; kit files byte-equal to K2 tree except tree.js/shell.test.mjs (K1's later composition fixes merged with K2's additions, clean three-way; 133/133 K1+K2 tests green on the merged lineage before any K3a edit).
- Exactly thirteen paths vs 8ae3546: 13 files, +499/−25; `git diff --name-only` outside the thirteen: NONE. `ui/.assetsignore` gains only `kit/app-adapter.test.mjs`.
- Review PR (draft, assigned to klappy, no merge): https://github.com/klappy/3d-review-app/pull/171

## What was built (contract mapping)
- Single kit header: real `#version`, `#account` (who/status/signout/switch) and `#shell-links` nodes moved into `[data-header-host]` (same nodes, same listeners; never cloned). Host and the content element survive search/expansion AND model update (content emptied on update). Private email lives only in the existing `#who` node; shell identity label is "Signed in"/"Not signed in".
- Stable content: `app` is `shell.content`; assessment/survey/permissions/feedback remain the real legacy modules mounted there unchanged.
- Root lifecycle: render() destroys the old view and re-syncs the shell before any load for a route/entity change; page contexts are bound to render generation + identity, so a retained old control can neither request nor write a status line.
- Read model: `scope.js` splits workspaces/workspace/projects/project into `data-read-region` (kit cards from `readModel()`) and `data-action-region` (exact existing forms/selectors/handlers, labelled "kit conversion pending (K3B)"). Loaders, requests, dedupe and authorization decisions untouched. Assessments/languages keep independent settled outcomes; refused/failed never render as empty success.
- Shell model from loaded data only (`state.projects`, `state.workspaces`, `state.lists`, current page model, `state.current`); no discovery reads; direct grant listed under itself with no invented workspace/project links; hrefs from `cards.routes`; names never become ids.

## Tests / commands (run at head)
- `node --test` over ui/*.test.mjs, ui/assess, ui/kit, ui/participate, ui/roadmap, test/*.test.mjs: **426 pass / 0 fail**. `npm run typecheck` (tsc --noEmit): clean.
- New: `ui/kit/app-adapter.test.mjs` (7), `test/kit-root.integration.test.mjs` (7 journeys on the REAL ui/index.html + REAL assess controller + REAL kit modules in jsdom, over `test/fixtures/kit-root-transport.js`: literal GET allowlist installed before bootstrap, mutations 405 fail-closed, non-local requests throw, every request logged), `ui/kit/shell.test.mjs` +2 (host/content identity).
- Integration journeys cover: single header/no legacy header; Workspaces→workspace→project(two assessments, language)→assessment→back with route/title/crumb agreement; search/expansion preserving mount, input value and host; delegated navigation; held read + identity reset (nothing paints, old form disconnected and cannot POST); refused/failed states distinct; direct grant; retained form → exact `POST /v2/workspaces` refused fail-closed with note; version dialog from hosted control; unauthenticated root.

## Browser evidence (Mac Chrome, file://, real module graph)
- Transform: `evidence/k3a-harness/build-harness.mjs` (esbuild 0.28.2, iife es2022, unminified) over the actual `ui/index.html` + `ui/assess/assess.js` + `ui/changelog.js` graph; substitutions limited to root-absolute stylesheet links → inlined bytes, module scripts → bundles, `window.fetch` → synthetic transport installed before bootstrap, empty hash → #workspaces. `manifest.json` maps all 26 modules to sha256 + git blob at head 7dca20bd; output sha256 a32ea2b2d364ba8c…
- Harness location (approved folder only): `/Users/chrisklapp/Documents/3d-review-fable/evidence/k3a-harness/{index.html,frames.html,manifest.json,build-harness.mjs}`. `frames.html?identity=<owner|member|viewer|direct>&view=<desk|phone>&hash=<route>` renders the harness in an exact 1440×900 or 390×844 iframe viewport.
- Observed (computer-use read-only screenshots of Chrome; image files could not be saved by the tool — reproduce with the URLs above):
  - desk #workspaces: one header (brand · crumbs "Workspaces" · Signed in pill · App feedback/Roadmap/Version 0.14.5 · Account: synthetic-owner@example.invalid · Sign out · Use another account); tree Field team(owner)/River Valley(owner)/Hill project(viewer); one workspace card; labelled retained "Create a workspace" form.
  - desk #workspace/w1: crumbs Workspaces › Field team OWNER; tree expanded with current row; project card; retained Manage/Add/Rename region.
  - desk #project/p1: crumbs Projects › River Valley; two assessment cards (September assessment · Collecting · Lake language; Spring baseline · In preparation); languages incl. archived badge; tree shows both assessments under the project.
  - desk #assessment/a1: crumbs Field team › River Valley › September assessment; kit tree current on the assessment; the retained legacy assessment module (with its own context panel — explicit remaining legacy duplication) mounted in content; Collect view.
  - phone #project/p1 and #workspaces (390×844): header stacks, tree above content, cards single-column; crumbs hidden ≤760 per kit css.
- Harness caught one real defect before any browser step: the controller only booted on `#app` (fixed in 5ba6e392, integration test now relies on the boot guard).
- Synthetic request log for the desktop journey: GET /v2/health, /v2/me, /v2/auth/access?view=account, /v2/projects, /v2/projects/p1, /v2/projects/p1/assessments, /v2/projects/p1/languages — all served; zero refused/non-local.

## Variance / remaining (not final kit)
- Real Chromium in the sandbox was unavailable and browser-binary CDNs are outside the domain manifest → file:// harness instead of localhost; no real routing/storage/account behavior differed under file:// (hash routing, sessionStorage, dialogs all functional).
- Assessment page still carries its legacy context panel next to the kit tree (visible duplication) — retained by ticket ("do not restyle or recode"); K3b.
- Header host wraps to a second row at 1440 and stacks on phone; adequate for the checkpoint, candidate for K3b polish.
- `ui/changelog.test.mjs` (outside the 13 paths) required the kit content region to be `div[role=main]` under the page `<main>`; recorded as a narrow K1 interface change.
- Untested here: real auth (synthetic bootstrap only), DEV/production, full P01–P27; none claimed.
- Leftover: an unremovable partial `app/.git` fragment sits in the approved folder from a first clone attempt (mount forbids delete); harmless, Chris may delete.

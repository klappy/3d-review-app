# K3b1 sprint 1 receipt — Fable local (START 15:24:16Z → receipt 15:29Z; sprint window to 15:54Z)
FIRE read: SOURCE-FIRE-FABLE-K3B1-2026-09-22 @ kitchen e97817c3. Base: accepted K3a **c9bf2b1e** (PR #171 frozen, untouched).

## START
- Branch `design-batch/fable-k3b1-20260922` created from c9bf2b1e (HTTP 201; readback ref equal). Isolated worktree in the sandbox clone; approved folder holds evidence only.

## Working increment — head `c2a3dc0c61663f3577c609b6e36b465d27954b6c` (remote readback equal), draft PR #172
- `git merge --no-ff 332b8629`: all three 159 commits (ab8c83de, 5a77efa4, 332b8629) are ancestors. 6 conflicts resolved inside scope: package.json / package-lock.json / releases.json / release-manifest.json → accepted K3a 0.14.5 bytes (0.15.0.md kept as historical cargo; not promoted); test/version-stamp.test.ts → current stamp semantics; ui/assess/assess.js → K3a lifecycle + 159 hooks; opener for the modal = account-menu toggle when the link is inside the disclosure (menu closed first).
- `ui/.assetsignore` +1 line `assess/feedback-modal.test.mjs` (amendment 2c36b533; my custody only).
- Changed paths vs c9bf2b1e: 15, all within the 23.
- Tests: `node --test` **445/445**; ticket node suites 96/96; vitest feedback-provenance/version-stamp/ops-feedback privacy+persist HTTP/MCP **77/77**; `tsc` clean. Six K3b1 integration outcomes on the REAL index/controller/modal over the fail-closed transport: (1) open-in-place with URL/content/unsaved input/host retained + focus return to the toggle; (3) draft kept on same-route reopen, cleared by route change and identity reset; (4) payload = form fields + require_authenticated + allowlisted experience {occurred_at,surface,host,client_release,context{page,component}}, no email/ids/token; (5) uncertain (503) keeps draft + "Send again (may duplicate)", rejection keeps draft, success shows receipt, zero automatic retries; (5b) late completion after route change never paints; (6) signed-out root shows sign-in, no POST.
- Wrangler `--local` at c2a3dc0c: `assess/feedback-modal.test.mjs`, `feedback.test.mjs`, `kit/app-adapter.test.mjs`, `identity-reset.test.mjs` → 404; `client-release.js` (generated identity {version 0.14.5, commit c9bf2b1e… at stamp time}), `feedback-modal.js`, `feedback.js`, `assess.js`, kit modules → 200 byte-equal; `/` byte-equal. File `evidence/k3b1-wrangler-asset-proof-c2a3dc0.txt`.
- Browser (Chrome, file:// bundle of the real 28-module graph; `evidence/k3b1-harness/`, manifest app_head c2a3dc0c, out sha256 4e387205…; `client-release.js` recorded as generated): native `<dialog>` opens outside `#rv`, in viewport (390: 16→374; 1440: 420→1020), focus inside, menu closed, hash/h1/unsaved input retained; after Escape+close focus = `account-menu-toggle`; same-route reopen keeps the draft. Probe hook `frames-probe.html?openfeedback=1`.

## Not yet proven (sprint 2)
- Native Tab/Shift+Tab strict containment oracle (real keys; reviewer probe or my keyboard-event approximation is not sufficient); outside-click dismissal in a real browser; phone/desktop PNGs (reviewer from the stable bundle).
- Note: 159 focuses the first `textarea,button` → currently the Close button (appended before the form root). Not changed in sprint 1; flag for reviewer (a11y preference: textarea first) — would be a feedback-modal.js edit inside scope if ruled.

## Next increment prepared
Sprint 2 (15:54–16:24Z): outside-click + focus-order probe hooks, any feedback-modal.js containment fix if the reviewer's Tab oracle fails, receipts; then R3 candidate = K3b writes/permissions presentations begins on the same branch lineage.

## Blockers
None on my side. Release/DEV/production remain Auggie/coordinator gates; no deploy by me. Second Fable (K4) must not touch assess/scope/feedback/index/.assetsignore — interface requests via Auggie.

## Continuation (no idle gap) — containment + outside-click, observed 15:29–15:36Z
- **Revised head `efb53588edb0efd0b2f2b2edb15901794a287cd2`** (remote readback equal; PR #172 updated). `ui/assess/feedback-modal.js` (in scope): Tab/Shift+Tab wrap inside the dialog's own tabbable controls (keydown scoped to the dialog; no document trap; Escape native); focus that escaped to BODY is pulled back on the next Tab either way; initial focus = textarea (Close button next). Regressions in `feedback-modal.test.mjs`: containment case **fails at the 159 source (5/6) and passes here (6/6)**; outside-click vs inside→outside drag case. Full `node --test` **447/447**, `tsc` clean; changed paths vs c9bf2b1e still 15/23.
- Real Chrome (k3b1 harness, manifest app_head efb53588, out sha256 ea3bfc5c…; probe `openfeedback=1` at 390×844 #project/p1): initial focus TEXTAREA; Tab-from-last → first and Shift+Tab-from-first → last (handler exercised with **synthetic keydown events**); active element stays inside; **actual outside click closes; inside→outside drag keeps open**; Escape/close → focus `account-menu-toggle`; unsaved input/route retained; draft kept on reopen.
- **Honest limit:** real physical Tab keystrokes could not be sent by me — Claude-in-Chrome extension is not connected in this session and my Chrome grant is read-only. The native key-order oracle therefore remains the reviewer's real-key step (as the ticket already assigns); the handler logic and the native-modal inertness are what my evidence covers.

## Evidence correction (observed 15:56:28Z) — stamp after commit
Reviewer found the loaded client identity still reported c2a3dc0c while the manifest said efb53588 (stamp had run before the last commit). Re-ran `npm run stamp` at head efb53588 → `ui/client-release.js` = {version 0.14.5, commit efb53588edb0efd0b2f2b2edb15901794a287cd2, release_source 97af53e8…, build_uuid null}, sha256 9b37de0df0c2331f…. Stable harness rebuilt: manifest app_head efb53588, `ui/client-release.js` sha256 9b37de0d… (generated, gitignored), **output sha256 faa7520de889bbe411adccad645af1fe860543e78a813dd1caf13bd048aa5231**; bundle text contains the efb53588 commit exactly once. Probe bundle rebuilt likewise. No product change. Independent real-browser review of efb53588 (8 combinations, 128 key presses contained, Escape/outside click/draft reopen) acknowledged.

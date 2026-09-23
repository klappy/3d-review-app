# ZOOM AMEND correction — Fable K4 worker
2026-09-22. ACK of INDEPENDENT-6ab60dc-ZOOM-AMEND @ kitchen 76655f59 at 16:12Z; head pushed 16:17Z. Active effort ≈ 5 min. Status: CORRECTED HEAD FOR RE-REVIEW / NOT ACCEPTED / NOT RELEASED.

## Revised head
`design-batch/k4-participant-20260922` → **bb0a7ecdbb77ca94bcf499eaf2676f5261cd6848** (readback equal), draft PR #173. Delta 6ab60dc→bb0a7ec: ui/kit/views-participant.js (+reflowHeader, called from adoptKit) and ui/kit/participant-presentation.test.mjs (+1 test). Still five owned files vs base; no HTML, no page.css, no .assetsignore.

## Correction
`reflowHeader(doc)`: scoped runtime style on the participant page `body > header` — `flex-wrap:wrap; min-width:0; row-gap:6px` — and `min-width:0; overflow-wrap:anywhere` on its three children. The real `#version` node, its attributes (aria-haspopup/expanded/controls) and its changelog listener are untouched; nothing hidden, clipped, or reduced in text size. Idempotent; no-op when no header exists.

## Tests
- ui/participate/controller.test.mjs: # pass 11 # fail 0 
- ui/participant-view.test.mjs: # pass 3 # fail 0 
- ui/participant-dom.test.mjs: # pass 3 # fail 0 
- ui/participant-header.test.mjs: # pass 8 # fail 0 
- ui/participant-resume.test.mjs: # pass 7 # fail 0 
- ui/kit/participant-presentation.test.mjs: # pass 11 # fail 0 
New unit test: header/child styles applied, Version outerHTML unchanged apart from the scoped style, existing click listener still fires, idempotent, no-header no-op.

## Real browser assertions (isolated headless Chromium, empty contexts, Wrangler dev --local; /v2/health answered with a synthetic version so the real Version control enables; everything else non-participant aborted) — evidence/zoom-amend/, zoom.json + PNGs + harness sha256
| case | scrollW/clientW | header h | Version rect | pointer click | Tab from brand | Enter | Esc |
|---|---|---|---|---|---|---|---|
| 390×844, CSS zoom 2 | 390 / 390 (was 510) | 267 | x40–175.6, in viewport | dialog open, aria-expanded=true, focus inside | → #version | dialog open | closed, focus back on #version |
| 390×844 | 390 / 390 | 70 (unchanged) | x302–370 | same | → #version | same | same |
| 1440×900 | 1440 / 1440 | 74 (unchanged) | x1052–1120 | same | → #version | same | same |
| 1440×900, CSS zoom 2 | 1440 / 1440 | 458 (wraps to a column under the page's vw-based padding; no overflow) | x640–775.6 | same | → #version | same | same |
Main card right edge 366 at 390×2 (fits). After each header check, intro → Begin → "Question 1 of 2 · Community" still works; zero page errors. Native browser zoom not exercised (emulated CSS zoom only, as the reviewer noted).

## Exclusion (gate B) — still blocked on the coordinator's choice
Cherry-pick of staff 57fa453c conflicts on its K3b1 parent context (receipt EXCLUSION-INTEGRATION-CONFLICT-FABLE-K4 @ 75c80946, options 1–3). No decision on the dish yet; no shared-file edit made. Wrangler at this head: test file 200, runtime 200. I execute the chosen option on receipt and restamp 404/200 + evidence at that head.

## Gates
Owner planning→execution PASS 4/4 stands for this bounded correction; final Oddkit validation is the coordinator's at the final head. Requesting independent re-review of the 6ab60dc→bb0a7ec delta.

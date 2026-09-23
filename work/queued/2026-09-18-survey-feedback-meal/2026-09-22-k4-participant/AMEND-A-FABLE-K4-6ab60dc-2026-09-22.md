# AMEND A correction — Fable K4 worker
2026-09-22. ACK of INDEPENDENT-aef4ec-AMEND.md @ kitchen 7a1d0bc3 at 15:55Z; correction START 15:56Z; head pushed 15:57:47Z; evidence 16:00Z. Active effort ≈ 5 min. Status: CORRECTED HEAD FOR RE-REVIEW / NOT ACCEPTED / NOT RELEASED.

## Revised head
`design-batch/k4-participant-20260922` → **6ab60dc05755ad2ed603cbb62011df7e0d46d109** (API readback equal), draft PR #173, base c9bf2b1. Diff still exactly the five owned files; this commit touches page.js, views-participant.js, participant-presentation.test.mjs only. No HTML, no page.css, no .assetsignore (locked; gate B unchanged: test file still served 200, runtime 200, inherited 404 — see wrangler-assets.txt).

## What changed (owned page/view seam only)
- `adoptKit(doc, main, {demo})` now owns the outer presentation: `main#participant` becomes the kit stage `.rv.glass.phone` with inline `max-width:640px; margin:24px auto; padding:var(--phone-pad)` (the page.css 760px rule is outranked by the inline style; page.css itself untouched).
- Permanent legacy `main > h1` ("Your perspective matters") and `main > p` help are hidden by page.js (`hidden` attribute; HTML unchanged, nothing removed). Phase-specific headings only: intro = kit eyebrow/h2/help; question = pips + "Question i of n · perspective" + legend; review = kit eyebrow "Review" → existing h2 → kit help; receipt = kit ✓/"Thank you."/note.
- Demo: the previous h1/p rewrite is replaced by the kit `badge.demo` "PRACTICE SURVEY · NOTHING IS SENT" + the same explanatory sentence + the "Back to the tour" link, in a frame at the top of the card. Compact page header (`<header>` with Version control) untouched: 74px desktop / 70px phone.
- Controller, notice tone, fields, validation, review→submit path, namespace/idempotency/draft/resume: unchanged (all suites green).

## Tests
- ui/participate/controller.test.mjs: # pass 11 # fail 0 
- ui/participant-view.test.mjs: # pass 3 # fail 0 
- ui/participant-dom.test.mjs: # pass 3 # fail 0 
- ui/participant-header.test.mjs: # pass 8 # fail 0 
- ui/participant-resume.test.mjs: # pass 7 # fail 0 
- ui/kit/participant-presentation.test.mjs: # pass 10 # fail 0 
Presentation suite now also asserts: stage class/style, legacy h1/p hidden while #notice stays visible, single frame, demo badge, review eyebrow-first / help-after-h2 order.

## Browser evidence at head 6ab60dc (isolated headless Chromium, empty contexts, Wrangler dev --local, only /v2/participate/* answered synthetically, everything else aborted) — worker folder evidence/amend-a-6ab60dc/, sha256 in png-sha256.txt (29 PNGs)
- journey/: intro → q1 → q3(multi, exclusive) → review → receipt at 1440×900 and 390×844. Frozen-reference pairs for comparison: evidence/kit-reference/ (unchanged, cookbook c653482 standalone.html rendered at both viewports).
- states/: busy (all participant controls disabled, values kept) → uncertain warning → Check submission → server receipt; closed; rate-limit; reload restores draft (`q1=2`, radio checked); new #survey token → fresh journey, empty fields, no token text in DOM; demo zero requests / zero sessionStorage; keyboard Enter-on-Begin → legend → Tab → field → Tab → Next → Enter → question 2 legend. 0 step errors (log.json).
- longtext/: long question/option wrap at 390 with scrollWidth = clientWidth (390); emulated CSS zoom 2 at 390 (=195px layout) keeps the card legible, document overflow 557px is from the unowned page header; 1440 zoom 2 no overflow.

## Gates
Owner planning→execution PASS 4/4 (15:24Z) stands for this bounded correction (same decisions/DoD/irreversibility: isolated branch, PR only). Completion validation is the coordinator's at the final head. Asking for independent re-review of the aef4ec→6ab60dc delta.

# CHECKPOINT — Fable K4 worker, sprint 3 (fidelity against the frozen kit) + bounded amendment proposal
2026-09-22 15:46Z (11:46 ET). Active effort since START ≈ 19 min. Status: USABLE HEAD / SEVEN-PATH COOK COMPLETE PENDING REVIEW / HOLDING FOR .assetsignore HANDOFF. Not accepted, not released.

## Head
`design-batch/k4-participant-20260922` head **aef4ec1073f718eb6ad3373b5b01785841cef02d** (readback equal), draft PR #173, base c9bf2b1. Diff: 5 owned files, +495/−52. Suites: controller 11, view 3, dom 3, header 8, resume 7, presentation 10 — all green (evidence/sprint3-suites.txt).

## Reference pairs
Frozen kit c653482 `standalone.html` rendered in the same isolated Chromium at 1440×900 and 390×844 (`#/p/community-river-sep`, `#/participate/form/0`, `/review`, `/receipt`) → evidence/kit-reference/ (sha256 list beside it). App journey re-shot at this head → evidence/sprint3/ (intro, question 1, multi question, review, receipt, both viewports).
Matched from the kit: pips bar; "Question i of n · <perspective>" label (weight 400, no uppercase); chips row; `.choice` option cards with selected fill; note blocks; Back (quiet) / Next (primary) spaced apart under the answers, Review replacing Next on the last question; review rows (muted question, strong answer, Change); receipt ✓ / "Thank you." / note with the server's id·time; glass tokens.
Long text + zoom: long question and long option labels wrap at 390×844 with no horizontal overflow (scrollWidth 390 = clientWidth). At an emulated 200% (CSS zoom 2 at 390 wide = 195 CSS px layout) the kit region still wraps and stays legible; the document overflows to 557px because of the legacy header and h1 (page.css / participant HTML, not owned). At 1440×900 zoom 2: no overflow.

## Deviations from the kit that this slice cannot close within the seven paths → amendment proposal (not applied)
1. Legacy heading block: `main > h1` "Your perspective matters" + `main > p` (ui/participate/index.html) sit above every kit screen and duplicate the intro's title/help. Kit has no such block. Proposed: page HTML amendment removing/relocating them, or explicit permission for page.js to hide them on intro only. Not done — participant HTML is excluded and hiding is a judgement the coordinator owns.
2. Card chrome comes from page.css `main{…}` (glass-ish but not the kit's `.glass.phone` card, and page.css `#notice` outranks `.note.warning` — worked around inline). Proposed: permit `ui/participate/page.css` as a ninth path, or accept the current look as within tolerance.
3. Kit intro extras not backed by the real form model (material strip, role radiogroup, facilitated-interview toggle) are intentionally absent; nothing fabricated.
4. The header (`<header>` with Version control) is the legacy participant header, not the kit `top` bar; out of scope.

## Still open before done-means 1–7 can be claimed
- `ui/.assetsignore` serial handoff → append `kit/participant-presentation.test.mjs` → Wrangler proof (currently: runtime /kit/views-participant.js 200, test file 200, inherited /kit/app-adapter.test.mjs 404).
- Independent review of this head; completion validation at the final head; coordinator decision on amendments 1–2.
Next executable action on my side: the .assetsignore append + 404 proof the moment Auggie hands the line over; otherwise idle on this slice (no further authorized work in the seven paths without an amendment decision).

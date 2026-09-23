# CHECKPOINT — Fable K4 worker, sprint 2 (controller states around the kit)
2026-09-22 15:43Z (11:43 ET). Active effort since START ≈ 16 min. Status: SPRINT 2 INCREMENT LANDED / NOT ACCEPTED / NOT RELEASED.

## Head
Branch `design-batch/k4-participant-20260922` head **fb1a496eee87af70ada804e42afd86b81a4ee5a2** (readback equal), draft PR #173. Diff base c9bf2b1→head still exactly the five owned paths (views-participant.js, participant-presentation.test.mjs, participant-view.js, participant-view.test.mjs, page.js). `ui/.assetsignore` untouched (locked); proposed line unchanged: `kit/participant-presentation.test.mjs`.

## Added this sprint
- `paintNotice`: the existing #notice keeps the controller's wording and phase; kit warning tone (note.warning + inline warning tokens, because the page's own #notice rule outranks the class) for closed / unavailable / cannot-resume / rate-limit / transient / draft-mismatch / submit-failed / submit-uncertain; neutral for opening / restored / thanks. No new state, no new transport.

## Tests (node --test)
- ui/participate/controller.test.mjs: # pass 11 # fail 0 
- ui/participant-view.test.mjs: # pass 3 # fail 0 
- ui/participant-dom.test.mjs: # pass 3 # fail 0 
- ui/participant-header.test.mjs: # pass 8 # fail 0 
- ui/participant-resume.test.mjs: # pass 7 # fail 0 
- ui/kit/participant-presentation.test.mjs: # pass 10 # fail 0 
New scenarios (real index.html + page.js + controller + shared-link in jsdom, fail-closed fetch): busy submit disables every participant control and keeps field values; unknown outcome → review stays, warning notice, one POST only (no automatic retry), restore returns Back to its own pre-busy state and a control disabled for its own reason stays disabled; Edit returns to where paging left off; closed on entry (409 before any session) → unavailable, no form mounted, no submission; 429 → its own wording; same-tab reload with stored namespace restores the draft into the real fields and skips the intro; mismatched draft not restored + warning + storage cleared; demo makes zero requests and zero sessionStorage writes; destroy removes owned nodes, restores review-button/field hidden state, stale Next/Review do nothing.

## Browser proof (isolated headless Chromium, empty context, no credentials; Wrangler dev --local; only /v2/participate/* answered synthetically, everything else aborted)
- Delayed (1.5 s) submit at 390×844 and 1440×900: all participant buttons disabled while busy (screenshot 1-busy); transport failure after server commit → warning notice, controls restored, review intact (2-uncertain); Check submission → server receipt `resp-late-1` shown (3-recovered-receipt). Exactly one responses POST per run with a UUID idempotency key.
- Closed on entry and rate-limited on entry at 390×844: distinct wording, no form.
- Draft → reload without fragment: restored (`q1=2`, radio checked, "unsent answers were restored"); then pasting a different `#survey=` token: page reloads, fresh link POST for the new token, intro shown, `q1` empty, no token text in the DOM.
- Demo `?demo=1`: intro/question rendered, zero /v2 requests, sessionStorage length 0.
- Keyboard at 1440×900: Enter on Begin → focus on the question legend → Tab → the field → type → Tab → Next → Enter → question 2 legend focused, "Question 2 of 3".
Log: evidence/sprint2/shoot2-log.json (0 step errors). PNGs (15) and sha256 in evidence/sprint2-png-sha256.txt; harness evidence/sprint2-shoot2.mjs sha256 d220ba28ecbf787a6adc439877cceea239dad2953c2c4e9bd513d7fd8e5f07ad.

## Remaining before this slice can claim done-means 1–7
1. `.assetsignore` serial handoff → append the one line → Wrangler 404 proof for the new test (runtime module 200 already shown).
2. Fidelity pass against the frozen kit pairs at both viewports (intro/question/review/receipt reference comparison) and long-text / 200% zoom check; the legacy page h1/p above the kit card is page HTML this slice does not own — flag for coordinator, not silently changed.
3. Independent current-head review; completion validation gate at the final head.
Next sprint (≈16:15Z): fidelity pass + any bounded amendment proposal; then hold for the .assetsignore handoff.
Note: uncertain-phone-ERROR.png and uncertain-desktop-ERROR.png are stale artifacts of the first harness run (a script TDZ bug, fixed); the worker folder forbids deletion, so they remain listed in sprint2-png-sha256.txt. They are not evidence for head fb1a496.

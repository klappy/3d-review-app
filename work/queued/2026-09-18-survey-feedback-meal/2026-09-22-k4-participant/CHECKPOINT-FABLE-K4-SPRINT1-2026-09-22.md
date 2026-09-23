# CHECKPOINT — Fable K4 worker, sprint 1 (intro → question → review → receipt via the real controller)
2026-09-22. START 15:26:55Z (11:26:55 ET) on SOURCE FIRE edd25d9a; this checkpoint 15:38Z. Active effort ≈ 11 min. Status: SPRINT 1 INCREMENT LANDED / NOT ACCEPTED / NOT RELEASED.

## Head
- Branch `design-batch/k4-participant-20260922` created from base c9bf2b1e0ad3e9ae1d679cb286959a5b21bab822 (API readback equal) and pushed. Head **928e5292b3b6bfdd89b072175a74000ca05e5348** (readback equal). Draft PR #173 → main, build-only; no merge/deploy by this worker.
- Diff base→head touches exactly five owned paths: ui/kit/views-participant.js (new, 159), ui/kit/participant-presentation.test.mjs (new, 133), ui/participant-view.js (48), ui/participant-view.test.mjs (8), ui/participate/page.js (27). participant-dom/header tests unchanged. Nothing outside the seven active paths.
- `ui/.assetsignore` NOT edited (locked to staff Fable). Proposed exact line: `kit/participant-presentation.test.mjs`. Consequence today: Wrangler local serves /kit/participant-presentation.test.mjs 200 (asset proof incomplete by design); /kit/app-adapter.test.mjs 404 and runtime /kit/views-participant.js 200 (inherited exclusions retained).

## What changed (presentation only)
- Kit builders (intro card with eyebrow from the real form model, pips + "Question i of n", Back/Next under the visible question, chips Choose-all/Optional/Policy-held from item flags, `.choice` option labels with exclusive flag, note for unknown-answer semantics, review rows, receipt from the controller's receipt object only). Review submit button shown on the last question only; native submit + existing page handler remain the sole review path.
- page.js links /kit/tokens.css, components.css, kit.css at runtime and scopes `.rv` on main#participant (participant HTML not owned). draw()/review/receipt paint via the kit; values(), input→save, review→validated answers, edit, submit, recover, hashchange→reload all unchanged.
- mountParticipantView signature (incl. `context`) and return {showForm,showReview,showReceipt,reset,destroy} unchanged; destroy restores review-button/field hidden state and removes owned nodes.

## Tests (node --test, actual output)
- ui/participate/controller.test.mjs: # pass 11 # fail 0 
- ui/participant-view.test.mjs: # pass 3 # fail 0 
- ui/participant-dom.test.mjs: # pass 3 # fail 0 
- ui/participant-header.test.mjs: # pass 8 # fail 0 
- ui/participant-resume.test.mjs: # pass 7 # fail 0 
- ui/kit/participant-presentation.test.mjs: # pass 3 # fail 0 
New test: builder contract (names/types/required/min/max/step identical) + the real ui/participate/index.html + page.js + controller + shared-link in jsdom with fail-closed synthetic fetch: link POST (token in body, credentials omit, fragment stripped) → receipt → form → intro → paged Next/Back with required + exclusive refusals → review (existing "Not answered (unknown)" wording) → Change keeps answers → single POST /v2/participate/responses with idempotency key → genuine receipt; draft namespace `shared:<sha256>:draft` written then cleared; participant token absent from DOM.

## Browser proof (isolated headless Chromium in the worker sandbox — no shared Chrome, empty context, no credentials)
Wrangler `dev --local` on 127.0.0.1:8787; Playwright route: only /v2/participate/* answered synthetically, every other non-local or /v2 request aborted (fail closed); static assets from local Wrangler only. Journey intro→q1→q2→q3(multi, exclusive)→review→submit→receipt at 1440×900 and 390×844. Header 74px desktop / 70px phone. Transport log recorded in evidence/sprint1/shoot-log.txt (one responses POST per run with UUID idempotency key).
PNGs (worker folder evidence/sprint1/, sha256):
    b8b91523a8d7b51a10702170865fdccdd2aa0a9cb6591779a11afe1826d01e32  desktop-1440x900-1-intro.png
    f3461a05f83dcea752d5db0635be4adb639b222fb9a77fd8e74acb2ddf7eff59  desktop-1440x900-2-question-1.png
    9b4dd6253ed8761a29ed39c80a805ed8864bc0aa058372e2a4e97b645f5ef8a6  desktop-1440x900-3-question-3-multi.png
    b73df89ee595e5906cbc7b8ee4aab9819b60cb0102702d075029ceaac6db6858  desktop-1440x900-4-review.png
    0713d00668607fe014740a3a527783c95a1cd3c27ca30828d26591b28a9cd942  desktop-1440x900-5-receipt.png
    a91bdba5a1a5ed784847c0b2c775ae1f469285a5678c0e4b4db16d2f42321844  phone-390x844-1-intro.png
    8b73c2f4716b201a5d621750d67b10400c8b0e49922168448f5633a785a507a0  phone-390x844-2-question-1.png
    0aed1559d24c212db90d8a372e012d710fd9907daf8d02a0505de0e940ccb5a2  phone-390x844-3-question-3-multi.png
    3694f34edc2ee9c32ebbb141b8d573fdb9a8bff6d6bf3b92b2285318bd3150a6  phone-390x844-4-review.png
    8a1272faae753a0938cec4530c3d0c2562c95bb30d64cd51642f62e798d483dd  phone-390x844-5-receipt.png
Harness: evidence/sprint1-shoot.mjs sha256 d60fba3c087896d79e4ffe698118bad34c42687753de863751135fbf0372ded1. No PNGs are tracked in the app repo; no private data (synthetic token/answers only).

## Known gaps / next sprint (sprint 2, ends ≈16:10Z)
1. Busy/error/uncertain/closed/conflict/rate-limit states: kit `.note.warning` presentation for the controller's notices, busy disabled-state preservation proof, destroy/remount stale-callback proof — tests + browser runs.
2. Draft reload/resume/recover and link replacement (hashchange reload) at both viewports.
3. Demo (`?demo=1`) no-write proof.
4. Keyboard/focus pass; long-text and 200% zoom check.
5. .assetsignore line remains a coordinator handoff; Wrangler 404 proof after it lands.
Gates: owner planning→execution PASS 4/4 (15:24Z) stands; completion validation not run yet — this is an increment, not done-means 1–7.

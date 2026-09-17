# Participant recovery correction — review candidate

This candidate reapplies the existing f0b2bc6e28f25f35ab9e5258bd95993b2a684a8b correction to DEV base 518e083aee6395fef144f8705b888d1d76941ff7. Authorization: cookbook issue 14, comment 5706537099. The original worktree and branch remain preserved.

When a code is redeemed successfully but the following form request fails, the browser keeps the participant token and exposes Recover receipt. Only a failed redeem displays the adjacent, focusable invalid-code alert. A confirmed saved receipt clears the old warning that answers entered before reload were not saved; an unsubmitted receipt retains it. PR6 template-version labeling and PR8 participant-token retention during facilitator bootstrap remain unchanged.

Validation on September 16, 2026: node --test ui/*.test.mjs passed 12/12; npm run typecheck passed; git diff --check passed. Initial typecheck could not resolve dependencies in the new worktree; linking existing dependencies resolved that environment issue. No dependency changes are part of this candidate. These are local tests, not independent acceptance or Cursor Bugbot SUCCESS. Actual browser recovery behavior and independent review remain pending.

## Debrief

The original error boundary combined code redemption with form loading, so a later network failure could accuse a valid, consumed code. The correction separates those operations and preserves recovery state. The original receipt rendering left an earlier warning visible after successful submission; the correction removes it only once a saved receipt is confirmed.

The producing-system lesson is to test failures between successful workflow steps, not only endpoints. The learning-loop limitation is explicit: helper tests do not prove the DOM or deployed human experience. Independent browser verification must exercise redeem success followed by form failure, invalid redeem, saved submit, and recovered receipt. Existing source rulings and ownership remain intact.

## Gates and disposition

Review only. No merge, deploy, or promotion is authorized by this document. The historical PR6/7/8 gate violations remain violations. Promotion freeze stays intact until the responsible coordinator establishes the lawful prospective path: exact-head Cursor Bugbot SUCCESS, all applicable checks complete, finding disposition, independent validation, and applicable authority. NEUTRAL is not SUCCESS.

Oddkit preflight returned FOUND. The scoped gate returned NOT_READY and classified the requested planning-to-execution transition as execution-to-captain-escalation, reporting missing delegation despite this work being delegated through Otto. This is a recorded tool limitation, not a passing receipt or a waived gate. Publication has persistence risk because deleting a branch cannot delete copies; the changed files contain code, synthetic test values, and these coordination notes, with no credentials or real participant data.

## Revision after independent source review

The reviewer found that exposing Recover was insufficient: its handler only displayed a receipt and did not reopen an unsubmitted form. Before changing code, the revised driver-seat outcome is: after a consumed code and failed form fetch, Recover loads questions using the saved participant session. If a form is already loaded, Recover must preserve its current answers/review instead of reloading it. A saved receipt retains the existing display path. A newly redeemed participant clears the old participant's form state.

Rejected alternative: always call loadForm for an unsubmitted receipt; this would discard current typed answers. This proposal remains a scoped hypothesis until browser validation; a failed retry, lost typed answer, or second redemption would disconfirm it. Oddkit challenge returned CHALLENGED, block_until_addressed=false. Local source changes are reversible before promotion; published history can persist. New exact-head checks and independent review are required.

Revision verification: UI suite 14/14, TypeScript, and whitespace checks passed locally. The two additional tests exercise retry after successful redemption plus failed form opening, and preservation of loaded answers while recovering both unsubmitted and saved receipts. Independent browser acceptance remains pending.

## Revision for Bugbot findings 4032019468 and 4032019470

Before code changes, the driver-seat sequences are explicit. Participant A may have visible questions, review, receipt and contextual labels; redeeming B successfully must clear all of A's rendered state immediately, before B's form request can fail. B's token remains saved and Recover stays available. A failed restore can leave a session-error alert; successful form or receipt recovery must clear that alert so current success is not contradicted by stale failure text.

This iteration stays local while remote Autofix owns its active branch. It will exercise actual app event handlers and DOM/session mutations in a deterministic DOM harness, then require independent browser replay and fresh Bugbot SUCCESS. Helper-only checks are insufficient. Rejected alternative: hide only the answer form, which leaves old review/receipt/context visible. No auth, contract, scoring or report implementation changes; no push until the coordinator reconciles terminal Autofix and the remote head.

Local revision evidence: `node --test ui/*.test.mjs` passed 17/17. The three new real-app DOM/session regression cases each failed when run against the original `101ec343` app code, and each passed after correction. `npm run typecheck` and `git diff --check` passed. The DOM harness executes actual app bindings through a minimal document/storage/fetch surface; it is not a real browser and does not establish browser acceptance. Dependency reuse is local only. The coordinator must reconcile remote Autofix before any publication, and independent source/browser review remains outstanding.

## Browser correction: failed restore must expose retry

Independent actual-browser review of 777148a found that receipt failure during startup displayed an error but left Recover hidden. Prior 17 passing tests did not prove human reachability: the mock invoked a registered click listener regardless of visibility. Revised driver-seat requirement: a participant with a saved token sees an enabled Recover control before the receipt request; a failed request retains that usable retry and token. Successful recovery clears the alert.

Triple-loop lesson: the mistake was hiding recovery when its first request failed; the producing system allowed a test to activate an invisible control; the learning correction asserts visible/enabled controls before simulated clicks and retains actual-browser fault-path validation. Prior results remain scoped evidence, not erased or upgraded. The coordinator should return this lesson to the cookbook by pointer to this debrief. No remote publication or promotion yet.

Negative control: strengthened actual-app DOM tests against 777148a failed 2/3 cases because Recover was hidden. After moving its visibility before the receipt request, all 17 UI tests pass; typecheck and whitespace check pass. Oddkit challenge returned CHALLENGED, block_until_addressed=false. Actual browser revalidation remains owed on the new head.

## Asset exclusion correction — Bugbot 4032207203

Before this code edit, the bounded amendment is to add `participant-dom.test.mjs` to `ui/.assetsignore`, matching the existing explicit test exclusions. The participant runtime and tests stay unchanged. Root-authorized work is delegated through Otto; independent review and fresh exact-head Bugbot SUCCESS remain required. Remote PR18 head was re-observed at `3543b548d75b408501d268ef83bc1a8d481b9008`, with Autofix completed NEUTRAL; the old branches and worktrees remain preserved.

Driver-seat check: a participant must receive the same runtime assets without the internal test harness being published. A wildcard exclusion was considered but rejected as unnecessary broader policy for this finding. The hypothesis fails if the actual asset-ignore matcher still includes this test or removes a runtime file. Verification will compare manifests using Wrangler's implementation, with the original exclusion list as a negative control, and rerun UI tests/typecheck. No environment or deployment action is part of this correction.

Oddkit preflight returned FOUND and the scoped planning-to-execution gate returned PASS at 2026-09-17T01:59:27.869Z. Earlier verbose gate requests were misclassified as captain escalation; they are not passing receipts. Challenge returned CHALLENGED with no blocking flag; the bounded claim and falsifier above address the applicable concern. The edit is reversible; published Git copies cannot be recalled, and this change contains no secrets or participant data.

Author verification: `node --test ui/*.test.mjs` passed 17/17; `npm run typecheck` and `git diff --check` passed. A read-only harness loaded installed Wrangler 4.133.0's actual `buildAssetManifest` function (no deploy or upload invocation). With the original ignore list it included `/participant-dom.test.mjs`; with the correction it omitted only that path. All seven remaining assets and their hashes were unchanged: `/app.js`, `/index.html`, `/language.js`, `/participant-resume.js`, `/present.js`, `/style.css`, `/visibility.js`. Local evidence: `/tmp/3d-ui-asset-manifest-check.cjs` and `/tmp/3d-ui-asset-manifest-evidence.json`; these are ephemeral reproduction aids, not independently reviewed acceptance.

Triple-loop debrief: the mistake was adding a DOM test under the served asset root without extending its explicit exclusion list; the producing system verifies behavior but does not automatically compare the publish manifest; the learning correction is to include an actual manifest diff whenever tests are added under a static root. This is an on-path lesson for the existing cargo, not a new general policy or a claim that all future test additions are protected. Independent review, fresh Bugbot SUCCESS and any broader browser acceptance remain separate gates.

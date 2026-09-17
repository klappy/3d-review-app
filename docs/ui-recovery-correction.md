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

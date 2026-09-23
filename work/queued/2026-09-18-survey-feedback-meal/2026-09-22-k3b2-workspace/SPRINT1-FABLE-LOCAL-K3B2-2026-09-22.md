# K3b2 sprint 1 checkpoint — Fable local (START 16:12:51Z; checkpoint ~16:24Z, window to 16:43Z)
FIRE read: SOURCE-FIRE-FABLE-K3B2 @ kitchen 1e845ee1. Base **57fa453c** (accepted efb53588 + verified exclusion line).

## START
Branch `design-batch/k3b2-workspace-20260922` created from 57fa453c (HTTP 201; readback equal); isolated worktree; client-release restamped per head.

## Working increment — head `ade6afc50147365f2c57ea25d76aa94ce3582905` (remote readback equal)
- Paths touched: `ui/assess/scope.js`, `test/kit-root.integration.test.mjs` (2 of 4; scope.test.mjs and transport fixture unchanged so far). No assess.js/feedback/participant/kit/style/.assetsignore/metadata edits; cloud PR174 release lineage untouched.
- `write()` currentness guard (shared helper, minimal): completion after route/identity replacement neither re-enables controls of the destroyed view nor notes into the new one; dispatched writes never claimed cancelled, never retried; optional in-form `[data-write-status]` for truthful pending/failed text ("… failed: <server>. Your entry is still here; nothing was retried.").
- Workspaces page: legacy `data-action-region` replaced by a kit `data-write-region` panel carrying the real `#create-workspace` form (native `required`/`maxlength=100`, escaped rendering), pending guard (no double dispatch), refusal/uncertain keep the entry, explicit missing-id outcome, navigation only to the returned `workspace.id` (unmapped id renders the refusal panel — nothing invented).
- Negative tests first: two stale-completion cases (late success, late rejection after route change) **fail at 57fa453c, pass at ade6afc5**. Added: create outcomes (refusal → "Not allowed here", uncertain 503 → entry kept + no resend (POST count), missing id, double-submit while pending → one POST, success → `#workspace/ws-new`), role/region case (create available to every signed-in identity per existing controller; no legacy region).
- `node --test` **451/451**; `tsc` clean. Journey test updated to the kit write region.
- Browser (Chrome, k3b2 bundle manifest app_head ade6afc5, out sha256 d097d2e9…): `#workspaces` at 390×844 and 1440×900 — kit read card + "Create a workspace" glass panel with native input and primary button; header 75/57px unchanged. Screenshots observed; PNG custody Root/Auggie.

## Next (continuing now, no idle)
Sprint 2 on the same branch: workspace page — one kit project card carrying its permitted remove action (no duplicate rows), add-project candidates (loaded/failed/empty distinct), owner rename, two-project distinct POST/DELETE targets with grant disclosure retained, pending guards, reload via pageModel updating card + tree; role cases owner/member/viewer; transport fixture extended (second grouped project) — that will touch the remaining two paths.

## Blockers
None. Independent review/release gates remain Auggie's.

## Review corrections (INDEPENDENT-SPRINT1-REVIEW-ade6afc @ ad3eb58c) — revised head `c6f8be1bae9ecbe25c0087b84409457380b3c4ac` (observed 16:38–16:45Z)
1. `novalidate="false"` removed (boolean attribute had disabled native validation). Disconfirmer: `form.noValidate === false`, no `novalidate` attribute, `required`/`maxLength=100` present; `requestSubmit()` and submit-button click with an empty field dispatch **no** POST; whitespace-only is caught by the trimmed guard ("Enter a workspace name."). This test fails against ade6afc5 by construction (noValidate was true there).
2. Unconfirmed vs definitive: `write()` now reports a server answer (any 4xx, or named INVALID_PARAMS/RATE_LIMITED) as "<action> was not accepted: <server>. Your entries are unchanged." and anything without a definitive answer (transport error, 5xx, timeout) as "<action> could not be confirmed. It may already have completed — check the current list before trying again. Your entries are unchanged; nothing was retried." — no "failed" prefix, no cancellation claim, no retry. Disconfirmers: 503 case asserts /could not be confirmed/ + /check the current list/ + /nothing was retried/ and **doesNotMatch /failed|not accepted/**, entry retained, POST count unchanged, global `#note` carries no contradiction; synthetic 405 refusals (create, remove) assert "was not accepted". The "Your entries are unchanged" clause is added only when an in-form status exists (form actions), not for bare controls such as remove.
3. Accepted create→workspace journey completed: fixture serves `GET /v2/workspaces/ws-new`; after create the real `#workspace/ws-new` route renders "Lake region", the crumb role badge Owner and the tree row from loaded data (real GET observed). Identity-reset currentness: a late create success after `resetIdentity()` neither navigates nor notes; the detached control stays disabled. Test title corrected: create is self-service for every signed-in identity.
- `node --test` **453/453**, `tsc` clean; changed paths still `scope.js` + integration test. Bundle rebuilt: manifest app_head c6f8be1b, out sha256 6220840ec06f830f…; bundle form tag is `<form id="create-workspace">` (no novalidate).
- Sprint 2 (workspace page grouping/remove/rename) continues on this head.

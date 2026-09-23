# K3b2 sprint 2 checkpoint — Fable local (observed oddkit_time 16:45:24Z at receipt; corrections c6f8be1b and head 67b2c13d both landed between the 16:38:57Z and 16:45:24Z observations — the earlier "16:55Z" wording was inferred and is withdrawn)
Branch `design-batch/k3b2-workspace-20260922`, base 57fa453c. Lineage: ade6afc5 (sprint 1) → c6f8be1b (review corrections) → **`67b2c13d4403484871550c71a895c3bff8ddcae9`** (remote readback equal).

## Head 67b2c13d — workspace page in kit presentation
- One kit project card per grouped project owns read/navigation and, for owner/member, its own contextual **Remove** (`[data-remove]`, accessible name "Remove <project> from workspace", in-card status). Legacy action region and names-only rows removed. Grant disclosure retained on the page ("does not add access to other projects") and in the add panel.
- Add project: real `#add-project` form; candidates rendered distinctly — loaded (select of ungrouped active projects) / empty ("already grouped here, or you have no projects yet") / failed ("could not be loaded, so nothing can be added right now" + Retry) / refused / unauthenticated; a failed list is never an empty select.
- Rename (owner only): real `#rename-form`, native required/maxlength, escaped current value.
- All three writes go through the currentness-aware `write()` (in-place status; not-accepted vs unconfirmed wording; pending guard; no retry); success reloads through the real `GET /v2/workspaces/:id` and the shell title/crumb/tree follow via `pageModel` — no local cache or role synthesis.
- Paths changed vs base: `ui/assess/scope.js`, `test/kit-root.integration.test.mjs` (scope.test.mjs and the transport fixture untouched and green). `node --test` **456/456**, `tsc` clean.

## Disconfirmers added (all pass here)
- Two projects → distinct `DELETE /v2/workspaces/w1/projects/p3` then `/p1` (exact order recorded); refusal keeps the card and re-enables only that card's control; escaped names in card and accessible name.
- Success paths: remove → card gone after the REAL reload, removed project becomes an add candidate (from real `/v2/projects`); add → card back; rename → shell h1 and tree row read "Field team <renamed>", input value not double-escaped.
- Stale DELETE completing after route change: no reload, no note, control stays disabled (request may have committed; nothing claimed cancelled).
- Roles: viewer → no write regions/no remove; member → add + remove, no rename; owner → all.
- Sprint-1 set retained (native validation, unconfirmed vs not-accepted, served create→workspace, identity-reset currentness, double-submit).

## Browser (Chrome, bundle manifest app_head 67b2c13d, out sha256 f115febf…)
`#workspace/w1` owner at 390×844: crumbs Workspaces › Field team OWNER, collapsed context toggle, role/Permissions row, one project card with "Remove from workspace", disclosure text, "Add a project" glass panel with select + primary button. Header 75px unchanged. Desktop pending screenshot; PNG custody Root/Auggie.

## Remaining for full P04 acceptance (not claimed)
Outcome 6 keyboard/pointer focus in a real browser for the new controls; desktop screenshot pair; 401/501 candidate cases in browser; independent current-head review; release gates. Rename validation for >100 chars relies on native maxlength (asserted present).

## Next
Awaiting independent sprint-2 review; meanwhile: desktop capture + focus probe hooks for the workspace forms (evidence-only tooling), then the next bounded order.

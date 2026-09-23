# COMPACT CHROME — Fable local K3a amendment receipt
ACK/START observed 14:45:55Z (COMPACT-CHROME-DISPOSITION @ kitchen 9631c491; duplicate-card ruling applied). Gate checks observed 14:53:29Z / 14:53:42Z. Owner: Fable local Cowork delegate. Same thirteen paths, same branch, draft PR #171. **Stable revised bundle declared for reviewer PNGs: head `2e7e030f97afd4977ae7be61d17f4883e7d1ba8b`, `evidence/k3a-harness/manifest.json` app_head 2e7e030f, output sha256 61b58c69dc65a739….**

## Changed head
- `8221f260` feat: one utility bar; `#account` is the only hosted control — a 44px toggle whose visible label is the real `#who` node (verified email) and a disclosure `#account-menu` holding the existing `#account-signout`, `#account-switch`, `#version`, `#shell-links` (App feedback, Roadmap); `#account-status` beside the toggle. Same nodes/listeners; `bindAccountMenu()` (app-adapter) adds open/close, ArrowDown/Up/Home/End, Escape → focus returns to toggle, outside click/focusout close. No identity pill: Owner/Member/Viewer is the crumb badge only; unknown role → nothing. `tree.js`: `model.contextCollapsible` renders a context toggle showing the current scope; panel `hidden` until expanded; Escape closes + focus return; collapses again on route change. `assess.js`: under the kit the assessment/survey pages render no legacy context panel and no duplicate eyebrow/h1 (stage badge, role line, view tabs, every action/state/error remain; `workspace-layout` grid dropped). `scope.js`: workspace management = names-only rows carrying the existing `[data-remove]` control, accessible name "Remove <project> from workspace"; one kit card owns read/navigation.
- `2e7e030f` refine: measured metrics — `main#rv` drops legacy main padding/max-width; phone crumbs one scrollable row (no clipping; horizontal scroll), toggle 44px, email 12px (no reduced-font trick: body text sizes unchanged).
- Diff vs 8ae3546 still exactly thirteen paths. Tests +3 (menu keyboard/focus/identity across routes+reset; phone collapsed context incl. Escape/focus/route collapse; owner Remove rows with exact `DELETE /v2/workspaces/w1/projects/p1` refused fail-closed). `node --test` **434/434**; `tsc` clean; wrangler `--local` asset proof at 2e7e030f: 5 test modules 404, 9 runtime modules 200 byte-equal, `/` byte-equal (`evidence/k3a-wrangler-asset-proof-2e7e030.txt`).

## Measurements (real Chrome, harness `measure=1` writes getBoundingClientRect data; file `frames.html` displays them)
| viewport | route/identity | header h | header % | context toggle | h1 top | stage badge top | view tabs | headings |
|---|---|---|---|---|---|---|---|---|
| 1440×900 | #assessment/a1 owner | **57px** | 6% | n/a (tree panel open) | 123 | 172 | 214–270 | 1 |
| 390×844 | #assessment/a1 owner | **75px** | 9% | 44px, collapsed, shows "September assessment" | 192 | 262 | **304–395** (in first viewport) | 1 |
| 390×844 | #project/p1 viewer | **75px** | 9% | 44px, collapsed, shows "River Valley" | 192 | 245 | first card 361 | 1 |
Targets ≤80 / ≤96 met; before: 246px @856 (26%), independent 256px+240px @390. Email visible in full at both sizes ("Account: synthetic-owner@example.invalid", wraps to two lines on phone inside the 44px control, no ellipsis). Menu hidden until opened.

## Fresh applicable Oddkit checks at 2e7e030f (exact)
- `oddkit_challenge` mode=execution, input = working-belief statement of the measurements/targets/evidence/disconfirmers/not-claimed (recorded verbatim in this receipt's commit message body is not possible; input text: "Working belief at revision 2e7e030f… header 57px at 1440x900 and 75px at 390x844 … tabs at y=304–395 … Disconfirmers: any route/identity where the header exceeds the targets, any duplicate heading or hidden unique control, any stale completion painting. Not claimed: real auth, DEV/production, frozen-reference fidelity, 200% zoom and long-email behaviour beyond the synthetic fixtures."). Result: **CHALLENGED, block_until_addressed=true**, governance knowledge_base; missing prerequisites reported: confidence level, comparison target, disconfirmer (the input names all three; the matcher did not detect them). Answered here explicitly: confidence = working belief (measured on 3 route/identity/viewport cases, not all); comparison target = my own prior head 7dca20bd/ab501ef0 measured at 246px (856 wide) and the independent 256px phone measurement; retraction = any measured route/identity/viewport in the fixture set exceeding 80/96px, or 200% zoom/long-email breaking legibility or tap targets.
- `oddkit_validate`: **NEEDS_ARTIFACTS** — provided artifact recognised: the wrangler proof file; gaps: visual proof files (owned by the independent reviewer per disposition; pending) and session capture (DOLCHEO, supplied below). Not claimed satisfied.
- Prior `oddkit_gate` planning→execution PASS (f52fce62) not carried as completion.

## DOLCHEO
- Decisions: email node is the identity control (no separate pill); secondary controls disclosed; phone context collapsed by default; assessment duplicate chrome removed only where the kit provides the equivalent; names-only Remove rows.
- Observations: 246px header @856 (26%); crumbs wrapped to two rows on phone until made one scrollable row; legacy `main` padding/max-width was leaking onto `#rv` (22–28px + 1120px cap).
- Learnings: my screenshot tool cannot emit files; a `measure=1` harness hook gives exact CSS-pixel evidence; the boot guard defect earlier shows the file:// harness catches real integration bugs.
- Constraints: 13 paths; no kit.css/components.css edits (all overrides live in index.html); no reduced-font trick; targets ≤80/≤96.
- Handoffs: reviewer produces exact-head PNGs from the declared bundle; final visual/regression review; K3b1 queued after K3a acceptance.
- Encodes: none to canon.
- Opens: 200% zoom and very long email not measured; roadmap/feedback links now inside the menu (one extra activation); workspace search on phone requires expanding the context.

## Not claimed
Real auth, DEV/production, frozen-reference fidelity, full K3b–K6, release. K3a slice still awaits independent visual/regression acceptance.

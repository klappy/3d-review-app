# 200% zoom + very-long-email findings — Fable local, K3a at 2e7e030f (stable bundle untouched)
Observed 14:57–15:02Z. Probe = same transform as the stable bundle plus one `?email=` override of the synthetic account email (`build-probe.mjs`, `index-probe.html`, `manifest-probe.json`, `frames-probe.html` in `evidence/k3a-harness/`; `index.html` sha256 61b58c69… unchanged). 200% browser zoom emulated as a halved layout viewport (media queries respond) rendered at 2×. Email under test: `very.long.synthetic.address.for.k3a.checks@subdomain.example.invalid` (66 chars), real controller path (`loadAccountEmail` → `#who`).

| case | layout viewport | header h | header % | `#who` lines | toggle h | h1 top | tabs | horizontal overflow | headings |
|---|---|---|---|---|---|---|---|---|---|
| phone 100%, long email | 390×844 | **101px** | 12% | 5 | 70 | 217 | 329–420 (first viewport) | none (docScrollW 390) | 1 |
| desk 200%, long email | 720×450 | **86px** | 19% | 4 | 55 | 202 | 315–370 (first viewport) | none | 1 |
| phone 200%, long email | 195×422 | **186px** | 44% | 9 | 127 | 317 | 484–575 (**below first viewport**) | none (docScrollW 195; only the caret span reports scrollWidth 149>117, benign) | 1 |
| reference (standard fixture) | 390×844 / 1440×900 | 75 / 57 | 9 / 6 | 2 / 1 | 44 / 44 | 192 / 123 | in first viewport | none | 1 |

Findings
1. Legibility/tap targets/no clipping hold in all three probes: the full email is visible (wraps, never truncated), the toggle stays ≥44px, no horizontal scroll, one heading, context collapsed, menu reachable.
2. Density targets are exceeded only under the combined worst case: long email at phone 100% (101px vs ≤96) and phone 200% (186px, tabs pushed to y=484 of 422). Desk 200% stays under 96 (86px) though above the 80px desktop target if that target is read at 200%.
3. Predicted, not measured (cross-origin iframe blocks scripting; my Chrome grant is read-only): at a 195px layout viewport the open `#account-menu` (`min-width:240px; right:0`) would extend ~45px past the left edge — a real overflow risk when the menu is OPEN at phone 200%. Needs a measured check or a `max-width:calc(100vw - 16px)` guard.
4. Focus behaviour was not re-probed at 200% (same DOM/handlers as the 100% tests, which pass: Escape/focus return, outside click).

Options for Auggie (no source change made; stable bundle intact)
- (a) Accept as-is: worst case is legible and usable; density target applies to standard fixtures per disposition.
- (b) Bounded CSS-only amendment in `ui/index.html` (in the 13 paths): `#account-menu{max-width:calc(100vw - 16px)}`; and under `(max-width:420px)` let `#who` break at `@` (insert no text; use `overflow-wrap:anywhere` already set + `#account-menu-toggle{max-width:70vw}`) to cut lines from 5→3 at phone 100%. Expected phone 100% long-email header ≈ 88px. Would require a new stable bundle for the reviewer.
- (c) (bigger, K3b) local-part/domain two-line layout for the email control.

## Oddkit challenge disposition at 2e7e030f (prescribed workflow, unified `oddkit` with state)
- 14:57:40Z CHALLENGED — 4 missing prerequisites (matcher vocabulary: "belief" ≠ "believe"; disconfirmer/validation/comparison vocab absent).
- 14:58:18Z CHALLENGED — 4 missing (comparison target proper noun; proposal-type: alternatives, risks, reversibility) after supplying confidence/disconfirmer/validation in governed vocabulary (read from `odd/challenge/base-prerequisites`, `odd/challenge-types/{observation,comparative-positioning,strong-claim,assumption}`).
- **14:58:44Z — `missing_prerequisites: []`, `tensions: []`, state `unresolved: []`, phase execution.** Status string remains "CHALLENGED" (the tool always returns its question bank), but every prerequisite the governance defines is now met with concrete content: three named measured cases; comparison to Fable 7dca20bd (246px) and orphan_audit (256px) as of 2026-09-22 with shared ground; alternatives rejected (stacked bar, ellipsis, icon-only); risks (one extra activation, 2-line email, font metrics); reversible on branch/draft PR; disconfirmer + retraction; validation via reviewer PNGs and these probes. Three submissions total, each adding governed content, none a rephrase.
- `oddkit_validate` remains NEEDS_ARTIFACTS (reviewer PNGs pending). Checklist item kept open until the reviewer's actual result.

## Amendment — measured open-menu overflow and clamp (observed 15:03–15:07Z)
- Auggie ruling: 80/96 bounds apply to standard fixtures; wrapped long email at 195px is not a failure if readable/reachable/unclipped; measure the OPEN menu; clamp pre-authorized within the 13 paths.
- Measured (probe `openmenu=1`, 195×422 layout, long email) at 2e7e030f: open `#account-menu` rect left **−57** → right 183 (240px), all 5 items `inView:false` (left −48); keyboard OK (ArrowDown opens + focuses Sign out; Escape closes, focus returns). **Real overflow confirmed.**
- Fix `185ede97` (`ui/index.html` only): `.account-menu` min-width `min(240px, calc(100vw - 16px))`, max-width `calc(100vw - 16px)`, wrapping items; ≤420px anchors the menu to the viewport edges. Re-measured: 195px → rect 8→187, all items in view, keyboard unchanged; 390px standard → rect 8→382, header still 75px. 435/435, tsc clean, wrangler proof at 185ede97; stable bundle rebuilt (manifest app_head 185ede97, output sha256 6ddebe5e…); PR #171 comment posted for the reviewer (delta since the 4 PNGs at 2e7e030f is this CSS rule set only).

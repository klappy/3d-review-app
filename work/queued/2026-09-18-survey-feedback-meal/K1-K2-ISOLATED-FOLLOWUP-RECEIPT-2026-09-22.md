# K1/K2 isolated follow-up implementation receipt

SOURCE FIRE81cc01e9 executed. Original PR164/165 and cloud branches untouched; no stopped-worker assumption, merge or deployment.

| Candidate | Exact head | Tree | Follow-up parent | Paths |
|---|---|---|---|---|
| PR168 | 4a7715e19ae5c7c87351e815f7c4bc92d9e9d62c | 58861b8f9acbc7e58296d40b0bb6134641199f19 | cd3fd21fc581238147620fbf29bc5e559274c76c | ui/kit/tree.js; ui/kit/shell.test.mjs |
| PR169 | 73a995e5903912d795bfb159d1e7e2587daa4917 | 92b490bf5f1072253370dcb857d0c04d9ded4520 | b4ca41f7bf8c07735892e1865c403b063dcca53b | ui/kit/views-coordinator.js; ui/kit/coordinator.test.mjs |

Both target frozen staging1b0ae83; prior implementation ancestry is preserved. Separate candidates require independent review and exact-head service gates before coordinator integration disposition.

K1: local filtering updates only the owned tree list, retaining search node/selection and mounted content. Composition committed by leaving search defers filtering until return to search, preserving the actual pressed row and moved focus. Pointer/keyboard blur, final input, identity replacement and destroy are covered. Fifteen shell tests pass. The existing isComposing-only synthetic case now explicitly focuses its field, matching browser use.

K2: aria-current requires an explicit browse-view action and a supplied matching string view. Save, matching-value non-navigation item actions, denied controls and stale bindings are covered; forty-four presentation tests pass. No action permission, controller slot or privacy contract changes.

Before publishing, compared actual cloud cc0a38bc and7e712e11 in isolated archives. Additional regressions against cloud candidates: K1 fourteen pass/one fail (pointerdown before compositionend); K2 forty-three pass/one fail (non-navigation matching-view item action). Those cloud deltas are preserved and not double-applied. Logs /tmp/3d-cloud-followup-challenge/{k1,k2}-results.txt.

Actual Chrome desktop1440×900 and phone390×844: real pointer clicks with synthetic composition commit preserve intended navigation, target focus, search and selected content; returning to search applies committed filter. K2 current-page assertions pass on both viewports. No external requests. Browser harness/results/screenshots: /tmp/3d-followup-browser/{check.cjs,results.json,desktop.png,phone.png}. Native OS IME remains untested. No new full-app visual or live controller acceptance claim.

Local author worktrees /tmp/3d-k1-focus-isolated-20260922 and /tmp/3d-k2-current-isolated-20260922. Required next: independent exact-head review, real check completion, fresh cloud comparison and isolated composition disposition. Frozen-kit/root activation and whole-batch gates remain unchanged.

## K1 independent caret amendment
Independent review found deferred composition text was lost when the pressed expansion caret repainted the shell. Corrected PR168 head ef661bca39e88f61d83a381f671ba7a90c7cd648, tree2be9e77fd0ca9b88cb04c9caed9682e1b54f69b7, parent4a7715e. Same two paths only: commit query to local state before deferring DOM filtering; add actual pointerdown→compositionend→focus/final-input→caret-click regression. Sixteen shell tests pass. Updated actual Chrome desktop/phone harness verifies retained September query and selected content after real caret click, plus prior outside navigation/focus and K2 cases. Evidence paths unchanged; native OS IME still untested. Independent re-review required; prior4a7715e is superseded for acceptance.

## K1 caret focus completion — supersedes ef661bca
Independent re-review found the prior caret test omitted actual focus: applying the deferred query during expansion removed the focused caret. Current PR168 head4c84d123e107a3ec99ebaa322a88dc7c16d45328, treebc26b6fcc8578d93332d52a7133f7641924bcbf4. Separate committed query text from applied tree filter; local expansion keeps the previous tree filter and returns focus to the completed caret. Returning to search applies the committed filter. Model update resets both; no external API/model change. Same two-file scope.

Sixteen shell tests pass with actual activeElement, aria-expanded=false, retained committed query/content and delayed-filter assertions. Actual Chrome desktop/phone real caret click now asserts focusedCaret=a1 and expanded=false, then search return applies filter; prior navigation/focus proof also passes. Evidence /tmp/3d-followup-browser/results.json and check.cjs updated. This closes the missed oracle in the author tests; independent re-review remains required. Whole-composition preparation held pending that closure.

## Coherent keyboard/pointer journey at unchanged4c84d123
Actual Chrome at both viewports passed one continuous sequence: composed September → real caret click/completed focus → Tab to row → Shift+Tab to caret → search return applies filter/removes caret while retaining search focus → Tab to filtered link → click synthetic content action → Shift+Tab to connected in-shell control → search return retains latest text → clear restores tree → Tab to caret. /tmp/3d-followup-browser/check.cjs and results.json record coherentKeyboardJourney:true. No source change or native OS IME claim. This broadens the author oracle beyond isolated caret assertions; independent review remains separate.

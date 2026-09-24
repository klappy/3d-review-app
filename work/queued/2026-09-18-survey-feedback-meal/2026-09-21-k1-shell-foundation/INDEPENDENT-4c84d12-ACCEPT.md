# Independent K1 4c84d12 review — ACCEPT

Exact PR168 head4c84d123e107a3ec99ebaa322a88dc7c16d45328, treebc26b6fcc8578d93332d52a7133f7641924bcbf4. Reviewer orphan_audit; no candidate source edits. Closes the query/focus AMENDs at4a7715e andef661bc.

Read two-file delta againstef661bc. Committed query and currently applied filter are separated; deferred expansion paints the existing list and restores its caret focus, while returning to search applies the latest committed filter. Model update resets both; existing revision/connection guards and cleanup remain. No authority, payload, role or callback changes.

Independent exact Git worktree /tmp/3d-k1-review-4c84d12:16/16 shell tests pass, including selection/content, prior role/privacy, identity replacement and destroy. Same current tests against isolatedef661bc source yield15pass/1fail—the strengthened caret regression—showing meaningful detection.

Independent actual Chrome153.0.8010.53, desktop1440×900 and phone390×844, empty contexts/local immutable modules only:
- Real pointer navigation during synthetic composition commits preserves intended callback and focus, search and selected content.
- Same caret disconfirmer now retains 'September', activeElement BUTTON data-expand=a1, aria-expanded=false; prior BODY regression is absent.
- Connected journey returns to search and applies deferred filter, composes latest 'River', presses real Tab, commits while focus is outside, preserves that outside focus/query/content, returns to search and observes River Valley with September removed, clicks away to menu and returns with query intact. Both viewports pass.
- Current caret repaint may replace the search node while it is not focused; query, focused caret and mounted content are preserved. No claim of unconditional DOM-node identity across every local expansion.
- Existing stale identity/destroy cases pass; native OS IME remains untested. No full-app/root integration or blanket visual parity claim.

Evidence /tmp/3d-followup-independent/4c/{check.cjs,caret.cjs,journey.cjs,results.json,caret-results.json,journey-results.json}; comparator /tmp/3d-k1-review-ef-comparator/results.txt.

Ordinary READY transition is authorized after unchanged-head verification; exact service gates and fresh cloud comparison precede separate integration disposition. Original cloud branches remain untouched. K3 fixture dependency may refresh to this accepted exact head; its own gates/FIRE are separate. PR167 remains unmerged pending its unrelated named provider-check ruling.

Additional independent coherent-journey check on unchanged4c84d12: real Tab from preserved caret and Shift+Tab returns to that caret; after latest-query/click-away/search-return sequence, clearing search restores the tree and real Tab reaches a connected caret. Both desktop and phone pass (reverseTabAndClear:true in independent journey-results.json). Original168 head re-read unchanged, then normal READY transition completed; no merge or check bypass.

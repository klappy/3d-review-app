# Independent isolated K1/K2 follow-up review — 2026-09-22

Reviewer orphan_audit; no candidate source edits. Isolated exact-head Git worktrees /tmp/3d-k1-review-4a7715e and /tmp/3d-k2-review-73a995e.

## K2 ACCEPT exact73a995e5903912d795bfb159d1e7e2587daa4917

Tree92b490bf5f1072253370dcb857d0c04d9ded4520. Compared against b4ca41f7: exactly views-coordinator.js and coordinator.test.mjs. Current-page attribute now requires explicit browse-view action, supplied string view and exact active-view equality. No action authority, private bindings, per-item context, values, duplicate guard or authoritative-slot behavior changes.

Independently ran44 presentation tests:44pass. Same current tests with parentb4 coordinator source:42pass/2fail, exactly new current-page cases. Same tests with cloud7e712e11 coordinator source:43pass/1fail for matching-view non-navigation item action. This candidate closes a meaningful gap beyond the cloud alternative. Prior privacy/slot/stale-row tests pass.

Independent Chrome153.0.8010.53 desktop1440×900 and phone390×844 actual rendered mounts: Save and Remove have no aria-current, exactly one matching Browse control does; no external requests. Source mounts isolated exact bytes. /tmp/3d-followup-independent/results.json. No broad visual parity or K3/live controller acceptance implied.

## K1 AMEND exact4a7715e19ae5c7c87351e815f7c4bc92d9e9d62c

Tree58861b8f9acbc7e58296d40b0bb6134641199f19; exactly tree.js/shell.test.mjs versuscd3. Fifteen shell tests pass, including identity/destroy, selection, content, role and callback safety. Independent Chrome reproduces author navigation-row case at both viewports: target callback/focus and search/content retained; deferred filtering applies on return. Native OS IME untested.

Concrete remaining defect: commit composition by clicking a tree expansion caret. Search has 'September'; document pointerdown defers filtering, compositionend therefore never updates stored query, and expansion click invokes paint(id) using old empty query. Actual resulting search value is empty and node replaced. Independently reproduced in JSDOM and real Chrome pointer clicks with synthetic composition events on desktop/phone; focus correctly reaches a1 but committed search is lost. /tmp/3d-followup-independent/caret-results.json records both.

Required bounded correction: retain committed input/query and intended expansion/focus through this same local shell action, with regression for pointerdown→compositionend→caret click (and final input ordering). Do not restore broad repaint while composing, steal outside focus, revive stale identity, remove callback safety or silently redefine the retained-search requirement. Author owns correction; reviewer made no source fix.

K1 remains draft/AMEND. K2 can enter ordinary ready review/checks under coordinator authorization; exact service gates, fresh cloud comparison and separate integration disposition remain. Neither verdict merges, activates root or accepts whole design batch. Original cloud branches remain preserved.

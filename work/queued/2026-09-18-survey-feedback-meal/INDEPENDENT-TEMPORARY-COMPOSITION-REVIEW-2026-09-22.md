# Independent temporary K1/K2 composition review — AMEND

Exact external overlay: K2 73a995e5903912d795bfb159d1e7e2587daa4917 plus K1 4c84d123e107a3ec99ebaa322a88dc7c16d45328 tree.js/shell.test.mjs. Author packet5082990fe2bf2c74dd606e926691a6c231efb83f. No integrated Git tree or root activation exists.

Independently checked source-manifest.json against actual Git bytes:349 complete tracked paths, zero mismatches, only the declared two K1 substitutions. Reran60 tests (16shell+44presentation):60pass. Copied browser/journey runners to /tmp/3d-composition-independent, preserving author artifacts; both reruns pass desktop/phone. Confirmed two-item distinctions, current-page state, foreign feedback-slot exclusion, no foreign button disable/dispatch, owned-field retention through search filtering, view.update stale-control invalidation, coherent composition/keyboard/caret journey and zero page errors/nonlocal requests in the observed fixture. Re-read actual local Wrangler8982:two tests404, six runtime/CSS files200 byte-equal.

## Blocking assembled interaction finding

Independent actual Chrome desktop1440×900 and phone390×844:
1. draw Project; mount K2 on shell.content.
2. Click first Open:one expected callback.
3. Expand/collapse K1 tree caret a1.
4. Click the same visible first Open:zero callbacks.

Observed shell.content !== prior content container and prior container.isConnected=false. K1 paint preserves child nodes but replaces their parent data-content container. K2 delegated listeners remain on the disconnected old container; visible child controls no longer dispatch, and later view.update would target that old root. Standalone shell retained-child tests and composition search-only probes do not cover this boundary.

Reproducer /tmp/3d-composition-independent/expansion.cjs; results expansion-results.json. Both viewports show before1/after0, sameContainer:false, oldConnected:false. This is a concrete interoperability defect, not a backend effect or hypothetical risk.

Required bounded K1 correction: preserve the mounted content ROOT element and its controller listeners across local shell paints, including caret expansion, while retaining prior query/focus behavior. On model/identity update and destroy, preserve intended invalidation and explicit caller lifecycle; do not reuse stale identity contents. Add meaningful composed-root delegated-action and view.update-after-expansion regressions, plus repeated expansion/search and mounted foreign-slot privacy. Return exact new source and rebuilt overlay for independent review. No reviewer source edits.

## Visual review boundaries

Actually inspected composed Project desktop and People-preview phone against frozen reference renders. Project composition lacks reference tabs/rollup, detailed assessment columns, prominent Start assessment and complete route/ancestor coherence; inherited assessment crumb remains while Project title is shown. People preview is a reduced generic form/table, not reference full invitation/roster/pending-invitation/privacy/ownership structure. Stronger background and different density are visible. These openly declared fixture/adapter omissions are not passed visual parity and remain final integration/design obligations. Current sparse fixture screenshots cannot retire those obligations.

Narrow K1/K2 source correction acceptances remain historical exact-head evidence, but assembled readiness is AMEND until container ownership is fixed. No blanket kit/full27-row/controller/legacy/native-IME/provider coverage claim. K3 ticket9d311c4 refresh correctly names existing exact heads and preserves external-only scope, but this newly observed dependency defect must be dispositioned/corrected before treating that composite as accepted. Its plan shape119dfd8e remains valid; no FIRE or merge authorized here.

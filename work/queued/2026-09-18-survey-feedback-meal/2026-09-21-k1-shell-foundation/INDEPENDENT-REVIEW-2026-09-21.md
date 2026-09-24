# Independent K1 implementation review — 2026-09-21

Verdict: AMEND exact app head247161741f1bb16670b8630d4df3fa03764db99b before integration acceptance. Two bounded corrections below; no own source fixes or merge. This is isolated K1 review, not whole-batch acceptance.

## Exact source and independently observed evidence

PR162 draft targets design-batch/2026-09-21-integration at76fe13823dda23c9c046d2b44cdce94fc0842602. Candidate tree2b97069610a8d8690071890a0df4a0b1973d0bb9; eight added files only. Local author checkout HEAD remains base with eight staged additions, but exact candidate object exists and git diff2471617 -- ui/kit test/fixtures/kit-shell-data.js test/fixtures/kit-shell.html is empty. Thus reviewed worktree bytes match candidate; do not mislabel its checkout HEAD.

Independently ran node --test ui/kit/shell.test.mjs:8/8 pass. Inspected core.js/tree.js/fixtures/styles: views accept supplied visibility/allowed models, no backend auth or transport/storage authority; labels escaped, destinations limited to hash strings, callbacks carry current model context, updates remove stale bindings. Real authorization/currentness remains K3's duty. Mounted content survives local tree repaint; update intentionally clears it.

Independent headless Chrome, new isolated contexts with nonlocal/nonGET requests denied: owner/viewer/direct at390×844, three scenarios all observed no overflow; real mounted input identity/value survived tree expansion; model replacement cleared old content; owner/direct Escape returned opener focus, viewer had zero action buttons. No real cookies or submissions. This is three independent local fixture cases, not reproduction of author's full8 cases or normal-shell app acceptance. A supplementary visible-selector probe waited on deliberately hidden menu and was stopped; components.css hidden!important rule and prior interaction checks establish it is not a visible-menu defect.

Visually inspected author-retained owner desktop and direct phone candidate/reference PNG pairs. Candidate shows kit-derived geometry/type/tree/menu, with stronger aurora/background than reference and less page content because this is shell-only. Reference is full Collect page, so it is not an exact same-content screenshot comparator. No full visual equivalence accepted; integration must validate composed target. Author's50-regression/8-role-viewport evidence remains author evidence, not rerun counts here.

## Required bounded corrections

1. Public test exclusion: wrangler.toml assets.directory is ./ui; ui/.assetsignore lists individual test paths and has no kit/shell.test.mjs or general test wildcard. The candidate adds ui/kit/shell.test.mjs inside public assets. Existing deploy preparation handles schema, not asset filtering. Add explicit exclusion or relocate under an approved test path, then prove the final asset manifest omits it while retaining kit runtime files. ui/.assetsignore is outside current K1 write set: coordinator must give narrow ownership/scope amendment before author edits; do not silently broaden custody. No live deployment probe was performed or needed to identify this source packaging gap.

2. Role-matched fixture inconsistency: test/fixtures/kit-shell-data.js sets assessment node role Member for every non-viewer, while owner model's current breadcrumb/header role is Owner and permits owner Rename. Observed owner screenshot therefore shows current assessment Member in tree but Owner in header. Fix the synthetic current-scope role consistently (or explicitly model a true mixed-scope scenario with correct current role/actions); add an assertion that the current node and current-scope header agree. This is fixture evidence correction within existing K1 scope, not a change to actual grant semantics.

## Preserved gates and narrow return

Retain exact8-file cargo and current accepted base; any asset-exclusion addition requires the named scope amendment. After corrections provide new full head/tree, minimal delta, relevant shell test and asset-manifest evidence, and corrected owner desktop/phone visual evidence. Independent reviewer can recheck that delta without repeating full audit. Global kit styles and the observed stronger aurora remain a stated visual integration concern, not evidence of a controller defect or permission to dilute the kit target.

No required CI/Bugbot result is inferred from author tests; draft/check state and normal integration merge gates remain coordinator-owned. No root activation, live application coverage, final kit parity, public copy approval or production claim. This review author is independent of K1 implementation.

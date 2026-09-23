# Corrected0.16 functional candidate — independent browser ACCEPT
Exact source f69ac5c3cadcd848fdf3537d57867df2f81c9a6e, tree a9305a4fccb43563cc26903bdf3f9f7047949093. Completes bounded browser proof for the three PR174 corrections alongside source receipt9afafa33b32c535acc047331d7ec25ef0be618fd. Does not accept later metadata, unseen source, service gates or release.

## Actual execution, not attributed proof
Reviewer used detached /tmp/release-fix-review-f69, ran npm run stamp successfully (0.16.0+f69ac5c, canonical20d5144), then served unmodified actual ui/ assets on an ephemeral127.0.0.1 port. Real ui/index.html and ui/assess/index.html loaded their real module graph; no hand-drawn/bundled page substitute. Separate headless installed Chrome, empty contexts, actual390×900 and1440×900. Network restricted to this loopback server; GET-only static server and preloaded existing fail-closed fixture transport reject unknown/nonlocal/mutation calls. Only test-local controlled GET responses supplied outages/held responses.

Saved check.cjs, results.json and six PNGs in /tmp/release-f69-browser. All27 served asset bodies were hashed; every tracked asset matched exact Git source, no mismatches. Generated assets are distinguished in the verifier. Synthetic health fixture retains its historical dummy version; it is NOT release/runtime identity proof. This source graph does not expose ui/client-release.js; no fabricated loaded-client stamp asserted. Provenance is actual source-byte hashes plus exact checkout/stamp, not a relabelled stale bundle.
results.json SHA256904f38860fe2e2cb71d5410a7d127768561af7ef804c2aa64966562374109b1d.
check.cjs SHA256174415d14197c036690159560b202e8ac4f7195e9aa6c3ff47483c06fbd0b62c.

## Passed affected browser journeys
-16 route/host/viewport cases: kit and non-kit × Workspaces/workspace/Projects/project × two widths; each correct visible single page heading.
-4 independent actual Retry clicks: each of the two controls from fresh dual assessments/languages failure at each width; both recover the real project form/model without remaining Retry.
-4 delayed completion cases: held project retry success and rejection after navigating to Workspaces, each width; new title/route retained and no stale note.
-Demo at both widths: actual typed create-form input and original node survive tree search/clear; real submit remains refused without a transport write. Route to project, open phone navigation when collapsed, actual caret click, then projects/project/workspace/assessment transitions retain exactly one visible disclosure and existing links. Four destination routes per width, no non-GET fixture requests. Model updates use the real controller sync path. Sample link hrefs unchanged and present; destination participant workflows were not retested, because participant source is unchanged/outside this release.
-Reviewed actual phone and desktop demo PNGs: disclosure visible and readable, not hidden behind shell; no claim whole-app visual parity.

Two initial harness attempts incorrectly tried a caret before navigating to a page with its tree, then before opening collapsed phone navigation. Corrected harness uses actual available controls; these were test setup issues, not product findings. Final complete run passed both widths. No browser concurrency with Fable, live account, credentials, data changes or logout.

## Disposition and remaining gates
All three source findings are accepted at this exact functional head, backed by100 independently passing affected/anchor tests and10 meaningful parent failures recorded previously. Identity-reset boundaries are independently covered by the affected source suite, not claimed as an additional live/browser account switch.

Proceed with minimal canonical source/evidence reconciliation and app immutable repin under existing authority; historical c9bf evidence remains historical. Final chosen cloud-versus-isolated lineage comparison, complete final metadata/tree acceptance, literal exact-head BugbotSUCCESS/all applicable terminal checks, effective shared-promotion settings evidence, candidate-specific hold disposition and normal DEV deployment/live proof remain required. Production remains separate, same validated version/pin/functionality. No new feature cargo or rollout bypass accepted.

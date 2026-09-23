# Proposed 18-H appendix — A8 Git-controlled DEV and production

Status: PROPOSED, NOT ACCEPTED OR EXECUTED. This bounded operational recipe belongs under `planning/2026-09-16-parity-build/prd/18-H-infra.md`, observed at cookbook `bdb2b45f9c8afe0599f48094301ba509b36fbf1e`. The existing layer is a stub; this appendix does not fill or accept unrelated infrastructure requirements. Producer: bounded Otto planning coordinator. Independent reviewer: a different actual seat, pending. Operational pairing: app baseline `10f5f444d68475d7114ab8fe0bf269fe106476b1`; successor app and cookbook revisions must be recorded when authored, not invented here.

## Governing requirement and outcome

Chris's rulings in app PR3 comments5708020595/5708041749 govern: `main` delivers existing DEV; `production` delivers production. Feature changes enter checked main. Production uses a separately reviewed, captain-authorized main-to-production PR. An explicit staging branch and Cloudflare staging app are optional future scope only when needed. Preserve current data and worktrees.

| Git branch | Existing Worker | Deployment selector | State policy |
|---|---|---|---|
| main | 3d-review-dev | root wrangler.toml, no environment override | Preserve current DEV D1, Access identity, bindings and secret names |
| production | 3d-review | wrangler.toml with production environment | Preserve current production state; separate captain promotion |
| phase-0/walking-skeleton | No ongoing deployment listener after cutover | Historical integration branch | Preserve history/worktrees; do not leave a second DEV delivery path |

No staging Worker, D1, Access application, secrets or migrations are necessary for this correction. Unknown production runtime configuration debt remains debt; branch mapping cannot cure it.

## External dependencies and custody

The accepted revision must carry a receipt table with observation time, owner, source and freshness for: DEV and production Worker tags; existing trigger UUIDs; repository connection; build-token association UUID/name without its value; D1/R2/KV binding identities actually required by the candidate; Access audience/settings; secret names and approved non-disclosing provisioning channel; active version/deployment IDs; source Git SHA; current effective branch rules.

These external resources are not recreated from copied secrets or by replaying data. A clean reconstruction must be able to identify and verify authorized existing dependencies or independently provision replacements under a separate order. The source recipe must specify exact tool/runtime versions and commands chosen by the accepted app candidate. The current source uses ranged development dependencies: that remains part of the whole-repository reproducibility review.

## Preflight and cutover

Use the independently accepted A8 successor plan; the proposed concrete sequence is:

1. Prepare the bounded app correction and this paired cookbook recipe. Any runtime/auth hunk returns to its actual owner. Run exact candidate checks, independent review and literal Cursor Bugbot SUCCESS. Record prospective integration disposition under the historical promotion hold.
2. If correction enters phase0 while its listener remains active, treat it as DEV deployment. Verify the actual build or explain path-filter suppression; preserve data and establish the resulting DEV baseline.
3. Obtain actual bounded freeze ACKs for shared main/phase0 writes. Read both full trigger objects, all current builds, active versions, source heads and effective rules. Drain or specifically disposition identified old builds; a late phase0 build must not overwrite newer main delivery.
4. Create narrowly protected production at the verified empty-main ancestry. Use only the documented creation-only required-check exemption, then immediately tighten it. Leave main/phase0 protections untouched. Verify effective protection before attaching production delivery.
5. Retarget existing production trigger from main to production, changing only branch inclusion and display name. Read back every other field and unchanged production version. Stop on unexpected builds or drift before main is populated.
6. Retarget existing DEV trigger from phase0 to main while main is still empty. Existing Worker, state, selectors, commands, path filters and associations remain. Published provider behavior says settings changes apply to the next build; verify actual trigger/build/deployment readback and stop on contradiction.
7. Obtain whole exact PR3 baseline acceptance, required current-head SUCCESS, terminal checks, resolved findings and candidate-specific disposition. Merge via the protected PR. This push to main is the intended DEV Git-hook delivery, never production promotion.
8. Read the resulting build's `push_event`, main branch and exact merge SHA; match deployed DEV version and scope-appropriate health/API/MCP/UX evidence. Confirm production remains unchanged and old phase0 builds/listener cannot overwrite DEV. Independently verify paired cookbook/app pins and release the freeze with an actual receipt.

Cloudflare's build-settings description says changes apply to the next build; its branch-control description ties builds to push events. These facts support the pre-merge retarget, not an unconditional promise of no provider failure. Source: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#build-settings and https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/ . GitHub documents the creation-only status-check exception: https://docs.github.com/en/enterprise-cloud@latest/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets . The actual returned state always governs.

## Release operation after correction

Feature PRs target main. Independent review, candidate-specific historic-hold disposition where still applicable, required literal Cursor Bugbot SUCCESS and all applicable checks precede integration. Read the Git-hook DEV build and deployment back; a merge receipt alone is insufficient. No manual build dispatch, deploy-hook invocation, Worker upload or seat-run deployment substitutes for the Git path.

Production is a separate main-to-production PR owned by the captain, with its accepted manifest bump, changelog, actual version stamp, production state/config preflight, independent review, required checks and applicable production authorization. The Bugbot promotion policy must be demonstrated by actual behavior, not merely written as comment-only in `.cursor/BUGBOT.md`. This appendix does not authorize promotion or excuse a NEUTRAL check.

## Failure and rollback

Stop subsequent writes if source heads drift, protections fail, a trigger points at the wrong branch/Worker, queued builds remain unexplained, a build appears unexpectedly during retargeting, or production version changes. An API cancellation request is not proof of terminal cancellation. Preserve evidence and read actual terminal state.

Before main contains code, a reviewed rollback may restore the DEV listener to phase0; do not restore the known-bad production-to-main path. After population, retain correct topology and restore compatible code/config via checked PR into main. Never reset databases, replay migrations/seeds, force-reset shared branches, or restore production-to-main. A failed DEV build leaves the prior deployed version to be verified; do not assume its health or trigger a manual redeploy.

## Acceptance and reconstruction receipts

A different reviewer must prove the accepted mapping, exact selectors, effective protections, per-candidate checks, deployment SHA linkage, preserved state identities, production unchanged and no stale delivery path. Maintain expected configuration and release documentation as cookbook outputs with pinned inputs; reconstruct those outputs in a clean isolated workspace and compare them to the accepted app revision. Provider read-only observations can validate declared dependencies; reconstruction does not authorize provider mutation.

This bounded recipe does not prove the whole app is rebuildable. The full tracked repository remains the denominator: runtime, build toolchain, migrations, fixtures, UI, reports and configuration each need maintained specifications and independent clean reconstruction evidence. Original A8 acceptance obligations and dependent product work remain open until actually verified.

## Pending receipts

Fresh independent plan review, prescribed challenge/fire gates, author execution ACK, accepted app/cookbook revision pair and actual cutover/deployment/reconstruction receipts are pending. These are explicit gates, not placeholders claiming running or accepted work.

## Superseding bounded reconstruction specification — revision1.2.0

This section replaces earlier wording that left tool/runtime/output selection to a future candidate. Exact candidate scope is the seven-path manifest in the paired A8 plan's1.2.0 appendix: `wrangler.toml` (comments only), `README.md` (deployment paragraph only), `docs/release.md` (historical topology marked superseded plus governing correction section), `.cursor/BUGBOT.md` (first body paragraph), `AGENTS.md` (one topology bullet), new `docs/deploy.md`, and new `docs/release/a8-control-plane-plan.json`. Every other baseline file is unchanged. No runtime/version-stamp machinery, package/lockfile change or executable TOML change belongs to this slice.

Canonical source is `operations/a8-topology-source.json` alongside this recipe, under `planning/2026-09-16-parity-build/`. It contains exact full UTF-8/LF output content and SHA256 for those seven paths, selected baseline source hashes and baseline appSHA10f5f444d68475d7114ab8fe0bf269fe106476b1. The selected method is deterministic exact content projection, not generative prose, fuzzy patch application or copying from a previously changed app checkout. The first author creates the canonical content in cookbook and projects it into the app. Final app/cookbook revision pairs live in independent PR receipts, avoiding recursive hashes.

`operations/render_a8_topology.py` is a new standard-library-only Python CLI with exactly two modes: `render` validates the source and writes the seven outputs into an empty directory; `verify` validates the source and compares those bytes against an app checkout without mutating it. It rejects duplicate, missing, extra, absolute or traversing output paths, bad hashes, non-LF/nonterminated content and nonempty render destinations. It performs no network, subprocess, clock, package installation, Git mutation or provider call. This is the complete bounded projector contract; no broad generator replacement is planned.

Credited independent reconstruction uses CPython3.11.2; source acquisition uses Git2.50.1. gh2.79.0 is only an observation client. There are no third-party Python packages or new app dependencies. Directory arguments below point to independently fetched clean checkouts at the accepted cookbook/app revisions; EMPTY_OUTPUT must be absent or empty.

```
python3 --version
python3 COOKBOOK/planning/2026-09-16-parity-build/operations/render_a8_topology.py render --source COOKBOOK/planning/2026-09-16-parity-build/operations/a8-topology-source.json --output EMPTY_OUTPUT
python3 COOKBOOK/planning/2026-09-16-parity-build/operations/render_a8_topology.py verify --source COOKBOOK/planning/2026-09-16-parity-build/operations/a8-topology-source.json --app APP
```

The reviewer verifies exact Python version, seven byte-identical outputs and all remaining baseline paths unchanged. Python3.11 `tomllib` must parse pre/post Wrangler to equal structures, with a separate textual check limiting changes to the selected leading comments. The review-only JSON is schema/field inspected without sending it. No npm installation or runtime tests are credited for this immutable-runtime correction; any runtime/TOML semantic change is an out-of-scope failure.

Local candidate authoring and later provider cutover are separate orders. Candidate authoring needs a real author ACK/budget and current gates but grants no provider/shared-branch/integration authority. Provider cutover additionally needs exact accepted app/cookbook candidates, checks, independent cutover acceptance, an actual executor ACK/fire and fresh queues/heads/rules/owner freeze. The settings-first existing-trigger sequence is unchanged. No production deployment is granted.

App source identity is proven by accepted Git mergeSHA -> Workers Build `push_event` / branchmain / exactSHA -> deployed DEV version. `/v2/health source_sha` reports a cookbook contract source pin and cannot substitute. Original runtime stamp requirements remain unresolved outside this correction and still bind later production acceptance. This recipe reconstructs the selected seven outputs only; whole-repository rebuildability remains a distinct incomplete obligation.

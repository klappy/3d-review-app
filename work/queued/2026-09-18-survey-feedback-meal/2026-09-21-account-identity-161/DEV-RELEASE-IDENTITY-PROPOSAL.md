# DEV release-identity amendment proposal — account161

PROPOSED ONLY; no canonical cookbook/app metadata writes. Current source accepted96a56a57, base76fe138, independentdcb93825. PR163 is ready; real Bugbot running and Workers check successful at latest single observation. Existing source seven-path scope remains unchanged until coordinator adopts this amendment.

## Policy and version
Fresh cookbook HYGIENE0.3.0 §10: each compatible bug fix PATCH, cookbook-first immutable pin, same version/product source for subsequent production. App docs/release.md authority chain and required independent pin review remain. Canonical releases.json currently0.14.4 blob5c999103b919975654d1f646a662c083d0414bba; no0.14.5 branch found. Propose **0.14.5 PATCH** for issue161 compatibility-preserving account-identification/switch repair: no capability row, schema, permission or existing HTTP/MCP result shape change. The new guarded browser read mode supports the repair; it is not an alias/profile feature. Coordinator classifies before canonical authoring. Preserve cookbook99/app159 reserved0.15.0 lineage; do not reuse it or overwrite0.14.4.

## Minimal bounded added paths
Cookbook:
- planning/2026-09-16-parity-build/releases/0.14.5.md (new candidate record)
- planning/2026-09-16-parity-build/releases/releases.json (prepend0.14.5 candidate/current; preserve history)
App:
- release/cookbook/0.14.5.md (exact canonical byte copy)
- release/cookbook/releases.json (exact canonical byte copy)
- release/release-manifest.json (0.14.5, immutable cookbook commit, both blob IDs + SHA256)
- package.json (version only)
- package-lock.json (top-level and root-package versions only)

No stamp-script, test, version-source, deployment/config or old release-record edits are needed. Existing ignored outputs src/version.generated.ts and ui/changelog.json regenerate through npm run stamp; do not commit generated files. Current main stamp does not include159's later client-release module; do not silently import that feature.

## Canonical record content
Describe verified matched-email account display, reachable controls, truthful/generation-bound logout and explicit provider-wide switch. Source record names accepted functional head96a56a57 and its review; final metadata commit follows it, no self-referential hash. Persona scorecard fixed denominator: six synthetic root scenario groups × desktop/phone=12 attempted,12 passed,0 failed; real-provider query-forwarding and different-email switch are2 untested cases, kept separately from local UI denominator.46 UI,49 targeted and613 full tests overlap; never sum as unique cases. Source automation/browser evidence attributed accurately; satisfaction/confusion/frustration NOT MEASURED. DEV/production are not live for this increment; current immutable0.14.4 pin/history retained. No actual email/ID/screenshots in canonical record.

## Required sequence and gates
1. Coordinator adopts exact bounded metadata scope and PATCH classification; actual cookbook writer ACK and independent release-record review under existing authority. Search fresh records before creation.
2. Land canonical candidate record/index through normal cookbook review path, readback exact commit.
3. Author five app metadata paths only; record complete pin/blob/SHA256 chain and inherited accepted seven-path source unchanged.
4. Run existing npm run stamp, test/version-stamp.test.ts and typecheck; full613 suite already accepted for unchanged source, broaden only new concerns/required checks. Independent reviewer with canonical access compares exact byte copies/blobs/hash and final head/tree; changed head needs current real Bugbot/all attached terminal checks.
5. Before main merge refresh canonical DEV trigger, claims, findings, comment-only service behavior requirement and candidate-specific coordinator disposition under docs/release.md. No inference from a green Workers PR build to deployed DEV.
6. Normal main merge/push deploy only after authority; actual account read/provider journey on canonical DEV after deployment, no live incident logout fixture. Same-version production follow-through separately governed.

No source/data/grant/seed changes, no manual deployment, no promotion permission. Current blocker to ready-for-merge: release identity still0.14.4 until this amendment is accepted/pinned; Bugbot not terminal; prospective disposition and actual deployment/provider validation still owed.

## Coordinator adoption — scoped metadata preparation

Delegated Auggie read this exact proposal5d93d131 and independent source acceptance dcb93825. Adopt 0.14.5 PATCH classification for the bounded compatibility-preserving incident repair and the exact two cookbook/five app metadata paths above. This explicitly extends seven-path source custody for release identity only; source behavior must remain byte-identical to accepted96a56a57 except these metadata files. No reserved0.15.0 cargo, config, generated files or unrelated records may be changed.

ui_audit is assigned bounded cookbook/app candidate authoring, subject actual ACK and current cookbook normal review rules. Independent orphan_audit reviews canonical release record/pin and final source+metadata head. Prepare cookbook branch/PR first, then immutable canonical pin only through its proper merge gates; no direct-main shortcut inferred. App metadata follows that verified pin. Record actual heads and terminal checks, no repeated unchanged polling. This grants metadata preparation, not main/production merge or deployment. Candidate-specific prospective disposition and real-provider acceptance sequencing remain as above; actual shared-promotion comment-only configuration is not waived.

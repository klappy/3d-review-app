# contract-v0.1 — DRAFT (projected by Fable from cookbook 04 @ 59be64c)

Lane A (Astra/Otto) owns this folder; this draft exists so the other lanes can mock against something today. Accept, amend or replace — a Fable draft is not Lane A's acceptance.

- `capabilities.json` — 79 rows: id, class (read / write.reversible / write.effect / write.dangerous), tool (docs/read/write/danger), HTTP twin, roles (as 04 states them), slice, inverse (true / none + compensating control), danger two-step flags, public flag. `path_inferred: true` = 04 elided the path; **37 rows** need Lane A confirmation.
- `openapi.yaml` — 3.1, 64 paths / 79 operations, shared `Envelope` / `ErrorEnvelope` / `Receipt` / `Impact` / `DangerBody` schemas, three security schemes (session cookie, delegated bearer, participant token), `x-capability` / `x-class` / `x-tool` / `x-inverse` on every op. **Per-capability params/result schemas are owed** (next increment) — this draft fixes ids, classes, twins, roles, inverses and the envelope.
- `contract-manifest.json` — bundle freeze state per 04 section (A–J); nothing frozen; open items listed per bundle.
- `tools/gen_contract.py` — regenerates all three from 04; edit the matrix, not these files (cookbook 10-REPROJECTION-AUDIT).

Rules carried: danger twins are never GET; `SUPPRESSED` is `ok:true`; `v2.1-oct` rows are documented 501 `RESERVED_NOT_BUILT`; parity = normalized-receipt equality HTTP vs MCP (cookbook prd/18-D MCP-REQ-013).

## Feedback attributed-write amendment

The optional `cap.ops.feedback` parameter `require_authenticated` is hand-projected from [the canonical additive amendment](https://github.com/klappy/3d-review-cookbook/blob/e9c09cb97ef206abb418de741bb93629bd1c9e23/planning/2026-09-16-parity-build/AMEND-2026-09-18-feedback-attributed-write.md). Its field-level `x-cookbook-source` in capabilities/OpenAPI identifies that exact amendment; the historical base-matrix source and generated timestamp above are not a claim that this later field was generated from that matrix. The old `tools/gen_contract.py` does not project this or all prior amendments and must not be used to overwrite the evolved contract without reconciling them. No whole-contract re-projection or release-manifest repin is claimed.

## Live roadmap additive candidate

The six `cap.ops.roadmap_*` rows and HTTP/OpenAPI projections are hand-projected from [canonical amendment rows](https://github.com/klappy/3d-review-cookbook/blob/f5fb9a28ee3ea017859e521ac672f4c58236a9b4/planning/2026-09-18-live-roadmap/capabilities.json) at `f5fb9a28ee3ea017859e521ac672f4c58236a9b4`. Base matrix provenance above remains historical; no whole-contract regeneration or release pin is claimed. The same four tools dispatch reads, history and confirmed writes. Agent reports remain claims, narrow existing-identity permissions fail closed, and public data omits private audit. Canonical contract acceptance and operational publishing proof are pending independently of this source candidate.

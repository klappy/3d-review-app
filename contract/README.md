# contract-v0.1 — DRAFT (projected by Fable from cookbook 04 @ 59be64c)

Lane A (Astra/Otto) owns this folder; this draft exists so the other lanes can mock against something today. Accept, amend or replace — a Fable draft is not Lane A's acceptance.

- `capabilities.json` — 79 rows: id, class (read / write.reversible / write.effect / write.dangerous), tool (docs/read/write/danger), HTTP twin, roles (as 04 states them), slice, inverse (true / none + compensating control), danger two-step flags, public flag. `path_inferred: true` = 04 elided the path; **37 rows** need Lane A confirmation.
- `openapi.yaml` — 3.1, 64 paths / 79 operations, shared `Envelope` / `ErrorEnvelope` / `Receipt` / `Impact` / `DangerBody` schemas, three security schemes (session cookie, delegated bearer, participant token), `x-capability` / `x-class` / `x-tool` / `x-inverse` on every op. **Per-capability params/result schemas are owed** (next increment) — this draft fixes ids, classes, twins, roles, inverses and the envelope.
- `contract-manifest.json` — bundle freeze state per 04 section (A–J); nothing frozen; open items listed per bundle.
- `tools/gen_contract.py` — regenerates all three from 04; edit the matrix, not these files (cookbook 10-REPROJECTION-AUDIT).

Rules carried: danger twins are never GET; `SUPPRESSED` is `ok:true`; `v2.1-oct` rows are documented 501 `RESERVED_NOT_BUILT`; parity = normalized-receipt equality HTTP vs MCP (cookbook prd/18-D MCP-REQ-013).

# Publish progress through the existing MCP connection

This is the operational producer hook for issue123, not a token setup procedure. Authenticate through the existing 3D Review connection. Start with `read` → `cap.auth.me` and confirm that the server grants the specific roadmap permission when performing the dry run. Being connected, a project owner or support is not sufficient by itself. If refused, use the existing sign-in/consent or have the authorized operator provision the narrow server permission; never paste a token into chat or embed credentials in a client.

At work start, review request/findings, check result, DEV/production verification candidate and blocker/resume:

1. `read` → `cap.ops.roadmap_read` with `{}` obtains the current `cursor`.
2. Prepare one stable UUID for this logical publication, a public item ID `roadmap-<issue-number>`, the predefined lifecycle kind, stage/state and structured public evidence references. No narrative, actor, role, environment, tenant ID or private source pointer belongs in an automatic status event.
3. `danger` → `cap.ops.roadmap_publish`, `mode: dry_run`, with the params below. Inspect the actual disclosure impact. The user-authorized coordination workflow permits these narrow public metadata reports; a private-content publication is not implied.
4. `danger` → same capability, `mode: execute`, identical params and returned `confirm_token`. Record the minimal sequence receipt privately with the work checkpoint. An uncertain response retries the same idempotency key and same params; do not blindly create another event. A stale cursor refusal requires rereading and a new explicit intent/dry run.
5. An authorized, different verifier independently checks the evidence and calls `cap.ops.roadmap_verify` through the same confirmation flow. Until then it remains a publisher claim. Do not self-attest a verified transition as the report author. For a DEV/production identity claim, the same permitted principal may request `serving_release_checked`: the server checks a fixed trusted health endpoint itself and records only that limited fact. This does not prove browser behavior or user acceptance, and earlier stages still require acceptance. No second account is required for that trusted integration path.

Example params (illustrative IDs, not an instruction to publish this example):

```json
{
  "expected_cursor": 0,
  "event": {
    "idempotency_key": "d0ba4251-1358-4ab8-b62f-23192c2b67df",
    "item_id": "roadmap-123",
    "kind": "work_started",
    "stage": "built",
    "state": "pending",
    "evidence": [{"repo":"3d-review-app","kind":"issue","number":123}]
  }
}
```

The metadata schema accepts only public structured issue/PR/commit references. `dev_verified` and `production_verified` are report kinds, not bypasses of verifier authority. Publish a reviewed title/feedback summary/priority/scope/outcome/recurrence separately using `cap.ops.roadmap_summary` after independent public-suitability review, citing its public review reference. Never auto-copy private feedback. Use `cap.ops.roadmap_redact` for exposed public content; append normal corrections through summary/history without erasing ordinary provenance.

Deployment acceptance: apply the D1 migration through the existing approved migration path; configure narrow principal permissions without changing credentials; validate both HTTP and installed MCP writes and an open browser on the same running build. DEV is provisional. After normal production promotion, production is canonical. This candidate has local proof but has not completed those operational/deployment checks. Record this as pending, not as an active producer already running in production.

## Reviewed deployment wiring for 0.12.0

The existing canonical Workers Build receives narrow publisher identity in its secret build environment, never a public Git file. `stamp-roadmap-permissions.mjs`, called by the existing version-stamp hook, hashes IDs into a git-ignored **server-only** module. It logs no identity and rejects populated permissions outside canonical Workers Builds. Missing lists remain empty; verifier and narrative-review lists are not implicitly granted. Runtime binding overrides remain available for isolated tests and explicitly configured environments. Source hashes are authorization metadata, not new credentials.

The canonical deploy command runs `node scripts/prepare-roadmap-deploy.mjs dev` (production later uses `production`) before its existing `wrangler deploy`. The helper requires Workers CI, matching canonical branch and exact checkout commit; preflights the five expected schema objects, applies only reviewed `0010_roadmap.sql` when all are absent, then validates schema and clock. A partial/different schema, failed provider command or invalid readback stops deployment. Existing matching tables preserve all data and cursor. It never replays initial migrations or seeds and must not be run against remote data from a seat. Branch preview uploads do not run this hook.

Provider configuration is scoped to the existing main→DEV trigger first. Production trigger changes remain separately coordinated after priority0.11.4 delivery. Read back secret variable metadata only, command/filter/binding preservation and the canonical push-event build. Operational same-connector publication is still pending until the reviewed0.12.0 build is live.

Reviewed summaries may also supply `happening_now`, `blocker`, `next_action` and `queue_order` (public-safe text, at most 500 characters each). These are optional and use the same summary-review authority and confirmation flow; `null` explicitly clears a prior value. Cite the public suitability review, describe actual current work/retry/queue action, and do not invent schedules. Omitted fields preserve existing operational context; keep it updated or clear it when stale. The public projection stamps when this context was reviewed.

Public reads expose `value.reported` separately from `value.stages`. Each reported stage is the latest non-redacted public claim, with its sequence, recorded time and attribution; it is not verifier acceptance. Historical imports are included without republishing or granting verification authority. Missing attestation must not be interpreted as proof work has not started. Delivery labels alone do not establish human outcomes.

`workflow` is an optional reviewed `past`, `now`, or `next` position (nullable to clear). It is not inferred from verification, timestamps, issue closure or production claims. Active blocked work remains `now`; parked/queued work is `next`; reported completed work is `past`, even if independent verification is missing. Missing placement is Unclassified. Optional `queue_rank` is an explicit positive integer, nullable to clear; missing rank never becomes an inferred priority. Update workflow and operational context together when moving work.

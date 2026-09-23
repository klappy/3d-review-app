# Read-only visibility incident receipt — 2026-09-21

Observed through 2026-09-21 22:33 America/New_York (2026-09-22 02:33 UTC). This is diagnostic evidence, not a recovery or data-loss conclusion.

## Observed

Canonical health remains DEV 0.14.4 / 76fe13823dda23c9c046d2b44cdce94fc0842602 and production 0.14.3 / 0b798cede7f5ed4a5ccc82de4e196a5587f8ecef; D1 health OK. No PR162 preview head appears in these health responses. Cloudflare Workers settings GET independently confirmed each live DB binding matches the database queried.

Authorized Cloudflare D1 SELECTs returned HTTP 200, changed_db:false and rows_written:0. DEV contains 11 workspaces (9 unarchived), 41 projects (35 unarchived), 57 assessments (50 unarchived), and 108 grants. These totals are NOT verified real user work: a principal explicitly used as a synthetic owner in source fixtures created 9/39/55 of those entities and holds 101 grants. Two other principals each created one workspace/project/assessment and hold three owner grants; their display names indicate demo/proof purposes but synthetic status is not independently established. Names and identifiers were sent privately for recognition and are omitted here. One remaining principal holds one grant.

The browser-observed principal in each environment exists, is provisioned, and has zero grants. Each record's stored email hash matches a forward SHA256 calculation of the already-observed Access identity email; no reverse lookup was attempted. The DEV connector uses a different principal with three owner grants and visibility of one workspace/project/assessment; its visibility does not establish browser access.

Production's currently bound database contains zero workspace/project/assessment rows and zero grants. A narrow receipt-history query found two total receipts but none for cap.workspace.*, cap.project.*, or cap.assessment.*. Trace count is 1,236, with timestamps spanning September 18–22; trace payloads were not retrieved. The receipt absence does not establish that entities never existed, were deleted, or exist in another historical database. No complete historical deletion or backup audit was performed.

Source auth callback lowercases the verified Access email, hashes it, and selects a principal by that hash. Principal IDs are opaque random IDs; sessions reference the stored principal. Current browser-to-email mapping is verified by the database comparison, not inferred solely from sharing a browser. The recent 156 merge changes roadmap UI and release/version metadata/tests, not auth, root shell or data handlers.

## Boundaries and next decision

No data, grants, sessions, configuration, deployments, or login state were changed. No credentials, private names, email addresses, principal IDs, hashes, or raw feedback are included in this record. Only this coordination receipt is a write. Existing data ownership must be recognized and independently verified before any recovery proposal; no ownership transfer is authorized by these observations. Production historical existence/deletion remains unknown.

## Authorized known-identity comparison follow-up

The user supplied two additional exact email addresses privately. Forward hashes of only those normalized addresses were compared with principal records in both environments. One supplied identity matches the DEV connector principal and its three owner grants and one created workspace/project/assessment set; its production account exists but has no grants or created entities. The other supplied identity has a DEV account with no grants or created entities, and no matching production principal. Neither maps to the other proof-named DEV set. Addresses, hashes, principal identifiers and private display names remain omitted. Account existence is not evidence of work ownership. Both completed SELECT requests returned HTTP 200, rows_written:0 and changed_db:false. An initial JavaScript syntax error executed no query; its corrected invocation succeeded. No login, grant or data change was performed.

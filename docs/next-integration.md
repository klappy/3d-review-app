# Next UI integration candidate

Status: provisional, unreleased. `/` retains the current design; `/next/` is the existing opt-in interface. The existing cookbook demo-wiring unit owns this integration; the queued plan-persistence and practice-copy units retain their identities.

This candidate combines the existing resource, workspace-inheritance, sample-label, email, PDF, skeleton-loading, access-code, resource-wiring and project-metadata branches. Their original branches and authorship remain intact. It adds the connecting application behavior: authorized project/workspace directories, discovery controls and scoped browser views, contextual People and current-design navigation, account/release/roadmap screens, report selection/content/metaphors, saved notes/dates/completion, lifecycle confirmations, invitations and explicit survey-link management.

## Persistence and identity

- Notes use the existing assessment notes endpoint and the legacy notes trailer. Completion advances allowed stages before adding the durable marker to the latest notes observed after those stage writes. It does not replay an earlier note snapshot. The existing API does not provide atomic note compare-and-swap semantics.
- Completion is bound to the initiating review, operation generation, bearer and principal. Unmount/navigation stops continuations; mutation boundaries reread the current principal for cookie-session changes. Existing server authorization remains authoritative. No client check grants access.
- Dates remain readable note text. They do not schedule reminders or automatically create reviews. The plan link requires the review's existing grants and displays current saved notes; it creates no anonymous access or expiration promise.
- Grouping a project requires a direct project-owner grant and direct ownership of every contained review, including archived reviews, checked again in the database write. Existing workspace grants still inherit into projects and reviews; a project-only owner cannot use a new workspace to open someone else’s review.
- Ownership, invitation acceptance and deletion retain server previews and confirmation tokens. Cancel sends no execute; uncertain operations do not silently retry. Receipt-backed undo uses only the server-issued inverse, never an invented compensating PATCH.
- Saved Explore views contain browser preferences, including the search term, keyed by origin/account/access mode. They do not store result rows or credentials. Loading revalidates the selected project against the currently authorized list.
- Request activity is a bounded in-memory receipt/trace projection for this tab. It excludes request URLs, bodies, credentials, identity values and note content, and resets across identity changes. It is not a complete account history.

## Navigation and documents

Selected report IDs must belong to the assessment's authorized paginated list. The ID follows result/report/plan navigation and the report PDF endpoint. A stale ID offers a route back to latest results. Saved narrative, indicators, agreement, evidence and provenance remain visible.

Survey selection uses IDs rather than retained array indexes. Changing review destroys pending PDF controls; changing URL/session invalidates prepared files. Generated QR/paper documents contain a same-origin return link that works without an opener or browser history. The working sample participant fallback is explicitly labelled and uses the retained current-design sample.

Binary PDF rendering requires the configured Browser Run binding. The candidate's binding is DEV-only; production does not inherit it. A missing binding returns an honest unavailable response with Print as the alternative. Binding availability, rendered PDF content/fonts and installed-PWA Save/Open/Share/Print return require qualification on the actual environment and device. No deployment or billing change is established by this source document.

## Outstanding capability/source boundaries

- Persistent isolated practice copies and generated/cleared simulated responses have no existing per-user capability to adapt. The static sample and DEV bootstrap are not independent persistent copies. Existing empty-assessment deletion must not be used to bypass response retention for practice copies.
- Recommendation proposal/review and assisted paper entry remain reserved/policy-held capabilities. This candidate does not invent their data or weaken their holds.
- Resource plumbing is present, but the shared source table is empty. Supplied resource content remains an external dependency.
- Exact historical last-good demo build/URL/fixture remains unrecovered. Fixture-board, labelled-sample and real-store results must be reported separately.

Release qualification requires the unchanged 245 legacy action IDs plus 17 Next promises, source dispositions distinguished from runtime evidence, real-write readback/reload, interrupted/repeated flows, negative roles, desktop and installed-phone-PWA navigation, independent exact-head review and completed checks. New code or passing fixture tests alone do not establish all 262 outcomes or a live release. The existing frozen production promotion remains separate.

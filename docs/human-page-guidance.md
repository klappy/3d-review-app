# Human page guidance

Contract: `human-guidance-2026-10-14`.

Sign-in and project pages show concise guidance beside the relevant action, without generic “Learn more” disclosures. The project/workspace shared header shows the role badge once. The account menu, language controls, permissions and primary actions retain their existing behavior.

Capability inventory remains at `/assess/whats-here.js`, discoverable through the `3d-review-capability-source` HTML meta element. Existing provenance attributes remain intact. The new `data-provenance` value resolves to this contract; the private cookbook receipt holds the owner-feedback and attachment lineage.

Normal sign-in never offers synthetic identities. Developers can explicitly open `https://dev.3dreview.app/?dev-tools=signin#signin` (or the same query on localhost/loopback). This is a presentation control only. The existing server authentication, synthetic-email restrictions and authorization remain authoritative and unchanged. Production never renders this form, even with that query.

Design basis: owner feedback on 2026-10-14 22:24:46 America/New_York, and the private cookbook's `design/2026-09-28-glass-redesign` proposal: README audit item 5 (`ed3a64e871b09eb6aa89e716db1a8c355ab1081b`), Foundations (`d10f6ab4e20edf6de4aca1d0953f1b3fc96dd152`), Setup1 (`3370ac2f8e51aac728fdbadb0f983e3b4d5b7569`) and Setup2 (`74d23458f4a6cc7e60a636c132cb5d4a7fb86e22`). The proposal supplies guidance placement and existing glass composition, not blanket adoption of future screens. No theme overhaul, backend change, scoring change or permission change is part of this correction.

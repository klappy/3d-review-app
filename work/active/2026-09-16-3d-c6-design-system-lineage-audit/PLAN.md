# C6 audit plan — source-to-experience traceability
Prepared by Auggie coordinator, session /root/auggie_review, 2026-09-16 21:18 EDT. Status: proposed readiness amendment; worker not yet acknowledged. Existing C6 ticket and its historical CHECKLIST remain intact.

## Scope and authority
Continue C6, never cut a duplicate. Audit the last Lovable v1.1 baseline through all discoverable subsequent 3D Review design meetings, criticism, improvement requests, current accepted constraints and intended workflows, up to this audit's observed cutoff. The known-source list is a search seed, not a completeness boundary.
Steve Watters' full pinned 3d-quality-review governs survey questions, answer semantics and scoring. Current accepted API, source rulings and constraints govern behavior. The proposed design system is an artifact under review, not authority to discard a missing app feature.
The ticket's phrase "does not block the Thursday demo" is scheduling language only; it cannot waive privacy, authorization, data-integrity or full-app acceptance requirements.

## Observable workflow
1. Freeze artifact references: cookbook PR24 initial reviewed head 00510017c94253007b1bd394952c54c088fee0a3; PR12 initially observed dde072688838a64fa64e9dfcc5215fd41344347d; refresh before fire and record changes rather than silently replacing the audit baseline. Current app capability contract has 83 rows.
2. Enumerate corpus through repository source indexes and cross-references, rolling notes, known Bee conversations, actual callable transcript-memory/tool coverage and search by project/date. Record source id/date/location/reachability/read status and expected missing ranges. An unread or inaccessible source prevents an exhaustive-all-meetings conclusion; no invented "no asks" result.
3. Inventory Lovable screens/components from actual pinned source. For every source improvement/constraint/intent, create a stable ask id, distilled meaning, exact source identifiers/sections, original/current decision and supersession chain, current disposition, artifact evidence, implemented app evidence or explicitly untested, and existing owner ticket.
4. Distinguish design coverage from implementation coverage and validation. "Covered" requires observed artifact behavior/content at a named revision; merely mapping an operation to a route is insufficient. Use partial/missing/contradicted/retired-with-reason and explicit unverified when evidence is absent. No retired-with-reason without a cited authorized decision.
5. Test relevant human workflows by actual browser, and app workflows through API/MCP where within authorized synthetic scope. No real participant data, source rewrites, design fixes, deploys or merges. Browser traces/screenshots bind tested revision, persona, route/state and assertion; report smoke vs acceptance separately.
6. Produce declared LINEAGE-AUDIT.md and improvements-ledger.tsv on a separate audit cargo branch, with source inventory and missing coverage. Route findings to existing C1–C5/A/B/G tickets; create a new issue/ticket only when no existing owner scope fits.
7. A reviewer other than the ledger author spot-checks at least 10 covered rows against source+artifact (20 if any false covered is found), plus all critical privacy/auth/integrity findings and retirements. Full acceptance remains pending until complete corpus/dispositions and independent evidence meet the ticket.

## Privacy and ownership
Read transcripts through authorized sources; public products contain neutral source identifiers and distilled asks, not verbatim transcript or unrelated audio. Existing raw-source issue in PR24 is routed to Design/custodian separately; do not delete or rewrite their branch/history. No captain voice text authored or changed.
Auggie coordinates and reviews; a real non-Design worker must accept the audit pen and promise before fire. Design retains design fixes; Fable retains auth/shared contract; Astra report delegation remains separate.
The order's 180 minutes is a proposed budget, not an acknowledged worker promise. Coordinator first receipt promise remains 25 minutes from 21:14:40 EDT. Worker acceptance must give start/deadline and bounded partials; budget never silently resets.

## Review readiness
Kitchen PR123 independent finding receipt: https://github.com/klappy/kitchen/pull/123#issuecomment-5706935114
Cookbook PR24 independent finding receipt: https://github.com/klappy/3d-review-cookbook/pull/24#issuecomment-5706938796
Root independent authority review: https://github.com/klappy/3d-review-cookbook/pull/24#issuecomment-5706935196
No check, claim or record here is a merge authorization. Exact-head required checks must finish SUCCESS; current PR24 Autofix may still write.

## Triple-loop learning
Fix: resolve concrete design/source gaps in their owning tickets after review.
System: replace capability counts with a source-to-decision-to-experience ledger, with explicit unread sources.
Learning machinery: measure whether independent reviews find false coverage earlier, how long reviewed work waits for owner response, and how much captain intervention was required. This plan creates no new canon rule.

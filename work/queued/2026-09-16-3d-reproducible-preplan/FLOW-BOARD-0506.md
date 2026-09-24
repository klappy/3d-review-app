# Existing-team flow audit —2026-09-17 05:06 UTC /01:06 ET

**One current constraint: a stable, independently accepted combined release candidate.** More authoring throughput does not currently produce accepted DEV collection flow. App23 moved699cd4a→a5949e76; latesta5949 has no checkruns observed. Integration branch moved485914b→`d53abb4cea0a05a51d1d0fa6ce9ca9b6ee611ac7`, while the latest reviewed protected-hunk/120-test receipt targets485914b. Exact candidate acceptance is therefore the point where useful work waits. Remote schema preparation is a parallel dependency with its separately accepted source-gate split, not a reason to hold UI review. Reassess this bottleneck when final candidate checks pass; then deployment/acceptance may become the constraint.

## Observed flow board (classification, not merge/closure order)

| Queue | Current inventory / evidence | Pull next |
|---|---|---|
|Release-critical active|Design23 UI corrections and single integration branch; Auth metadata hunk/union review; Auditor final browser; A8 exact additive DEV schema execution under root gates.|Finish current union/metadata/UI correction; publish one exact final head, scoped diff and test receipts. Parallel schema only under its own FIRE.|
|Reviewed waiting / integration input|App25Auth2315a82 BugbotSUCCESS04:51:29; app24API fc0bbc3; app22A8 docs; paired cookbook31Auth,35operations,36API essentials,34acceptance and current Design copy rows.|Consume into one candidate/cookbook release pin; do not require independent merges of every source PR.|
|Superseded components retaining unique evidence|App12/15/19/20 lineage is represented in25; app18 selected recovery files inintegration; app3 broadoldbase. Cookbook oldplans12/18/23 and design24/25 include rationale and unresolvedfullgoal evidence.|Keep provenance pointers; later existing queue owner may reconcile/close only after exact content/evidence disposition. Open does not mean independent remaining implementation.|
|Deferred full-goal inventory|App14extra seed coverage,16mail,17partial acceptance sweep; cookbook21B1held corpus, broader Design28/30/32 corrections and fullreconstruction18 obligations beyond essential current rows.|No new authors pulled while release candidate waits, except a concrete blocker on current accepted slice. Preserve fullapp/reconstruction obligations; do not count them completed or deleted.|

Inventory observed:13openappPRs and13opencookbookPRs. These are not26remaining delivery units. Classification is scoped to this increment and known lineage; no stale plan is silently promoted. No PR/ticket is closed by this audit.

## Smallest workflow change: make the final-candidate slot pull-based

One integration writer (existing Design worker), one frozen candidate under final review, one consolidated finding batch. Owners return exact protected hunks to that writer; they do not create competing combined branches. Reviewer/Auditor pulls when a head is declared frozen with exact change list, rather than repeatedly testing shifting heads. A genuine security blocker interrupts; small discovered metadata/copy corrections are collected into the current bounded batch and require only applicable delta checks, not unrelated scope growth. Literal mandatory finalhead checks remain.

Root's next handoff should contain **the ready input, actual receiving owner, exact next action, and stop condition** in the existing Git issue. Sender's “ready/standing by” is not a receiver ACK. On completed Codex workers, use actual followup_task; a queued send_message does not restart work. On native tasks, verify the existing task resumed/ACKed before claiming running. This is a concrete dispatch protocol, not a promise of an unimplemented watchdog.

WIP limits proposed for this increment:1combinedwriter;1frozenfinalcandidate;1activeblockedfindingbatch per owning specialty;1separateDEVschemaexecutor;0newoptionalproductdishes until firstsliceacceptance. Spare capacity may independently review the ready candidate, prepare exact acceptance inputs, or reconcile the previous frozen release. Idle available reviewers are preferable to new speculative product inventory. Do not force all seats to be busy.

## What the observed delays suggest

- Root watchdog burden is real: this coordination history repeatedly found completed tasks needed actual followup dispatch, while send_message only queued. Attach a named next pull at each return; root confirms transitions, not repeated status prose. There is currently no autonomous watchdog receipt, so do not claim one.
- “Standing by” handoffs leave custody invisible. Require ACK/START timestamps separate from delivered cargo; when input arrives root immediately dispatches the existing receiver once. No elapsed-time approval or inventedbudget.
- Integration was deferred while source PRs accumulated. API24 opened04:24:05; Auth25 opened04:25:20; Design accepted combined custody04:44:02 and reported assembly START04:47:39, END04:50:48, published return04:54:31. These are observations, not proof all preceding minutes were avoidable: Auth release/review and other gates also intervened. Next increment should reserve the integration owner and exact interface at ordering, then continuously assemble accepted independent slices before final freeze.
- Review scope grew through unrelated provenance/count/copy issues discovered near the end. Add a brief source-fidelity/metadata check to the same owner handoff before final freeze; retain severe findings as blockers and route wider fullgoal observations to their existing homes. Never demote a real security finding merely to meet time.
- Progress denominator has mixed13PRs,83capabilities,tests and wholeapp goals. Fix it per accepted increment: staffsetup/select→share→twoanonymousresponses→receipt/resume/retry→staffcounts, withsecurity/source/releasegates explicit. Record newly accepted scope separately. “120tests” is evidence, not percentagecomplete or independentuseroutcomes.

## Metrics available without new instrumentation

At05:06:41Z, PR-open age: app23≈52min,24≈43min,25≈41min; oldapp3≈8h38min. Cookbook12≈15h05min,18≈14h58min; these long-lived planning/evidence PRs are not necessarily active WIP. PRupdatedAt is not completion or last productive work.

Measure next: ready-to-ACK latency from linked Git delivery/ACK times; ACK-to-actualSTART; candidate freeze-to-review/checkcompletion; number of candidate invalidations after freeze; acceptedfinding-to-appliedSHA; deploymentSHA-to-realacceptance; count of active writable candidates vs reviewedwaiting inputs; age of oldest ready item blocked at currentconstraint. These timestamps/counts are observable in Git/check/tool receipts. Authoractive time, idlecost, remainingduration and throughputpercent are unknown unless an owner supplies evidence. No fabricated utilization or30%heuristic substituted for elapsedcriticalpath.

After first verified shipment, pull cookbook reconstruction one frozenreleasebehind inparallel with nextincrement: immutable appSHA/config/migration/version/PR/check/review/acceptance bundle. Its target must not chase nextsprintcommits. Existing Auggie/reviewer custody requires actualACK; no newcrew or deadline invented.

No product edits, merge/close/deploy/DB action or duplicatedtests. Root owns process disposition and sharedjournal; this is a local review artifact only.

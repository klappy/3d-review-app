# Report capture correction

Order: cookbook issue14 comment5706615047. Base e4f77f3b27ced6c4917b247cc51bc109107d99fa; original worktree preserved. Preparation only, no public contract/routes or deployment.

The current projection queries responses after snapshot creation, allowing a concurrent append to score inputs absent from the snapshot. The accepted plan captures one authorized ordered response set with template metadata, then fingerprints and scores that same set. Fingerprint version changes preserve historical immutable rows.

Driver-seat review: an auditor must be able to associate every scored response with its snapshot. Re-query/retry was rejected because concurrent writes create churn and repeated comparison paths. Instead keep the joined input capture immutable in memory. Include items and perspective in fingerprint because changing scoring metadata must not reuse the prior identity. No raw answers enter evidence or logs.

Verification requires a deterministic append after capture and before persistence: first projection and evidence exclude it, next projection includes it with a new hash. Metadata changes must also change the hash. Existing deduplication, grant isolation, immutable-row, and source-scoring regressions must pass. This does not implement server synthetic attestation or public D7 output; historical get/list remain internal metadata.

Oddkit preflight FOUND and challenge CHALLENGED nonblocking. Gate returned NOT_READY, misclassifying requested planning-to-execution as exploration-to-planning and claiming missing problem statement; this is not a gate PASS. Bounded local preparation follows the explicit reviewed order; independent review and all promotion gates remain required.

## Verification and debrief

Scoped tests: four files, 12 tests passed (report snapshots, source-item scoring, reference rollup, reference narrative), plus TypeScript and whitespace checks. The deterministic interleaving regression was also run against the original double-query projection: it failed on the unexpected appended response; the candidate passed. This establishes that the test detects the reported race rather than merely restating implementation.

An existing test fixture used nonexistent TR-Q1 option `informal`; it had previously only been fingerprinted. Exercising its scoring path exposed that fixture defect. The fixture now uses source-valid `documented`; no scoring formula changed.

The error was a split observation boundary: persistence and scoring each treated their own read as current truth. The correction gives both one captured input set. Fingerprinting now includes template items/perspective, and the internal algorithm identifier changes to preserve old immutable identities. The learning correction is a deterministic interleaving test; simple concurrent deduplication alone did not test append-between-read behavior. Independent review remains pending; no public report readiness or promotion is claimed.

# CANONICAL AMENDMENT RECEIPT — 0.16.0 corrected-source record (Fable release worker, K3a)
Observed (oddkit_time): order read 17:03:11Z; owner ACK + gates 17:04Z; cookbook branch created and read back 17:04Z (actual START); amendment commit + PR by 17:06Z (receipt written 17:06:19Z). NOT merged; NOT a release; app repin NOT performed. K5 checkpoint 10cd7e0c untouched; no interleaved writes.

## Order revision and acceptances read
- CORRECTED-SOURCE-METADATA-AMENDMENT-2026-09-22.md @ kitchen 1cbfbc510bd765081be8118e10c053486092d157 (blob edf546e0). Plan ACCEPT INDEPENDENT-CORRECTED-METADATA-PLAN-ACCEPT.md @ 0fb0010f3700 (blob 3dfbbf74). Source selection CORRECTION-SOURCE-SELECTION-2026-09-22.md (blob 6f7c88b1). Source review INDEPENDENT-SOURCE-REVIEW-f69ac5c.md (blob 038ae278; ACCEPT 9afafa33). Browser ACCEPT INDEPENDENT-BROWSER-ACCEPT-f69ac5c.md @ f63a495c351d (blob feee2f0d). Kitchen main at read: 2000d7a4.
- Same owner/custody as CLAIM f268df33; no new boarding.

## Fresh observations (17:03–17:04Z)
- App PR175 open draft, head design-batch/fable-174-isolated-corrections-20260922 @ **f69ac5c3cadcd848fdf3537d57867df2f81c9a6e**, tree a9305a4f, parent 907bd5d2; four paths (+206/−14) exactly as the source review states. Check-runs at f69: Workers Builds dev success only (no Bugbot run observed on that head yet).
- App PR174 head still 907bd5d2, open — untouched by me.
- App metadata at f69: package.json 0.16.0; manifest 0.16.0 pinning cookbook 20d51447 with blobs a0f0173c / 5e644077 (pre-amendment record).
- Cookbook main 20d51447; no open 0.16 PR; only `release/0.16.0-kit-root-20260922` existed as a 0.16 head.

## Owner gates (actual)
- oddkit_preflight 17:04:13Z: FOUND (reviewability-standard, seeded-response-standard surfaced; DoD definition-of-done).
- oddkit_challenge (planning) 17:04:19Z: CHALLENGED, knowledge_base, tensions none, block=false. Answers: confidence = working belief on fresh reads above; evidence = PR175/manifest/cookbook reads cited; alternatives rejected = new version number (nothing shipped, policy forbids promotion-only bumps), superseding record file (would break the index's one-entry-per-version shape and the manifest's two-record pin); risk = double-applying a cloud delta or binding a moved head — mitigated by recording f69 as "corrected functional candidate" with the selection order cited, repin deferred to final selection; reversible until canonical merge; disconfirmers = cloud delta given precedence, f69 moving, or a 0.16.0 tag/deploy appearing → retract/rebind.
- oddkit_gate planning→execution: invocation 1 mis-detected as exploration→planning (NOT_READY 1/5, wording "prepare"); invocation 2 PASS 4/4, knowledge_base.

## Canonical amendment
- Branch `release/0.16.0-corrected-source-20260922` from cookbook main 20d51447 (readback identical).
- Commit **a5abe0c7b3d03cf76fd451f030e40aceefc15508**, parent 20d51447, author/committer klappy no-reply.
- PR **klappy/3d-review-cookbook#103** https://github.com/klappy/3d-review-cookbook/pull/103 (head a5abe0c7 → main, non-draft, assigned klappy, no review requested).

| path | git blob | sha256 |
|---|---|---|
| planning/2026-09-16-parity-build/releases/0.16.0.md | 651e97ac291417bb364b91bc6505d40288712475 | d16c0aa5223963572732db7588a9b09ce3a144315fe642de92e8f48e11119bea |
| planning/2026-09-16-parity-build/releases/releases.json | 4b6c03e0867a7a541b4c2de156f7bfc58f3d06d3 | 7d5c98da351eca19c95babb79fb37a1e87961ba36c34fcc2da27670365e3a9bb |

Content of the amendment (factual, reviewer-attributed): intro names f69 as corrected functional candidate at the same version; Changed adds the corrected-source evidence sentence (100 affected/anchor tests, 10 parent failures, 26 headless Chrome journeys at 390×900/1440×900); Fixed adds the three finding fixes in operational language; new "Corrected source" subsection under Exact source and evidence (findings, provenance commits b918faa6/f52fce62, f69 tree/paths/parent, PR175, selection order, source ACCEPT 9afafa33 counts, browser ACCEPT f63a495c cases and SHA256s, plan ACCEPT 0fb0010f); scorecard row for the corrected-source reviewer journeys; delivery state updated. Historical c9bf subsection and its counts retained verbatim. releases.json: only the 0.16.0 entry's `sections` changed (mirrors the markdown bullets verbatim, as the app's version-stamp test requires); `current` 0.16.0 and all 32 other entries byte-preserved. No tag/date/released; no DEV/production claim.

## Next (only after immutable canonical merge AND explicit coordinator authority naming the final source head)
Separate app branch from the finally selected corrected head (f69 unless the lineage comparison selects otherwise): byte-copy both records from the merged commit, manifest cookbook_commit + two blob/sha256 records to the amended pin, package/lock stay 0.16.0, version-stamp test literals only if a path/literal changed (expected: none), `npm run stamp` + version-stamp suite + typecheck, diff proof vs the selected head = exactly the metadata paths, PR. Remaining gates unchanged: independent factual review of PR103 + checks; final lineage comparison; exact-head Bugbot SUCCESS + attached checks on the app candidate; issue14/cargo hold disposition; DEV observation; separate production PR with configuration evidence.

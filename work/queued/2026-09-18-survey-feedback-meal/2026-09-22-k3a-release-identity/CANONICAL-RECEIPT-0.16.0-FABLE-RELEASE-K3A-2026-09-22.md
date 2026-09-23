# CANONICAL RECEIPT — 0.16.0 candidate record (Fable release worker, K3a)
Observed clock (oddkit_time): FIRE read 15:42:04Z; branch created and read back 15:42Z (actual START); commit + PR 15:44Z; this receipt 15:44:20Z. FIRE: kitchen 5ea6deb0e17c345036c0ad0f2b63aa4a0220be16. Canonical slice delivered inside the first 30-minute increment. NOT merged; NOT a release.

## Refreshed collision state at START (15:42Z)
cookbook main ac10348b80558dc9e657dda91c9226166828a673; no `release/0.16*` head; 0 remote tags; 20 open PRs, none 0.16; releases.json `current` 0.14.5, no 0.16.0 entry. App PR171 head still c9bf2b1e0ad3e9ae1d679cb286959a5b21bab822 (open, draft).

## Canonical branch / PR
- Branch `release/0.16.0-kit-root-20260922` from ac10348b (API ref create, readback identical).
- Commit **5a40b92d0f420cd3d6a580fc21d101ca7d14cf1a**, tree 79bcd48ec66d9d676231166a11b24b59db47dfa5, parent ac10348b, author/committer klappy no-reply.
- PR **klappy/3d-review-cookbook#102** https://github.com/klappy/3d-review-cookbook/pull/102 (head 5a40b92d → main, non-draft, assigned klappy, no review requested). Opened with existing GitAuth `pull_requests:write` scoped to the named repo.

## Exact two files
| path | git blob | sha256 |
|---|---|---|
| planning/2026-09-16-parity-build/releases/0.16.0.md | a0f0173c9ed6f2492c308e6abb3cce71b099efe5 | 9627aa8c4eb84333d8f93e52e9bf01d72df3d0ffc77c0440980aa168fd42197e |
| planning/2026-09-16-parity-build/releases/releases.json | 5e64407771fb8360af4ff1f279d95a9581b1958e | 7081441b22a824d399dfe7c65d76fb4459e6d3625d8b04c207f93853ec030e35 |
Blob ids recomputed locally match GitHub. releases.json: 0.16.0 candidate prepended, `current` 0.16.0; prior 32 entries byte-preserved (base re-serialization equals original bytes; diff removes only the old `current` line). No tag/date/released. No other paths touched.

## Evidence used in the record (read fresh at c9bf, this worker)
`node --test test/kit-root.integration.test.mjs` 15/15; `node --test ui/kit/app-adapter.test.mjs ui/assess/scope.test.mjs ui/assess/identity-reset.test.mjs ui/kit/shell.test.mjs` 71/71; delta main 9f2e4b44→c9bf = 22 files +1402/−30 (listed in worker-release-k3a/evidence/). Independent ACCEPT kitchen 83d605cf (15 root tests, 26 module hashes, 25/25 hit+click, five viewports) cited as reviewer-attributed. No repository-wide count, no 435 relabel, no rollout claim.

## Next action / remaining gates
Awaiting independent review of PR102 and its checks; coordinator merges. Then, and only on the observed immutable merged commit (not inferred from elapsed time): app branch `release/k3a-0.16.0-20260922` from exact c9bf with the six ticket paths, stamp/version-stamp/typecheck output, six-path diff proof, PR to main. Forecast one 30-minute increment after merge observed. 15:48Z production target: not achievable by this chain (canonical review, app pin, DEV, production gates all ahead); variance recorded, not skipped. Production configuration evidence and issue14/cargo disposition remain unowned by me.

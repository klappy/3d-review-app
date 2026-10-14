# Participant report admission candidate

Default behavior is unchanged: DEV admits participant-only captures; production and unknown environments hold them. This candidate does not set any Worker variable or change deployment configuration.

After explicit disclosure-policy approval and normal release validation, an operator can opt production into the existing report path with `PARTICIPANT_REPORTS=enabled`. Only that exact value with `ENVIRONMENT=production` enables it. Removing the value holds future builds and reads again; it cannot retract reports already seen or copied.

The existing assessment-wide minimum of five responses, refusal of mixed pinned fixtures/participant captures, exact assessment grants, preview/confirmation, immutable snapshots and source-derived scoring are retained. The three-response per-perspective minimum controls overview bands only. Full reports can contain smaller-group aggregates; five and three are existing working defaults, not a validated privacy guarantee. Production activation must explicitly accept this disclosure shape or wait for a separately reviewed suppression policy.

Raw response lists, demographic breakdowns and row-level exports remain held. No new scoring formula or global quality average is introduced. The release still needs independent code/security review, canonical version pins, required checks and exact-source deployment evidence.

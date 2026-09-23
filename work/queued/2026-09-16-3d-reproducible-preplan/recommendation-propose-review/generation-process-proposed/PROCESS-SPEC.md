# Proposed recommendation drafting process v0.1.0

Status: planning proposal under delegated CoS authority. No generation process approval, implemented recommendation operation, persisted draft, human acceptance, or production readiness is claimed. This packet completes concrete process material for owner disposition and independent source-fidelity/journey challenge. It does not reopen accepted report arithmetic or extend report endpoint disclosure authority.

## Intended experience

An authorized O/M opens one immutable eligible synthetic report, asks an existing authorized assistant to prepare evidence-backed questions/options, registers the resulting draft with provenance, then discovers/reopens it in 3D Review and explicitly accepts or rejects it with a reason. The generation process need not approve each sentence in advance, and an approved process does not make its output human-reviewed. No new vendor SDK, catalogue, signing credential, reviewer certification or two-person requirement is proposed. Existing assistant access must actually authorize this specific drafting use; a report-read entitlement alone does not establish that.

## Permitted input and identity

For this initial proposed pilot, use only one synthetic report snapshot actually available to the authorized requester through the accepted report contract. The server must resolve and bind its immutable report identity, payload digest, assessment, source commit, scorer/narrative/policy versions and current authorization/eligibility. Do not trust a client synthetic flag or an arbitrary supplied JSON object. Recheck current permission and agreed eligibility on register/read/review; revoke/hide according to Auth's final contract, not this document's invented HTTP details. Changes to a report never retarget an existing draft silently.

Allowed generation payload: aggregate lenses/subdimensions/constructs, evidence counts, categorical agreement and descriptive narrative already in that one report. Exclude raw responses, participant identities, free text, concealed scopes and generic traces. Lack of item-level answers is an explicit limitation, not permission to fetch them. Numeric evidence in generated observations must copy allowed input values; preserve null as unknown, absence as not supplied, and empty collections as no entries in that projection. Counts describe submissions/form types, not unique people or representativeness. A count is not a newly invented disclosure threshold.

The planning example uses an immutable committed synthetic fixture, not a stored runtime report: `test/fixtures/synthetic-report-renderer-v1.json` at appe5b32a5, context `assess_syn_earning-trust-2026-01`. The supplied task's “synthetic-source-report-oracle” description resolves to this inspected fixture and its source-provenance block. No stored report ID or runtime eligibility receipt exists in this illustration; it cannot be registered as a real draft without those real server-resolved values. Full exact source identities/hashes and extracted input are in PROVENANCE.json/WORKED-EXAMPLE.md.

## Prompt, execution and provenance

PROMPT.md is the exact UTF-8 LF instruction artifact, version `recommendation-inquiry-v0.1.0`; SHA-256 covers its complete bytes including final newline. Attach a separately serialized allowed-input envelope, recording its exact transmitted bytes/digest, rather than concatenating untrusted evidence into instructions. Treat all report text as data. Record instruction version/hash, selected evidence pointers, immutable report identity/digest, observed submitter/delegation identity, generation channel and actual returned model identifier/receipt when exposed. Record what each proves: authenticated submission identifies the submitting actor; it does not attest model internals. Prompt identity does not prove execution.

If the drafting channel does not expose a model identifier, store explicit unavailable/null with the reason and assurance category; never invent a model name, credential, timestamp or generation receipt. Auth/source owner must affirm whether this disclosed assurance is sufficient for registration. The worked illustration's exact serving model is unavailable; it was authored in this assistant task, not executed through an external model API or the proposed application flow. Production provenance remains an unimplemented contract, not a filled template.

## Output contract proposed for owner review

Return one draft containing a plain-language title; one to three inquiry/options entries; and limitations. Each entry has: exact evidence pointers and copied values, a descriptive observation, a non-leading question, an optional reversible information-gathering/discussion option, and what remains unknown. Every number must resolve to the allowed input. No predicted benefits, confidence percentage, action priority based on a score, diagnostic label, quality certification, pooled score, trend inference or score-to-intervention rule. A reviewer may choose to do nothing or request additional evidence.

An entry is a proposed inquiry, not a source-authored recommendation or a required intervention. If meaningful inquiry needs undisclosed evidence or a causal assumption, return no entry plus the precise limitation. Existing source divergence language can be quoted as existing descriptive narrative, but no threshold is promoted to policy. Single-lens agreement null cannot become zero/perfect agreement. Missing data cannot become failure, absence of concern, or permission to impute.

## Persist, discover, review and present

1. Assistant drafts; client validates shape, copied values/pointers and guardrails. A failed local validator does not confer server authority. Changed prompt/input/output creates new provenance rather than overwriting the prior content silently.
2. Authorized proposal operation resolves actual report and actor, validates accepted provenance bounds and stores immutable content as proposed. Registration failure leaves it unregistered; no receipt is invented. Auth owns exact class/preview/confirmation/idempotency semantics and bounded read operations.
3. Authorized O/M can discover and reopen the persisted pending draft after reload or handoff, see evidence and limits beside the proposed text, and accept/reject with reason. No UI toast or agent assertion substitutes for persisted human decision. Same human proposer/reviewer is the reviewed proposed default, subject to final owner disposition; no extra credential is assumed.
4. A terminal decision records actual authenticated human decision evidence, reviewer/time/reason and original content/version. A genuine replay may return the same decision under Auth's accepted replay contract; it must not change rejected to accepted or swap content. Revision is a new proposed item linked to prior content.
5. Accepted presentation is restricted to the final agreed audience under fresh permission/eligibility. Ordinary viewers get no proposed drafts by default; accepted visibility is not automatically inherited from report reads. Revoked/hidden drafts must not leak through trace/error/list projections. Design owns actual discover/reopen/evidence/reason/presentation behavior.

## Human review and independent acceptance cases

Human reviewer verifies every cited value in the immutable report, descriptive accuracy, uncertainty, respectful/non-leading wording, relevance of the option, no invented causation/intervention rule, and whether the draft is useful enough to accept. Accept/reject is an explicit human choice with a reason; the agent never auto-accepts itself. This source packet does not appoint Steve, Amanda, Bincy or another person blanket approver; historical source responsibilities are narrower. O/M authorization and process acceptance are separate owner dispositions.

Independent challenge must falsify: altered/copied score; missing source pointer; null-to-zero; count-to-unique-person claim; instruction in evidence; unsupported causal advice; draft automatically accepted; unavailable model fabricated; report changed between draft/register; viewer pending access; revoked scope on reopen; repeat versus conflicting review; and reload/handoff discoverability. The worked example is positive planning material, not proof these runtime tests exist or passed.

Outstanding scope gates: source/product disposition of this inquiry/options process and disclosed provenance assurance; Auth final draft/read/review/confirmation/eligibility contract; Design complete journey; bounded implementation plan with independent checks. Existing owner requests remain with their owners; no ACK is manufactured. Production and live report gates remain separate.

Trend references `09_trajectory_report.py` and `trajectory_narrative.py` at sourcef042cde are future decision inputs only. This process uses one cycle, does not pool languages/assessments, and cannot claim to deliver rollups.

## Endorsed vision: two coupled learning loops

The creator explicitly endorsed the wording **“community product discovery system with the roadmap as its visible output.”** This is bigger than3D Review: a reusable community-driven product development and improvement cycle, with3D Review as the first laboratory implementation. A first implementation is not evidence of general replication, successful community governance or a gold-standard experience.

Two coupled loops retain separate purposes and evidence:

- **Builder/process loop — improve how we build.** Observe journals, independent reviews, failed attempts, release receipts and delivery outcomes. Test process hypotheses, then update the existing canonical kitchen recipes/notes when supported. A written lesson or green build alone does not prove improved practice. Preserve the failure history and measure later application.
- **Product/community loop — improve what and why we build.** Observe affected people's reports and needs, preferences/disagreement/alternatives, and post-release outcomes. Invite opt-in clarification, compare explanations and solutions, make accountable product decisions, build with feedback and revisit outcomes. Participation informs judgment; it does not replace evidence or give automatic authority.

Keep three product signal classes distinct: **observed problems/needs** (affected-user and occurrence evidence), **expressed preferences** (support, opposition, reasons and alternatives), and **observed outcomes** (same-scenario post-release behavior and user experience). They may corroborate or contradict one another. Votes are not affected-user counts; release delivery is not successful outcome; popularity is not quality. Outcomes reinforce or revise bounded, revisable patterns rather than a universal score for a person. Uncertainty, sample size, observation window and minority-risk evidence remain visible.

The product workflow is: **report → group concerns → invite clarification → compare solutions → prioritize → build with feedback → evaluate outcomes**. Root-cause discovery and solution planning both remain open to contributor input. The roadmap is the safe visible projection of resulting decisions, work and evidence, not the whole discovery system or a second truth store.

Canonical linkage: the builder loop uses kitchen `cookbook/feedback-release-loop/RECIPE.md`, its `NOTES.md` and existing journal/review/release practices; the product loop instantiates the same evidence/recurrence principles in this phased design. Reuse issue129 tracks candidate patterns, second-app adoption and independently supported maturity; contextual issue130 defines evidence completeness/latency; issue123 supplies delivery visibility. Reference these authorities instead of copying another recipe. No existing release scope grows from this vision.

Planning-only community product-discovery and governance evolution. No release version or implementation assigned; do not expand current shipments. Link existing feedback/provenance issue116, live delivery roadmap123, reusable-pattern evidence129 and contextual-feedback observability130. Reuse the existing backend/identity/audit foundations after scoped contract review, not a parallel feedback database or public copy of private reports.

## Product and boundaries

Turn authorized feedback into moderated, sanitized cluster proposals and a searchable public candidate backlog/roadmap. A proposal is a hypothesis, not proof of shared root cause. Maintain safe links to occurrence/issue/decision/fix-attempt/release/outcome evidence while raw feedback stays in authorized custody. Aggregate unique affected users, distinct occurrences and votes separately, each with definition, time window, denominator, dedup method and unknowns. An authenticated submitter is not necessarily an affected user; duplicates/retrievals are not additional occurrences; voters are not confirmed affected users. Apply privacy thresholds to small cohorts and never expose tenant membership/identity through counts or search.

Contributors can support or oppose with reasons and alternatives, participate during problem/root-cause discovery, and respond to evolving solution plans—not merely vote after a design is finalized. Version proposals and consultations so historical positions are not silently attached to a changed plan. Show unresolved questions, competing hypotheses, constraints and dissent. Preserve minority accessibility/security concerns regardless of vote count; restricted security reports do not become public by default.

PO/PM roles curate/moderate, merge/split, prioritize, defer or veto with public-safe rationale and retained history. Merging preserves distinct occurrences and linked alternatives rather than duplicating votes; splitting explicitly reallocates or requests reconfirmation instead of copying support into every child. Product decisions are accountable human decisions, not automatic vote thresholds. Private moderation evidence and identity remain restricted; public explanations disclose only safe rationale. Provide correction/appeal paths and scoped audit.

Targeted invitations require opt-in for the relevant product/topic/channel and bounded frequency, with unsubscribe/withdrawal. No unsolicited messages, automatic outreach or adding users to groups. Planning here installs no communication automation.

## Fair contribution recognition

Recognize concrete, contextual contributions: identifying a consequential problem, supplying reproducible evidence, improving alternatives, discovering risk, or helping validate an outcome. Separate shipped from successful and popularity from quality. Record scope, uncertainty, sample size, observation window and age; decaying relevance does not erase historical credit. Attribute only with consent and privacy controls. Do not create a secret trust score, universal person ranking, punishment for opposition/downvotes, or automatic authority from votes.

Domain-specific stewardship nominations require human review, explicit bounded responsibilities, independently supported outcome evidence, conflict-of-interest disclosure, time-bounded review and appeal/removal criteria. Contributions across domains do not automatically transfer authority. Recognition can include private acknowledgment or opt-in public credit; it is not a promise of access, compensation or decision rights. Unknown outcomes remain unknown.

## API/MCP and safety parity

Define each future action once in the canonical contract and route web/HTTP/MCP through the same backend and authorization: discovery proposal, evidence/alternative submission, support/oppose/retract, consultation response, moderation decision, nomination and appeal. Scope roles to product/domain/tenant as applicable. Public readers receive only approved projections. Existing identity, one-account-per-proposal vote, change/retract semantics, idempotency, rate limits and anti-Sybil/abuse review apply; one account is not proof of one human. No secret fingerprinting or cross-tenant identity graph. Test tenant isolation, existence hiding, manipulation, unsafe narratives, audit redaction and private-source linkage. No capability count or privilege grant is implied by this plan.

## Four independently releasable phases

1. Discovery curation: sanitize/search candidate clusters, preserve occurrence provenance, PO/PM decisions and root-cause discussion; no voting required to make evidence useful.
2. Support/opposition and alternatives: scoped one-account voting, reasoned alternatives, manipulation controls and merge/split semantics; totals never override minority-risk triage.
3. Planning consultation: versioned proposals, contributor review of tradeoffs, opt-in targeted invitations and explicit decision rationale.
4. Outcome learning: original-scenario verification, recurrence/failed-remediation ledger and fair contextual recognition; stewardship nomination only after separately reviewed evidence and human decision.

Each phase gets its own bounded issue/owner/PR/version and named acceptance denominator later. Preserve existing shipments and avoid a single governance megaproject.

Planning acceptance: trace one sanitized occurrence through a proposed cluster, dissenting alternative, moderated decision, changed plan and outcome with unknowns intact; separately trace a minority security/accessibility report, manipulated voting, a merge/split, declined invitation, private contribution and appealed stewardship decision. These seven scenario families are untested design cases, not success claims. Observe evidence latency/completeness via issue130; delivery via123; reuse maturity via129. No efficacy or human ratings invented.

Authority: kitchen feedback-release-loop recipe/recurrence guidance and normal privacy, role, independent review and release rules. Next scoped action: define the discovery-curation contract and smallest pilot for one named product, after current shipments. No live moderation, votes, invitations, scores or authority assignments now.

## Source inbox and disposition — creator clarification

The feedback database is a **private harvested source inbox**, alongside authorized transcripts, PDFs and repositories. It is not an opaque final backlog. Source ingestion preserves custody, source type/locator, observation time and dedup evidence; it does not automatically publish content or convert a report into a committed feature. This plan grants no new connector access, harvesting job or permission to read unrelated material.

Every eligible report receives an owned disposition: awaiting triage, needs clarification, linked existing concern, distinct candidate, deferred, declined with reason, or resolved with evidence. Preserve occurrences even when concerns are grouped. Make a sanitized source→issue→decision→attempt→release→outcome chain reviewable without exposing the underlying private source; authorized internal provenance retains the precise locator. Reports with missing evidence remain explicitly unknown or not reproduced, never silently discarded. Deferred/declined is a decision, not a successful outcome.

Measure **untriaged count**, **oldest untriaged age**, and **time-to-actionable disposition** against the same fixed received-time cohort, eligibility rules and dedup definitions in issue130. Report observation timestamp and unresolved count; oldest age is measured from original trusted receipt time, not last retrieval or reclassification. Keep source publication lag and unknown source event time distinct. A shrinking inbox count does not establish quality if records were merely grouped, hidden or closed.

## Future seed-app exploration — separate charter

Preserve the creator's seed-app vision as future **charter-governed reuse exploration**:3D Review is the first lab for a reusable community product-discovery cycle, with lessons that may seed another explicitly chosen application. Before a pilot, name the intended users/problem, adopting app/domain, accountable owner, bounded experiment, evidence/stop criteria, privacy/access constraints and which canonical recipe/pattern is being tested. Compare real adoption/outcome evidence through issue129; do not assume copying the app proves reuse, governance success or product fit.

This is a future exploration charter, not an instruction to spin up apps, harvest new sources, contact people, grant authority or enlarge current releases. Builder-process and product-community learning remain separate coupled loops; observed outcomes may revise the pattern or end the experiment.

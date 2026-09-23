# Existing A1/C2 integrated shared-link sprint — bounded proposed plan

Status: PROPOSED / NOT FIRED. Home: existing A1 contract-freeze TICKET shared-survey finding; C2 is the consumer/acceptance pointer, not a new ticket. Coordinator: Otto planning /root/release_reconciliation. Actual planning ACK delivered to root with an eight-minute checkpoint estimate; original A1/C2 budgets are unchanged. Implementation owner/ACK/budget and independent plan acceptance are pending. No implementation was authored.

## Custody and source evidence

Fresh reads: existing A1/C2 tickets and their superseding no-account/no-login/no-mandatory-code rulings; independent reproduction14c5707674183; complete current14/31 comments; app10f5f444d68475d7114ab8fe0bf269fe106476b1 participant/survey/response/auth/policy/index/dispatch/types, initial schema, contract entries and participant/stage tests. Auth14c5708137944 confines current workers to19/20 security amendment2 and paired31 docs; root14c5708160246 preserves that scope. No active shared-link writer ACK appears in these Git returns. Root reports Auth separately asked for a planning thread; that is attributed coordination evidence, not an executor ACK. Recheck native/Git custody before assigning an author.

Confirmed baseline: issue_link hashes and discards the raw token; send_links remains501; all opens of one invitation share invitee_<id>; second respondent is refused and can receive the first person's duplicate response ID using the same key. Response uniqueness is only (survey,idempotency_key); participant sessions have no invitation association. Therefore fresh IDs alone do not resolve lifetime/retry/revocation semantics.

## Chosen semantics for contract-owner acceptance

1. A staff owner/member at the exact assessment may create one reusable survey link, without recipient roster, account or batch. It is bound to a selected survey/template/assessment; selecting never opens collection. Link expiry is optional explicit future ISO timestamp; absent means no link expiry, preserving existing invitation policy. New internal participant sessions retain current12hour maximum, capped by link expiry.
2. Initial unauthenticated open with the link token creates a random internal respondent and survey-scoped participant session. Each independent client without a resume credential is a new respondent. This is a session boundary, NOT one-response-per-person enforcement. No fingerprints, IP identities or participant PII.
3. Client keeps its participant bearer and draft under that link's own sessionStorage key. A reload uses the saved bearer; it does not call a fresh open blindly. Optional resume_token on open is accepted only when live and bound to the same link; returns that same credential/context, never another respondent's receipt. Invalid or cross-link resume fails closed, not silently discarded. Storage loss starts a new context and cannot recover a prior private receipt without its credential. No server draft endpoint is added.
4. A valid session may submit once. Retry with its same key and normalized answers returns the same response identity; changing payload under the same key is INVALID_PARAMS; a different key after submission is STAGE_CONFLICT. Independent respondents may use the same client key without colliding. Concurrent calls produce one response, never multiple rows or a500 race. This is per-session append-only behavior, not a person-level duplicate policy or amendment policy.
5. Kiosk Next-person activation is deferred from this first sprint. Existing assisted_next continues its explicit STAGE_CONFLICT refusal. Independent browser contexts can each use the same shared link. No participant account, manual credentials or person uniqueness policy is introduced. Deferred kiosk behavior remains part of later full-app scope.
6. Revoke or link expiry rejects future opens, resume, form, new submit and backend receipt access for link-bound sessions; no response is deleted. Own already-committed exact submit retry is a read-only replay only while session/link authority remains valid, even if collection has since closed. Closed collection rejects new opens/form/new submissions; closing does not erase a submitted participant's own receipt. Assessment/survey archive also blocks new collection; ordinary receipt remains private to the valid original session. A read of another session's response is never allowed.
7. Attribution is server-derived: survey, assessment, selected template/version/perspective and link ID come from stored associations. Client cannot supply respondent/assessment/template identity. Preserve gold-source validation and historical fixtures. Do not add mandatory participant demographic identity fields.

### One narrow contract decision required before fire

Current issue_link is explicitly prepare-only, write.reversible, with true revoke inverse; returning a distributable access link is a disclosure and cannot honestly keep that old promise. **Recommended engineering disposition:** change this existing capability to write.effect/danger with dry_run→confirm→execute for staff creation/disclosure; execute returns raw link token once, link ID and API entry descriptor. Revoke is compensating, not unsending. No external email is sent; send_links remains separate and unimplemented rather than a prerequisite for copying a shared link. Staff confirmation creates no participant friction. A1/Auth contract owner must accept this precise disposition or supply a source-backed equivalent; do not silently change classes or require a new captain decision unless a real authority conflict is identified.

SUPERSEDED API-only boundary (retained as provenance; the integrated sprint below governs): A browser share URL needs C2's accepted entry route. Current app ui/app.js has only a #session staff entry, no survey-link bootstrapping. This backend order must not invent a working browser URL. Its output descriptor is the actual POST `/v2/participate/link` with token and documented future C2 handoff; browser click-through/copy-link acceptance remains a subsequent bounded C2 integration after the API and Design gates. This limitation is explicit, not full-flow completion. C2 owner must pin the entry URL/consumer contract before any result field claims a working link_url.

## Exact app authoring boundary

Isolated branch from freshly revalidated app10f5f444. Do not edit or push Auth19/20 branches. Chosen paths:

- `src/handlers/survey.ts`: chosen issue_link disclosure flow, validation and optional expiry; revoke association enforcement remains via shared helper. Do not modify code issuance/export/mail/grant behavior.
- `src/handlers/participant.ts`: link-bound new/open/resume issuance; legacy code redemption unchanged. Move reusable link/session checks into helper below.
- `src/handlers/response.ts`: shared-link lifetime gate, atomic submission/replay; preserve validators, private results/purge and legacy code session semantics.
- `src/handlers/shared-link.ts` (new): common invitation/session association checks, session issuer and normalized-answer digest/claim utilities. No auth middleware replacement.
- `migrations/0007_shared_link_context.sql` (new, number reserved only after root checks19/20/report heads): additive nullable invitation_id column on participant_session with invitation FK and index; new shared_response_claim keyed by(survey_id,respondent_id), containing client-key digest, normalized-payload digest, response_id. Legacy rows retain NULL association; no backfill, deletes or uniqueness constraint imposed on historical response rows. If0007 is taken, stop and amend before authoring, never overwrite another migration.
- `test/shared-link-flow.test.ts` (new): independent-client, closure/lifetime and attribution integration cases.
- `test/shared-link-concurrency.test.ts` (new): real isolatedD1 competing submissions, negative-control baseline.
- `contract/capabilities.json`, `contract/openapi.yaml`, `contract/contract-manifest.json`: only touched capability schemas/class/notes/inverses and pinned source metadata, under A1 custody and deterministic projection below.
- `tools/gen_contract.py` remains unchanged. The exact three contract artifacts are outputs of the canonical bounded projector below; their five changed capability definitions are fully specified in the companion. Root records this layer after the baseline generator; regeneration cannot overwrite it silently. Existing unrelated inferred paths stay explicit.

`src/auth.ts`, `src/index.ts`, `src/worker.ts`, `src/oauth.ts`, `src/dispatch.ts`, existing migrations0001–0006, rate-limiter bindings, package/lockfile and other handlers remain untouched. The integrated sprint adds only the separately claimed UI paths below. The shared handler helper joins stored participant_session by the authenticated respondent/survey; no change to Auth's principal resolution is necessary. If an actual implementation proves otherwise, return the exact hunk to Auth; do not widen this order.

Atomic submit: validate and canonicalize answers before computing digest. Namespace stored response.idempotency_key by the server respondent ID and client-key digest for shared sessions, leaving legacy storage untouched. Use one D1 transaction/batch: response INSERT…SELECT is conditional on the link still active/unexpired, session live, and selected survey/assessment collecting and unarchived; claim INSERT…SELECT is conditional on that generated response ID actually existing. If neither row is created, return the current lifetime/stage refusal, not success. This transaction contains response insert plus shared_response_claim insert; unique claim contention rolls the whole batch back. On constraint conflict, reread that respondent's claim and compare key/payload; return the winner or the documented conflict. Non-constraint storage failures must remain transient errors, never fabricated duplicate/success. Canonical response identity is response_id/submitted_at; generic transport receipt wrappers may differ and must not be described as byte-identical retries.

Next person: unchanged explicit refusal; no successor column, CAS operation, bearer transition, UI button or Next test belongs to this sprint.

## Paired cookbook correction

Existing plan branch only, isolated child branch; preserve Auth31 and Auditor29 accepted changes. Selected homes:

- `04-CAPABILITY-MATRIX.md`: only the five affected capability rows, explicit settled participant supersession and accepted class/undo decision.
- `prd/18-A-api-contracts.md` (actual pinned path verified in the nontruncated cookbook tree). Add concrete input/output/error/nullability semantics by reference to the companion below, not a generic schema claim.
- `prd/18-A-shared-link-contract.md` (new bounded companion): the normative semantics above, exact JSON schemas, migrationDDL, atomicity/normalization algorithm, source-provided generation timestamp and changed-path reconstruction map. Record accepted vs proposed status honestly.
- `PARTICIPANT-FLOW-2026-09-16.md` in Design's existing actual directory is a consumer pointer only, no writer transfer. Root routes the API contract to Design; this worker does not edit Design's file.

Actual `prd/18-A-api-contracts.md` and app `contract/contract-manifest.json` were verified in their pinned trees. Recipe includes exact selected app source/migration/test/generator output specifications and clean regeneration commands; a source supplement alone does not prove whole-repository rebuildability. No raw participant data/transcripts/secrets. Final exact app/cookbook heads paired in independent review receipts.

## Acceptance oracle and gates

Fresh independent reviewer, not author, runs new tests against baseline (must reproduce missing token + same respondent collision) and corrected candidate in isolated Miniflare/D1. No actual mail, remote database, provider or production writes.

- Staff issue dry-run writes no invitation; execute returns usable API token; unauthorized viewer/outsider cannot issue/revoke; token stored only hashed. Expired/invalid expiry rejected before write.
- ClientsA/B same link, no accounts/codes: distinct respondent IDs; each valid source response succeeds; counts2 and correct survey/template attribution. Same client idempotency string does not collide. A's token or saved draft never accesses B's response, nor another link's.
- Reload/resume returns same context/receipt; missing storage creates new context without claiming person recognition. Cross-link/forged/expired/revoked resume fails. No unauthenticated receipt lookup by responseID or link token alone.
- Eight simultaneous same-session/same-key submits -> one response, stable response identity. Changed same-key payload conflicts; differing keys race -> one winner, no500. Injected non-constraintD1 failure returns retryable failure, zero partial rows.
- Existing assisted_next continues explicit refusal; two independently opened browser contexts each submit successfully without manually provisioned credentials.
- Prepare/closed/understand/archive reject new collection; closure between form and submit rejects insert; exact successful retry after closure gives own prior response only; revoke/expiry invalidates authority, rows remain intact. Competing revoke/submit ordering must have an explicit linearization test: insert condition in the transaction rechecks active link/collection, so a completed revoke cannot be followed by a successful new insert.
- HTTP anonymous link entry works without OAuth; authenticated MCP can exercise same handler through correct tool after Auth integration. Do not require anonymous MCP once its authenticated wrapper lands. Recheck both faces on the eventual integrated candidate; no claim localbaseline tests prove finalAuth compatibility.
- Source-required/multi/exclusion validation unchanged; the integrated browser oracle below is additionally required. Reviewer verifies exact diff/owner boundaries, migration additive-only and deterministic paired artifact reconstruction. Run typecheck/full relevant suite and exact-current-head BugbotSUCCESS plus all checks; fresh independent final review required after any accepted Auth-base integration.

SUPERSEDED API-only completion boundary: Done for this bounded backend correction is independently accepted API/context behavior and paired source, not browser/fullapp/deployment acceptance. Current missing pre-fire inputs are narrow: contract-owner class/disclosure disposition and custody ACK; fresh migration-number reservation; fully materialized companion/reconstruction specification; independent plan challenge/review and actual worker budget. No new backlog or provider fire follows from this planning return.


## Governing amendment: accepted per-sprint integration, 01:00 ET target

Chris accepted per-sprint API and Design gates. This sprint must demonstrate **staff setup → select survey → explicitly open collection → create/copy a reusable link → two independent anonymous respondents submit → staff counts increase by two**. API-only cargo does not complete it. Full-product acceptance, reports, deployment/provider cutover and A8 remain distinct. Deadline is a target, not an unsupported delivery promise. The implementation owner must actually ACK a remaining 30–45 minute slice estimate; review, integration and checks require elapsed time beyond authoring. Original budgets are not reset.

### Exact migration reservation and integration boundary

Read-only inventory of all open PR heads found only migrations0001–0004 except Auth20 head `4b3d7cce34654baba79dea438ecec76ab7bd1dee` adds0006. Auth19 head `49b23956a68810155ee658031aaba37745657440` adds no migration. Report baseline `d605d9391236e6cba28146efde089ff41bff439a` has0001–0005; its recursive tree is nontruncated. Reserve **`migrations/0007_shared_link_context.sql`** through the existing A1/C2 ticket and obtain Auth owner acknowledgment before authoring. This evidence establishes availability, not an already-landed reservation. Apply0007 after the eventually accepted0005/0006 on integrated test databases; also prove this additive migration on the10f5 baseline without pretending that proves the integrated Auth candidate. Do not copy/rewrite0005/0006 or silently renumber.

API implementation starts from10f5 on its own branch. UI implementation consumes that exact API candidate branch in an isolated child branch with separate UI-only claim; it cannot edit API files. Final integration rebases/cherry-picks the accepted slice onto the actually accepted security/report base, resolves only owned hunks, then reruns relevant tests and independent review. Root establishes integration order; no merge toDEV or production is implied here.

### Browser contract and exact C2 scope

Selected route for C2 Design/contract acceptance is same-origin **`/#survey=<URL-encoded opaque link token>`**. Staff issue execute returns `link_token`, `link_id`, `expires_at` (nullable), and `entry_fragment` (`#survey=` plus encoded token). UI constructs the absolute share URL from the current origin plus `/` plus this fragment, displays it after confirmed issue, and supports explicit Copy link. No email, participant batch or automatic external navigation. Creation is enabled only for an existing selected survey; collection state is shown and opening collection remains an explicit staff action. UI never claims that selecting a survey opened collection.

On participant entry, parse only this fragment shape, reject an empty token, and use a dedicated fetch with `credentials: 'omit'` and no staff Authorization header to POST `/v2/participate/link` with `{token, resume_token?}`. The fragment remains client-side; do not put token into server URL/query, analytics, event log, error text or persistent localStorage. A SHA256 digest of the link token is the storage namespace. Store bearer, draft and submit key only in sessionStorage under `shared:<digest>:`; ignore old global participantToken/responseKey for this mode. Independent browser contexts have independent storage. Same-tab reopen/reload resumes. Storage loss or a new context creates a new respondent; never claim person uniqueness. Browser duplication can copy sessionStorage and thus resume the same respondent; this limitation must be documented, not treated as an identity guarantee.

Successful open hides staff setup/code entry for this participant mode and loads the existing source-generated form. Preserve exact template item IDs, required rules, option/exclusion semantics and review-before-submit. Scoped draft save/restore uses only known item IDs and the exact form template/version; mismatched draft is rejected visibly. Empty draft is not a submitted response. Receipt resume is checked before showing an editable form; submitted context shows its own stable response identity. Clear only that context's draft after confirmed success. A failed/transient submission retains draft and submit key. Revoke/expiry closes participant actions with a clear unavailable-link state; closed collection shows closed and allows only valid own receipt/replay. Do not reveal staff/internal IDs as participant instructions.

Kiosk Next-person remains deferred with existing explicit API refusal; no button or successor state is added. Staff status uses the existing survey status endpoint and a Refresh counts action; two completed independent responses must appear as count+2 without exposing their answers.

C2 app paths are exactly `ui/index.html`, `ui/app.js`, new `ui/shared-link.js`, and new `test/shared-link-browser.test.ts`. Reuse existing stylesheet/form rendering and participant-resume helper without changing their files; no visual redesign or report/print expansion. Design owner must accept the sprint's entry/create/copy/form/review/receipt/unavailable/count states against its existing source before C2 implementation fire. An exact hunk conflict with a currently active Design writer stops that hunk for owner reconciliation. No rewriting Auth UI beyond the link-specific staff control and fragment dispatch.

### Deterministic paired cookbook specification

All canonical paths below are under cookbook `planning/2026-09-16-parity-build/`:

1. Update existing `04-CAPABILITY-MATRIX.md` and `prd/18-A-api-contracts.md`; add `prd/18-A-shared-link-contract.md` with the selected fields/errors, validity state table, SQL DDL, atomicity algorithm and browser/storage semantics. This is normative maintained source, reviewed before projection.
2. Add `operations/shared-link-source.json`, a canonical UTF-8/LF full-content projection manifest authored in cookbook first. It records app baseline10f5, the exact output path allowlist below, each existing baseline SHA256 (or explicit absent), each desired complete content string and SHA256, and a fixed declared contract generation timestamp. No clock-generated metadata and no recursive final app/cookbook commit pins. Independent final receipts carry paired heads.
3. Add `operations/render_shared_link.py`, Python3.11.2 standard-library-only CLI. `render --source PATH --output EMPTY_DIR` validates all paths/hashes and writes exactly the allowlisted files into an empty output directory. `verify --source PATH --baseline BASELINE_DIR --app APP_DIR` validates the declared baseline file hashes/absence against a separate read-only baseline checkout, then byte-compares candidate outputs without mutation. Reject duplicate/extra/missing/absolute/traversing paths, NULs, bad hashes, non-LF/nonterminated source and nonempty render destination. No network/subprocess/clock/Git/provider calls. This explicit bounded source projection neither replaces full-repository rebuild evidence nor claims unrelated baseline source is reconstructable.
4. Add `operations/shared-link-reconstruction.md` containing the commands below, baseline Git/input hash manifest and integration override rule. Existing full-repository reconstruction runs first; this bounded canonical layer follows the existing generic contract generator so its exact schemas cannot be erased. Independent review verifies that changed code/schema content originated in canonical cookbook source, not an after-the-fact mirror of app output.

Exact projected allowlist (14 files): `src/handlers/survey.ts`, `src/handlers/participant.ts`, `src/handlers/response.ts`, `src/handlers/shared-link.ts`, `migrations/0007_shared_link_context.sql`, `test/shared-link-flow.test.ts`, `test/shared-link-concurrency.test.ts`, `contract/capabilities.json`, `contract/openapi.yaml`, `contract/contract-manifest.json`, `ui/index.html`, `ui/app.js`, `ui/shared-link.js`, and `test/shared-link-browser.test.ts`. Treat this explicit14-file set as authoritative; API and C2 owners contribute disjoint portions to the same canonical source manifest through sequential custody, not concurrent edits. No changes to package/lockfile or generic generator.

Pinned reconstruction command contract (reviewer substitutes absolute checkout directories only):

```sh
python3 --version
python3 COOKBOOK/planning/2026-09-16-parity-build/operations/render_shared_link.py render --source COOKBOOK/planning/2026-09-16-parity-build/operations/shared-link-source.json --output EMPTY_OUTPUT
python3 COOKBOOK/planning/2026-09-16-parity-build/operations/render_shared_link.py verify --source COOKBOOK/planning/2026-09-16-parity-build/operations/shared-link-source.json --baseline BASELINE --app APP
```

Require Python3.11.2 for recorded reconstruction. Author/reviewer use existing locked app toolchain; record actual Node/npm/lock hash and invoke existing `npm run typecheck` and `npm test` without dependency updates. Existing Auth runtime evidence is Node22.22.2; do not assert availability until probed. Browser oracle uses existing Playwright1.56.1 Chromium141.0.7390.37 if the existing test environment supplies it; its exact executable/version is a required worker ACK, not permission to add unbounded packages. If that pinned environment is unavailable, return a specific environment amendment before claiming browser proof.

### Integrated sprint acceptance (source-backed, no report audit duplication)

1. Existing source baseline must reproduce the known two-client collision and discarded token. Corrected candidate: authorized staff sets up project/language/assessment, selects an existing pinned template survey, explicitly starts collection, dry-runs/confirms issue and copies the rendered URL. Unauthorized staff/anonymous cannot issue/revoke or read counts.
2. Two isolated browser contexts open the identical copied URL without any login/code UI, complete distinct valid gold-source answers, review and submit. Both receive different response identities; staff Refresh counts increases by2. Server attribution matches the selected assessment/survey/template. No participant answer/receipt bleeds across contexts.
3. Same-tab refresh restores only its own valid draft or receipt; failed submit retains input; repeated submission is idempotent. Browser UI never sends a staff token/cookie on public open. Capture sanitized method/path/status evidence with token/answer values redacted.
4. Source-required, multi-select/exclusion, review/edit and invalid-answer cases still reject correctly in API and browser. Tests must demonstrate server validation; UI masking alone is insufficient.
5. Closed/revoked/expired link and close-between-form-and-submit refuse new response; earlier committed valid private receipt behavior follows the state table. Existing code flow and staff authentication controls still pass unchanged. Existing assisted_next continues its documented refusal, and independent new browser contexts remain able to use the shared link.
6. Reviewer reconstructs the14 changed outputs independently, compares exact bytes, applies additive migration in isolated D1, runs concurrency and browser oracles and reviews integrated Auth compatibility. Exact candidate checks and literal BugbotSUCCESS remain required; no self-certification and no provider mutation.

### Fire boundary and owner return

The plan is prepared for independent challenge, not accepted or fired. Root obtains A1 contract class/disclosure decision, Design sprint-state acceptance, migration reservation and API/UI file custody ACK. Actual implementation coordinator names the available writer and accepts/revises the 30–45minute remaining estimate from real capacity; elapsed planning is not erased. Independent reviewer issues ACCEPT or a bounded AMEND. Only then root may fire the existing ticket's implementation slice. A deadline alone does not waive these gates. No new user-owned task/backlog is required.

Revision receipt: root explicitly accepted deferring kiosk Next-person activation for this first slice. This revision removes successor schema/CAS/UI/tests; fourteen projected paths remain because shared helper, atomic submit and integrated browser tests are still required. The earlier landed proposed cargo remains history, not accepted implementation authority.


### Independent review amendment resolution

Auggie, independent of authorship, challenged this plan. The following corrections govern before fire:

- Schema/contract delta IDs are exactly `cap.survey.issue_link`, `cap.participant.open_link`, `cap.response.form`, `cap.response.submit`, and `cap.response.receipt`. Only issue_link changes write class/tier/inverse, pending A1 acceptance. Others retain classes while specifying concrete scoped inputs/outputs/lifetime/errors. `cap.response.assisted_next` remains unchanged and explicitly refused. Revoke behavior references the new association but does not change capability signature or class.
- Shared context invariant: exactly one participant_session row per fresh shared respondent and survey. Migration0007 adds a partial UNIQUE index on `(assessment_survey_id, respondent_id) WHERE invitation_id IS NOT NULL`, in addition to the invitation lookup index. Resume validates and returns the exact existing token; no token rotation/reissue creates additional rows. Shared helper rejects ambiguous cross-link or legacy/shared associations. Baseline Auth omits participant sessionTokenHash; this invariant allows exact respondent/survey association without modifying Auth files. The transaction rechecks that sole row's live expiry/revocation and link association. If the invariant cannot be met, stop and route a narrow Auth-owned change; do not widen silently.
- Every shared-mode form/submit/recover/reset storage operation must use a single namespaced storage adapter, including existing event handlers that currently write global participantToken/responseKey. Legacy mode retains existing keys; shared mode neither reads nor writes them. All shared participation fetches use credentials omit, with only the selected participant bearer after initial open. Test prepopulated stale globals, failed submit followed by reload, and cross-link context switch: global credentials/drafts/keys can never override the shared context.
- A10f5 full-content manifest is valid only against its declared10f5 baseline. Before integrated candidate authoring, re-pin every baseline hash to the actually accepted integration base, preserve other owners' accepted hunks, update canonical content first, regenerate all14 outputs, and repeat independent review/byte comparison. Reviewer independently proves BASELINE checkout Git identity; projector verify uses --baseline BASELINE to validate declared per-path baseline hashes/absence without invoking Git. Projector verify must reject a manifest/base mismatch and cannot silently overwrite newer Auth/UI/contract changes. Root serializes canonical-manifest custody. Independent receipts carry the selected integration base and resulting app/cookbook pair.

These amendments change planning only. Actual owner acceptance, migration reservation, browser/runtime ACK and implementation budget remain pending, with no fabricated PASS.


Exact selected migration DDL (planning source, not executed):

```sql
ALTER TABLE participant_session ADD COLUMN invitation_id TEXT REFERENCES invitation(id);
CREATE INDEX participant_session_invitation_idx ON participant_session(invitation_id);
CREATE UNIQUE INDEX participant_session_shared_respondent_uq
  ON participant_session(assessment_survey_id, respondent_id)
  WHERE invitation_id IS NOT NULL;
CREATE TABLE shared_response_claim (
  assessment_survey_id TEXT NOT NULL REFERENCES assessment_survey(id),
  respondent_id TEXT NOT NULL,
  client_key_digest TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  response_id TEXT NOT NULL UNIQUE REFERENCES response(id),
  PRIMARY KEY (assessment_survey_id, respondent_id)
);
```

The claim digest algorithm is SHA256 over the existing exported canonical serializer after existing server answer validation/normalization; object key order is irrelevant, array order remains significant as in the source serializer. No new implicit answer normalization or scoring behavior is introduced. The response storage key is `shared:` + server respondent ID + `:` + SHA256(client idempotency key), preventing cross-respondent collisions while keeping the existing response uniqueness constraint. The response INSERT and claim INSERT are one D1 atomic batch; no separate unprotected write may precede it. Constraint-conflict reread is permitted only after a batch rollback, never on an arbitrary storage error.

## Governing sequencing amendment — reconstruction after shipment

Chris explicitly authorized: “can we backport cookbook reconstruction to an audit and review of our journals and issues and prs and commits after we ship?” This is recorded in kitchen3f95096f, journalk0167 and cookbook13c5708285471/14c5708285686/16c5708285841. This amendment supersedes all earlier requirements that canonical full-content14-output manifest/projector, source-first content projection or independent whole/bounded reconstruction must precede this sprint's implementation or shipment.

**Remove from current sprint:** authoring `operations/shared-link-source.json`, `operations/render_shared_link.py`, `operations/shared-link-reconstruction.md`, full-content projection and its Python reconstruction proof. No separate projector worker is needed. Reconstruction remains mandatory post-shipment follow-through using preserved journals, issues, PRs and exact commits; it is neither canceled nor claimed complete.

**Retain before shipment:** essential contract/schema updates in the three app contract artifacts, current `04-CAPABILITY-MATRIX.md`, `prd/18-A-api-contracts.md` and bounded `prd/18-A-shared-link-contract.md`; additive0007 DDL/migration instructions; exact runtime/configuration limitations; relevant tests, independent review and exact-head check evidence; explicit integrated-base/commit provenance and release instructions. Current canonical documentation records semantics and decisions, not full-content source projection. App code remains authoritative implementation pending the later reconstruction audit. The14app paths remain the exact code/test/contract/UI scope; the deferred cookbook projection paths are not fire prerequisites. Do not opportunistically edit unrelated contracts or accepted Auth/docs cargo.

For later audit, preserve each authored/reviewed/integrated Git SHA, parent/base SHA, changed path manifest, migration inventory and test command/runtime/result receipts in existing PR/ticket custody. Root retains shared journal. Do not replace exact provenance with a mutable branch name. Any integration hunk conflict returns to its owner; final integrated tests/review still apply. No new security or validation waiver follows from reconstruction sequencing.

### Source-backed Auth ACK reconciliation

Directly read Auth14c5708270121 and correction5708271276. The owner accepts issue_link `write.effect`/`danger` dry_run→confirm→execute and exact `link_token`, `link_id`, nullable `expires_at`, `entry_fragment`; inverse none, revoke compensating. Send_links stays501 and is not a share prerequisite.0007 is reserved; no competing shared-link writer exists in that owner's scope. These are observed ACKs, not inferred acknowledgments.

Their earlier row enumeration includes assisted_next from superseded scope. The final five changed contract definitions remain exactly **cap.survey.issue_link, cap.participant.open_link, cap.response.form, cap.response.submit, cap.response.receipt**. Assisted_next is unchanged explicit refusal; no role/class/schema/UI activation. Form/receipt retain current capability classes, with concrete link-bound lifetime/schema semantics. Root routes this precise row-custody correction back to Auth; no previously accepted issue_link class decision is reopened. Before authoring contract rows, the API worker must receive that corrected custody readback or explicit root reconciliation under the existing A1 owner disposition.

Auth compatibility requirements now explicit: minted bearer is exactly `pt_` plus32 characters `[A-Za-z0-9_-]`, using existing randomToken("pt"); resume returns that same valid existing bearer. HTTP public open passes two existing IP limiter gates after PR19: credential-less HTTP60/min and link redemption60/min, so one workshop NAT cannot exceed60opens/min. Preserve these limits and429 behavior, document the operational limitation; do not weaken them to satisfy a load test. Participant HTTP is anonymous entry; authenticated MCP remains separately protected.

Protected Auth-owned paths additionally include `src/mcp.ts`, `src/ratelimit.ts`, `src/handlers/common.ts`, `src/handlers/types.ts`, `src/handlers/platform.ts`, `src/handlers/docs.ts`, along with auth/index/dispatch/worker/oauth already excluded. Necessary changes there return exact hunks to Auth. Shared-link helper remains the sole new helper home. Baseline tests apply0001–0004 plus0007; integrated tests apply the actual accepted0001–0007 by filename, including0005_report_snapshot and0006_oauth_code_redemption. Do not renumber or touch their migration contents.

### Actual budget and separate backend fire boundary

Available API worker `/root/queue_resolution/pr17_truthfulness_worker` actually ACKed availability and estimated45–60minutes for handlers/atomic migration/flow/concurrency tests, plus15–20minutes for the now-deferred full projection. Its60–80minute combined estimate is therefore superseded only by the45–60minute API estimate, pending reconfirmation that essential contract docs/checks fit. No30–45minute promise is invented. Independent final review and integrated browser proof require additional elapsed time.

A backend-only implementation fire may be a separately accepted bounded subslice after actual API worker ACK, corrected contract custody, accepted browser input/output contract and fresh applicable independent amendment review. It does not require the UI author to finish first. It cannot claim the sprint complete: Design state acceptance and actual C2 custody/budget remain necessary before UI implementation and integrated two-browser/count acceptance. Root establishes whether the browser contract is sufficiently settled for backend fire. No implementation is fired by this document itself.

Actual worker budget reconfirmation after reading this amendment:45–60minutes covers API handlers,0007,flow/concurrency tests and own typecheck/relevant-suite checks; essential five-capability app contract artifacts plus three cookbook semantic documents add10–15minutes. **Combined authoring/own-check estimate55–75minutes from FIRE, first checkpoint10minutes.** Independent review/Bugbot/integrated Auth/browser acceptance are additional. Worker ACKs conditional availability, no product edits. This supersedes any inference that45–60minutes covered all remaining essential documentation. Deadline feasibility is not established.

### Parallel C2 authoring amendment — remove avoidable API wait

Root read Design16c5708278629: required sprint states accepted, digest-scoped storage, no Next, source copy only; Design CoS requires an actual implementation worker rather than implementing itself. Root reports corrected five-row custody readback14c5708292130. These owner receipts close the corresponding planning returns subject to root's actual readback; they are not worker execution ACKs.

C2 need not wait for a completed API candidate to author disjoint UI code. Its actual worker creates an isolated branch from the same pinned baseline10f5, claiming only `ui/index.html`, `ui/app.js`, new `ui/shared-link.js`, new `test/shared-link-browser.test.ts`. Use exact accepted request/result/error fixtures for issue dry-run/confirm/execute, open/resume, form, submit, receipt and status; fixture schema must match A1 contract. Prepare staff copy-link, anonymous entry, scoped storage and all accepted UI states while the API worker owns its ten disjoint paths. No API/contract/migration/Auth edits by C2. No author claims the fixtures prove backend integration.

At the exact API candidate head, integrate the four UI files in the governed integration branch, preserve accepted Auth changes and run real HTTP/browser tests against the actual worker and isolated D1. Fixture-only UI tests remain identified as such and cannot satisfy two-browser/count+2 acceptance. Schema discrepancy is an owner reconciliation, not a silent frontend workaround. Design's earlier45–60minute UI estimate after API plus20–40review is its observed estimate; the parallel UI worker must independently ACK availability and its remaining estimate. Parallel authoring removes that initial dependency wait; it does not erase authoring/review time or make01:00credible.

### Necessary written fire gates — current disposition

- A1 issue_link class/disclosure and token fields: accepted via5708270121.0007 reservation: accepted same receipt and correction5708271276. Protected Auth paths/token shape/limiters remain binding.
- Final five-row custody with Next deferred: root reports corrected readback5708292130. Root's recorded reconciliation must accompany worker order; no resurrection of Next.
- Design/browser contract and states: accepted owner return5708278629 read by root. C2 real worker/custody/estimate is still pending; this is not required to hold an independently fireable API subslice.
- Independent planning acceptance: prior accepted plan plus fresh impact review of post-shipment reconstruction and parallel C2 amendments required. Actual Oddkit challenge remains CHALLENGED nonblocking, not PASS; driver-seat risks/retraction recorded. Local browser harness amendment independently accepted via testing reviewer as reported by root, with exact receipt attached to the eventual worker order.
- API worker: actual conditional ACK and55–75minute own-work estimate,10minute checkpoint. Root explicit FIRE must name that worker, exact plan revision/accepted contract, branch/base/path claim and return route. Only then authoring begins.
- C2 worker: root routes actual dispatch request for four-file parallel authoring from10f5 using contract fixtures, with actual ACK/estimate and explicit FIRE; no CoS impersonation.
- Before slice acceptance/shipment: real integrated API/Auth/browser/D1 evidence, essential contracts/docs/migration instructions, independent review, exact-current-head required checks/BugbotSUCCESS and applicable release authority. Cookbook reconstruction is deferred as authorized; production/provider action is not authorized by these fires.

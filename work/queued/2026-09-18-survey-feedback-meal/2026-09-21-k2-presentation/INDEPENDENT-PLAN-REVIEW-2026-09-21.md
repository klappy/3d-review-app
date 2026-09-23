# Independent K2 planning review — 2026-09-21

Verdict: AMEND two small specification gaps, then eligible for coordinator bind/FIRE gates. Do not reopen kit-first design or add a new planning framework. No source changes, implementation approval, worker assignment or merge.

Reviewed live TICKET.md blob0dc36fefed3f3307ab2be20d7426c9cd2c1ef793 (landed86d171d9c0758a4a8902c9405b5ca86d95bf8abc), DELTA217fc6b9ae373c8278d4f374cebbecccde8f5a9d and CHECKLIST018541bec44bcebda2d815bc934f790b5b7d10db, against independently accepted batch amendment4218b0 and its settled authority boundaries. ui_audit authored; orphan_audit independently reviewed.

## Accepted boundaries

Five-path write set is exclusive and includes precisely the authorized test exclusion; K1 shared styles/controllers remain outside custody. Pure explicit-model views and intent callbacks preserve authority, privacy and root isolation. Eighteen screen enums are enumerated correctly (7+9+2); five assessment variants and actual kit compositions are an appropriate bounded scope. Approved operational copy is scoped, marketing slots are not treated as approved text, participant receipt stays K4. Role-name privilege inference, mock admin authority, fake report/receipt state and implicit invitation totals are prohibited.

Meaningful tests target incorrect behavior rather than rendered string counts: scope invalidation, busy double action, role refusal, entered-value isolation, phase versus stage, mounted-slot retention, hostile text and actual asset exclusion. Browser evidence names representative desktop/phone cases; source-only screens must remain marked unrendered. No need for all-app retake or release/build work in this pure-view dish.

## Required specification amendments

1. Complete the state contract already demanded by acceptance. Model.common.status enumerates loading/ready/empty/unauthenticated/refused/notFound/notBuilt/error, but done-means requires held, uncertain and confirmed models; ticket also refers to preview/confirmation phase without specifying its field/allowed values. Name the minimal fields/enums and precedence (for example report eligibility and action state separate from resource load status), so two implementers do not invent incompatible booleans. State explicitly that refused/notFound or identity replacement clears sensitive rows/slots and takes precedence over previously confirmed receipt; uncertain disables duplicate action without claiming failure/cancellation; confirmed UI requires supplied confirmed outcome. This is a contract clarification, not new behavior.

2. Make the fifth assessment view and related intent exact. The ticket preserves four API phase ids but says model.phase selects Prepare/Collect/Understand/Improve/People. People is not one of those phase ids. Define a separate presentation view enum or explicit People discriminator, map the four existing phase values unchanged and name the browse intent. Opening People must not fabricate a fifth API stage, emit a stage write or assume an allowed mutation. Add one role-matched People-view/no-stage-write assertion. Keep existing Understanding display and API ids unchanged.

These two edits fit the existing ticket and owned coordinator test; no extra module, schema or backend work is required.

## Dependency correction and next step

K1 dependency must not be called accepted1b0ae83 at fire: fresh read still shows that head, but independently reproduced Bugbot IME search-composition defect means current disposition AMEND, with cloud correction pending. Existing instruction to pin actual accepted integration tree/interface is correct; carry the newer defect disposition explicitly and await stable reviewed correction + integration. No estimate or claim that cloud work completed.

Once the two contract clarifications land, narrow independent readback review is sufficient; no repeated audit or new comparison needed. Then actual implementation owner ACK/promise, complete checklist and formal current FIRE checks remain coordinator gates. Test harness uses synthetic data, no real cookies or live writes; retain deny-by-default unexpected request behavior from batch contract when constructing it. Final composed kit/root behavior and broad copy VERDICT remain separate.

No product code or source ownership changed. One fresh K1 status check performed; no polling loop.

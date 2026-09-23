# TICKET — separate 3D app-flow mock

## Current status — September 10 documentation closure

PR10's separate study and PR11's hosted delivery are complete. The last recorded live proof is September 9, 10:04–10:06 EDT; bounded desktop JavaScript passed. Physical iOS, full visual/persona review and captain acceptance remain unverified. See [LEARNING.md](LEARNING.md) for this learning review and [Claude handoff](../../meals/2026-09-08-3d-scenario-ux/CLAUDE-HANDOFF.md) for current follow-up scope. 

## Historical author and delivery checkpoints — preserved

Statements below such as pending checks, no hosting, or missing browser evidence describe their original phase. They are superseded by the dated live-delivery evidence, not current blockers.


**What this is:** A separate working mock of seven coherent app journeys around an assessment.
**Why now:** The captain wants the original glass revision and the actual app-flow study kept separate.
**Your move:** Open the working flow mock and steer it with later corrections.

Class: entrée. Risk: ALLERGY (private source consultation; synthetic output only).
Station: subagent.
Owner: Auggie accountable; bounded author and separate independent reviewer to be acknowledged before fire.
Promise: 15 minutes from actual author dispatch to working files or concrete progress checkpoint, burning across attempts.
Depends: 2026-09-08-3d-glass-welcome-fast-food (4-plated); 2026-09-08-3d-whiteboard-next-plan (4-plated).
Meal: 2026-09-08-3d-scenario-ux.

Outcome served: see Meal.
Learning signal: a reviewer recognizes the meeting's assessment-centered flow without a tour or debug control panel.

Ingredients:
- Full1842 utterance recovery of September8 Bee10379165/10381612, independently recovered by source-close owner; exact anchors below. Retained excerpts also at project PR5 commit9b44d5086e637b0645135a477b36a4448a570b73.
- Original glass visual family at PR4 cd1560458cf25dc1645bdd3b0dc171ea297bc1a0. This is the visual reference; rejected PR6 is not the interface baseline.
- Current captain correction: two separate deliverables. Glass feedback revision lives in PR9; this app-flow mock is separate.
- Prior art inspected: exact original static HTML/CSS and existing interaction structures. Reuse styling conventions, not the combined app's policy/control engine.

Source-grounded spine:
1. Direct assessment invitation:10381612/3339444964–4969,3339445287–5295.
2. Prepare in a chosen project with discoverable sample creation:10379165/3338788808–8835,3338790767–0769;10381612/3339445277–5284.
3. Collect predefined surveys with separate participant entry:10379165/3338790670–0698;10381612/3339444696–4703,3339445485–5488. Templates not authored in tool:3339445415–5424.
4. Switch assessment/project context above per-assessment phases, preserve different stages:10379165/3338788695–8738,3338790743–0763.
5. Four phases and restrained report viewing:10381612/3339444719–4728,3339445490–5491. Reporting beyond viewing is undefined.
6. Optional arbitrary workspace grouping:10381612/3339444746–4783,3339445015–5028.
7. Viewer sees output, cannot input/invite:10381612/3339444999–5004,3339445315–5319.

Declared product:
1. design/2026-09-09-app-flow/index.html
2. design/2026-09-09-app-flow/README.md
3. design/2026-09-09-app-flow/SOURCE-MAP.md
4. design/2026-09-09-app-flow/VALIDATION.md
5. design/2026-09-09-app-flow/INDEPENDENT-REVIEW.md

Scope:
One standalone working HTML artifact with restrained glass styling. Default view is an assessment. Use two fictional projects and two assessments at distinct phases; a restrained context side panel lists projects and assessments around the assessment view. Workspace navigation remains optional. This adopts the positively received side-panel proposal at 10379165/3338790743–0754, not a universal layout rule. Participant and viewer enter through distinct ordinary links. A scoped collaborator invitation opens only its invited assessment, without parent project/workspace selectors. At least two assessments under the same project must demonstrate switching to a past assessment at a different stage; a second sample project can remain empty. Optional workspace grouping is secondary. Preserve local state as user moves among the seven journeys.

Do not add tutorial/welcome material, global role/debug switchers, elaborate report approval/export/action engine, mandatory workspace onboarding, global admin, invented permission inheritance/deletion/cadence/scoring, or actual survey authoring. Unresolved creation authority10381612/3339445161–5187, inheritance3339444817–4963, removal3339445299–5309 and archive/delete3339445250–5253 belong in source notes as unresolved, not implemented as policy.

Done-means:
- An invited collaborator can open an assessment link and observe that assessment without mandatory workspace onboarding.
- A facilitator can choose a project or the clearly labeled sample-create path and observe assessment preparation in context.
- A facilitator can open predefined surveys and a participant can follow a separate link to submit an explicitly illustrative response.
- A reviewer can switch between two assessments at different stages and observe each one's retained context and state.
- A reviewer can use Prepare, Collect, Understand and Improve and observe a restrained report view with a clear return path.
- A user can optionally group accessible sample projects and observe that grouping does not create access to another project.
- A viewer can open a shared sample output and observe no data-entry or invitation controls.

## Failure Modes — What Breaks When Flow Study Becomes a Control Panel
- Scope blending: educational glass tour and app operations become one front door again.
- Policy invention: unanswered source questions become enforced rules.
- Broken story: route changes reset or contradict the assessment context.

## Required Response When Detected
- Scope blending: remove unrelated controls and keep this artifact separate from the glass welcome.
- Policy invention: remove the rule; name the unresolved point in source notes.
- Broken story: correct shared state and rerun the affected journey before claiming completion.

## Live preview delivery amendment — 2026-09-09 09:53 EDT

The captain explicitly requires both corrected artifacts at the existing HTTPS preview so their JavaScript can be exercised. Downloadable files and merged source did not complete that delivery. PR10 merged at 7d1b36b66c940e6e9f9735966b9fc9b336b2c79e; this ticket remains at pass until hosted validation finishes.

Auggie coordinates a bounded packaging leaf, independent implementation review by CoS, and Otto's existing Git-connected Worker trigger. Actual packaging leaf /root/preview_delivery/package_author acknowledged dispatch; initial working-package checkpoint is 10 minutes from this service's dispatch, not a new design budget. Publish only the reviewed synthetic welcome, glass HTML, glass.css, and separate app-flow HTML. Root serves the welcome; /3d-review-glass.html serves the glass mock; /app-flows/ serves the separate app study. Preserve source bytes and original relative-link aliases. No transcripts, source maps, meeting notes, old combined app, paid service or manual seat deploy.

Done means exact-head review and checks finish, main triggers the configured build, the deployment matches that Git commit, HTTPS routes serve expected bytes, and live JavaScript journeys are exercised. A merge or upload alone is not a plate. Existing synthetic-output authority covers this preview; production policy remains unratified.

### Initial-greeting steering — 2026-09-09 09:55 EDT

The captain clarified that the successful splash should remain an initial greeting that directs people to the other pages, not an information-heavy page. A minimal app-flow link alongside the existing sample-assessment link is authorized. This intentional welcome-only amendment is recorded separately from byte-preserved glass/CSS/app-flow assets; no dashboard or broader redesign is introduced.

Otto independently reviewed hosting build SHA256 2136a77cc4ea936c8f1314074c014faa29ef7c0aceb76f11f967889c95986f5e and reran 91 Worker request assertions. Existing Cloudflare trigger PATCH/GET succeeded at 13:55:00.336Z: branch main; paths showcase/* plus design/2026-09-09-glass-feedback/* and design/2026-09-09-app-flow/*; root showcase, node build.cjs and npx wrangler deploy unchanged. No seat deploy. Reversible prior trigger values were branch design/2026-09-08-scenario-ux and path showcase/*; prior runtime deployment 5acaa29e-4ead-441c-ae8d-f2d43afedb0c, version cefe95cd-b6f6-479e-8e72-e3f5685bfcef. Runtime rollback remains a reviewed Git revert and connected build, not manual upload.

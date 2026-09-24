> **Superseded 23 September 2026.** This is the pre-meeting draft. The current Claude Design brief is `design/2026-09-22-facilitator-first-candidate/HANDOFF.md` on the cookbook's design-system branch; the work is tracked at `rail/1-ordered/2026-09-23-3d-design-system-v3/TICKET.md`.

# Claude Design handoff — 3D Review v3 candidate

Status: PLANNING / DESIGN INPUT. Not implementation authority, not a release, not a replacement for the frozen v2 reference.

## Start here
Board through:
- https://github.com/klappy/kitchens/blob/main/boarding/RECIPE.md
- https://github.com/klappy/3d-review-cookbook/blob/main/AGENTS.md

Role: Design specialist. Produce the editable design-system candidate and interactive prototype. Do not take production implementation custody.

## Existing design authority
Repository: klappy/3d-review-cookbook
Design branch: design-system
- Foundations/source precedence: https://github.com/klappy/3d-review-cookbook/blob/design-system/design-system/README.md
- Tokens: https://github.com/klappy/3d-review-cookbook/blob/design-system/design-system/tokens.json
- Contract/version rules: https://github.com/klappy/3d-review-cookbook/blob/design-system/design-system/CONTRACT.md
- Frozen full-app reference, commit c653482135a18e6ca33cccc230b44855595f9dc2:
  https://github.com/klappy/3d-review-cookbook/blob/c653482135a18e6ca33cccc230b44855595f9dc2/design-system/ui_kits/3d-review/standalone.html
- Behavior source: https://github.com/klappy/bt-design-system-generative-glass
- Current delivery/adoption boundary:
  https://github.com/klappy/3d-review-cookbook/blob/main/planning/2026-09-22-design-system-delivery/DELIVERY-PLAN.md
- Submission/release-information contract:
  https://github.com/klappy/3d-review-cookbook/blob/design-system/design-system/RELEASE-IDENTITY.md

## Design decision to explore
Guide people through conducting a 3D Review. Make the assessment, its current state, the person's permitted actions, and the next useful step understandable without requiring them to learn the application's hierarchy.

Retain Prepare → Collect → Understand → Improve. This is a proposed change in emphasis/composition, not a new assessment methodology, permission model, backend, questionnaire, or product release.

## Inherit vs propose
- Brand: inherit approved 3D Review mark, green/ink palette, light/dark tokens. Propose lower visual density, not a rebrand.
- Journey: inherit Prepare/Collect/Understand/Improve; browsing a phase never mutates stage. Propose making current phase and next useful action dominant.
- Context: inherit workspace/project/assessment/survey scopes and permission-aware ancestors. Propose defaulting to useful assessment work while keeping context switching secondary and available.
- Creation: compose existing authorized operations into a guided path; do not invent authority.
- Perspectives: Translation team, Community, Church remain distinct. Preserve actual respondent-role/instrument mappings.
- Results: bands/evidence limits/suppression/human review; no designer-invented numeric quality scores.
- Participants: account-free shared-link journey plus supported code routes; preserve real submission/recovery semantics.
- Secondary surfaces: feedback, version/changelog, roadmap, invitations, print, codes, MCP remain supported unless separately dispositioned.

Do NOT carry forward invented password auth, unverified completion-time estimates, blanket confidentiality claims, editable demographic checklists without instrument authority, fabricated invitation totals, numeric quality ratings, invented survey questions, or unsupported publication actions.

## Proposed entry rules
1. Preserve a requested authorized destination, including legitimate return after sign-in.
2. With no requested destination and exactly one eligible assessment, enter it directly.
3. With multiple eligible assessments, show an assessment-oriented home with project context, state, and next action.
4. With no accessible assessment, explain the actual state; offer creation only if authorized.
5. Restore last-used destinations only after revalidating access; never expose inaccessible ancestors or neighboring scopes.

## Screen contracts
Home: show assessment name, authorized context, actual lifecycle state, response count when known, and permission-appropriate next action. Prefer specific labels such as Continue preparation, Share survey links, Explore results, Review next steps.

Prepare: use a short guided path within Prepare, suggested Details → Surveys → Review, validated against real fields. Create assessment, Save details, and Start collecting are different outcomes. Inline title editing must be accessible and have explicit save/cancel/result behavior.

Collect: stable perspective/survey cards with real title/version, known counts, permitted sharing/printing, and independent loading/error states. Copy participant link must never copy a workspace/admin URL. Denominators appear only when their meaning/source is explicit. Unknown is not zero; partial failure does not make a total complete.

Understand: keep perspectives separate. Show applicable band, evidence, limits, and details. Missing/suppressed evidence differs from a negative result. No 1–5 quality chart or composite score unless separately validated and authorized.

Improve: use existing reflection/next-step mechanisms. Show what is saved, its scope, and what remains draft. Do not invent automated recommendations, assignments, reminders, or schedules.

Participant: render actual instrument questions/options/order/role mappings/requiredness. Progress comes from the real questionnaire. Preserve answers and supported recovery. Submission distinguishes confirmed success, confirmed rejection, and uncertainty; network failure does not prove non-submission.

## Component contracts
Each component must document purpose, real data/permission inputs, permitted actions, states, keyboard behavior, responsive behavior, and acceptance evidence.
Required patterns:
- Assessment header
- Permission-aware context navigation
- Journey navigation
- Next-action panel
- Perspective/survey card
- Form section
- Survey question
- Share panel
- Evidence card
- Mutation receipt
- Feedback entry

## Visual foundations
Evolution, not rebrand. Consume existing token authority.
- Primary green: existing --green, light #14685f
- Main text: existing --ink, light #172e40
- Secondary: existing --secondary, light #526779
- Paper: existing --paper, light #f8fbff
- Preserve paired light/dark themes, existing radii, focus ring, reduced motion/transparency.
- Proposed: test 16px task-body default against inherited 15px before adoption; use solid readable surfaces for dense forms/reading where glass hurts clarity.
- Perspective color always paired with text; never color-only semantics.

## Acceptance scenarios
None below is currently evidence of implementation or human usability.

V3-01 — Direct link/sign-in: requested authorized destination preserved; unauthorized context not exposed.
V3-02 — One/several/no assessments: useful permitted next action; no arbitrary assessment chosen from a multi-assessment project.
V3-03 — Start assessment: guided path uses real operations/instrument; no manual hierarchy tour or invented fields.
V3-04 — Edit details/switch phases: truthful saved state; navigation alone never changes lifecycle.
V3-05 — Share survey/invite collaborator: correct destination and permission semantics; no workspace URL as participant link.
V3-06 — Collection progress with partial failures: sourced counts/denominators; unknown not zero; partial data labeled.
V3-07 — Participant questionnaire: correct instrument/options/role/requiredness; answers survive supported backward navigation.
V3-08 — Lost/failed submit: confirmed success differs from uncertainty; safe recovery preserves idempotency.
V3-09 — Sparse evidence: separate perspectives, no fabricated scores, suppression retained, human review respected.
V3-10 — Direct grantee/viewer/owner: only authorized scopes/actions visible; no grouping-based inheritance invented.
V3-11 — Phone/desktop: keyboard, focus, touch, theme, zoom/reflow and applicable language-layout evidence.
V3-12 — Secondary/legacy routes: feedback, version/changelog, roadmap, print, invitations, codes and MCP retain supported contracts.

## First review slice
Create a separate editable candidate. First demonstrate:
- coordinator entry → Prepare → Collect
- participant welcome → question → review → confirmed receipt
- participant uncertain submission
- direct-grant state
- no-access state
- partial-count failure
Use shared components, desktop/phone, light/dark, and labeled sample data.

Then cover Understand, Improve and retained secondary surfaces before calling the design complete.

Return:
1. editable design-system candidate,
2. connected prototype,
3. concise v2→v3 change map,
4. cookbook-ready adoption notes,
5. V3-01–V3-12 mapped to designed/demonstrated/untested evidence.

## Required Chris + Bincy source review
Before finalizing affected recommendations, review the September 22, 2026 Chris/Bincy Bee transcript. Preserve terminology and separate decisions, observations, proposals, and open questions with speaker + utterance/timestamp anchors.

Current planner status: exact meeting source has NOT yet been identified. Do not reconstruct it from descriptions or treat this handoff as a substitute. Private Bee archive starting point only:
https://github.com/klappy/refinery/tree/main/sources/bee/raw

Bincy's own mockup panels are also NOT in this ticket yet. Do not reconstruct them from prose. When their actual source is located, add/read the original artifacts and reconcile them against this candidate.

## Boundaries
The frozen kit remains the current comparison reference until governed adoption changes it. Do not modify product code, APIs, instruments, permissions, release manifests, active implementation ownership, or published design-system defaults. Do not publish or deploy. A prototype is not production behavior or human-usability evidence.

If a source is inaccessible, name the exact missing source and continue unaffected provisional design work without claiming it was reviewed.

# CLAIM — Fable K4 participant worker (second local Fable, under Auggie)
2026-09-22 (America/New_York; observed server_time 2026-09-22T15:22Z via oddkit_time). Status: OWNER CLAIM / READINESS ONLY / NOT FIRED. Order read: TICKET.md @ kitchen 599d33c4e76f2aff5a54e85ab99627e6874a809b.

## Authentic identity
- Surface: fresh Claude Cowork local session in the CoS project, task 07f7043c / worker b0aa7a04, distinct from the first Fable (K3a, staff/root/shared controllers). Model observed: claude-fable-5-1 (effort setting not observable; not claimed). Design skill: only generic `artifact-design` is installed; frozen kit c653482135a18e6ca33cccc230b44855595f9dc2 remains sole visual authority.
- Runtime observed: isolated Linux sandbox, node v22.23.2, npm 10.9.8, git 2.34.1. Only `/Users/chrisklapp/Documents/3d-review-fable` mounted. Own subfolder created: `worker-k4-participant/` (inputs/, evidence/). Existing sibling `app/` and `evidence/` belong to the first Fable and are NOT touched.
- Role: implementation cook under Auggie. Not CoS. Internal ui_audit/orphan remain planning/review only.

## Immutable inputs read (GitAuth klappy installation, contents:read, HTTP 200)
- 3d-review-app PR #171 open, draft=true, head design-batch/fable-k3a-20260922 @ c9bf2b1e0ad3e9ae1d679cb286959a5b21bab822, base main, not merged — build-only snapshot, no acceptance implied.
- Branch design-batch/k4-participant-20260922: ABSENT (404). Created only after FIRE.
- At c9bf2b1 read: ui/participate/page.js (6967 B), ui/participant-view.js (5575), ui/participant-view.test.mjs (3183), ui/participant-dom.test.mjs (5273), ui/participant-header.test.mjs (3669), ui/.assetsignore (957), plus read-only controller.js, controller.test.mjs, participant-resume.test.mjs. ui/kit/views-participant.js and ui/kit/participant-presentation.test.mjs ABSENT at base (new, as ordered).
- Interface recheck at c9bf2b1: `mountParticipantView({doc,root,form,questions,review,reviewAnswers,receipt,context,model,onEdit,reviewButton})` returns `{showForm,showReview,showReceipt,reset,destroy}`; page.js imports createParticipantJourney + mountParticipantView/itemError; journey built with `{window, storage: sessionStorage}` or demo sample. Matches ticket, with one delta noted: the live signature also carries `context` (absent from ticket text). Preserved as-is.
- `.assetsignore` at base ends with `kit/app-adapter.test.mjs`; no participant-presentation line yet.
- No denial on any named read.

## Custody ACK — exact eight paths
1 ui/participate/page.js · 2 ui/participant-view.js · 3 ui/participant-view.test.mjs · 4 ui/participant-dom.test.mjs · 5 ui/participant-header.test.mjs · 6 ui/kit/views-participant.js (new) · 7 ui/kit/participant-presentation.test.mjs (new) · 8 ui/.assetsignore (append exactly `kit/participant-presentation.test.mjs`, SERIAL coordinator custody — I will not touch it while any other worker holds the line; I request the line from Auggie before the append).
Everything else read-only, including controller.js, shared-link.js, participant-resume.js, API/storage, root/assess/scope, kit core/tree/styles, participant HTML, release/pins, 149 routes. No main/prod/DEV write, merge, deploy or force push. PR only.

## Gates (actual, this owner)
- oddkit_preflight: FOUND; DoD klappy://canon/definition-of-done; pitfalls: visual proof for UI, test output for logic, reference decisions.
- oddkit_gate planning→execution: invocation 1 NOT_READY 3/4 (irreversibility not stated); invocation 2 with irreversibility named (isolated deletable branch, serial .assetsignore, controller/idempotency untouched) PASS 4/4, governance_source knowledge_base. Owner gate PASS is a prerequisite, not FIRE.

## Own promise (binds only at Auggie SOURCE FIRE)
First 30-minute increment: create branch from c9bf2b1; add ui/kit/views-participant.js rendering intro + question surface around the existing form fields via the existing mountParticipantView contract; wire page.js to it behind the same calls; run controller/view/dom/header/resume suites green; push head + test output + one 1440×900 and one 390×844 screenshot of intro→form to this dish. Forecast for remaining K4a slice (review/receipt surfaces, busy/error/uncertain states, new presentation test, .assetsignore line, Wrangler asset 404/200 proof, synthetic-transport journey proof, PR): three to four further 30-minute increments; retracts if retained fields cannot satisfy kit fidelity — amendment proposed, not scope expansion.

## Blockers / missing capability (exact, not simulated)
- No dispatcher callback channel observed in this session: return is this session + this Git receipt. Not inventing a recipient ACK.
- Browser custody: shared Chrome driver not seized; proof will use the isolated in-app browser or local synthetic loopback only.
- 3d-review-app write capability untested (first tested at FIRE by branch creation).

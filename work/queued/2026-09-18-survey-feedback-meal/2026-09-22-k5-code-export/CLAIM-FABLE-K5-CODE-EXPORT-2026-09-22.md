# CLAIM — Fable K5a code-export worker (release Fable, reassigned under Auggie)
Observed 2026-09-22 16:13:26Z–16:16Z (oddkit_time). Status: OWNER READ/ACK / READINESS ONLY / NOT FIRED. No source start. Release custody (PR174) held untouched in parallel; not assumed complete.

## Exact order revision read
- Dispatched pointer: TICKET.md @ kitchen 36db3da061c0a014eab77b0856be07a6ae05e4b5 (blob 9db3ed30559652435eb1c8ce48ed88020a5d5c55) — the pre-amendment proposal.
- Current amended ticket @ kitchen main 64be0b7a50363748a442d2cbbf03c1248a8daeb7: TICKET.md blob **bd14a42cc00070fa19b49fd06aa5b254f1c70fe8** (amendment commit 30e88f032e9fcd59198e9b4aa02f7d74ef3c49d5 per ACCEPT). Read in full, including "Independent review amendment — complete code-operation effect chain".
- INDEPENDENT-PLAN-REVIEW-2026-09-22.md blob 6cad42a9 (AMEND 2ef34b86: outer run()/api() effects must be guarded). INDEPENDENT-PLAN-ACCEPT-2026-09-22.md blob bc085818: ACCEPT planning readiness; source FIRE still required; "only qualified external owner implements".
- This ACK binds to blob bd14a42c. If the ticket moves again before FIRE, I re-read and re-ACK the new blob.

## Authentic identity / runtime
Same local Cowork session as the release worker (task 07f7043c / worker 77bbdfa3), claude-fable-5-1. Separate worktree created: `/Users/chrisklapp/Documents/3d-review-fable/worker-code-export/` (app/ detached at planning source **efb53588edb0efd0b2f2b2edb15901794a287cd2**, read-only; evidence/). `worker-release-k3a/`, first-Fable `app/`+`evidence/`, and `worker-k4-participant/` untouched. Remote `release/k3a-0.16.0-20260922` still 907bd5d2 (verified 16:14Z). Note: the local `worker-release-k3a/app` mount tree carries stale uncommitted edits from the pre-fallback attempt; they are local only and never pushed.

## Fresh source observations at efb53588 (read-only)
- ui/app.js:132 `api()`, :147–151 `run()` — run() disables every button except version/changelog-close, then in `finally` restores `release-codes`/`issue-link-confirm`/`build-report` from state and **all others to `false`** (this is the blanket-restore the amendment forbids for code operations); api() evidence append precedes handler resume, as the review states.
- ui/app.js:381–413 — clearCodeBatch/codeRoute/issue-codes (count 1–100)/preview-export (dry_run → confirm_token)/release-codes (token cleared before awaited execute; output textContent only) — matches ticket contract verbatim.
- ui/legacy/index.html:12 — survey-card code region ids: code-count, issue-codes, issued-ids, preview-export, export-impact, release-codes, codes-output, plus the once-only/no-email note.
- ui/kit/ at c9bf has no legacy-adapter.js/.test.mjs (new files as ordered). ui/.assetsignore @efb ends `kit/coordinator.test.mjs`, `kit/app-adapter.test.mjs`, `assess/feedback-modal.test.mjs`; @c9bf ends `…kit/app-adapter.test.mjs` — line differs by base, so the exact append position is taken from the FIRE-chosen base.
- Branch `design-batch/k5-code-export-20260922`: ABSENT (checked 16:14Z). Created only after FIRE.

## Custody ACK — exact six paths (ticket blob bd14a42c)
1 ui/legacy/index.html (code-batch region presentation only) · 2 ui/app.js (code issue/preview/execute binding/presentation + code-only guarded invocation wrapper and transport-evidence currentness; no global auth/run refactor) · 3 ui/kit/legacy-adapter.js (new, presentation-only) · 4 ui/kit/legacy-adapter.test.mjs (new) · 5 test/legacy-code-export.integration.test.mjs (new, synthetic-only) · 6 ui/.assetsignore (append exactly `kit/legacy-adapter.test.mjs`; SERIAL custody — requested from Auggie before the append, never concurrent with K4's line).
Read-only: everything else, including assess/scope/feedback/core/tree/global CSS, participant files, K4 mountParticipantView files, backend/API/storage/grants, release metadata. No revoke/undo/email/PDF invention; no credential persistence; no auto-retry; no shared-browser custody (isolated in-app browser or loopback synthetic only). No main/production write, merge, deploy, force push.

## Owner gates (actual, 16:15–16:16Z)
- oddkit_preflight: FOUND; DoD klappy://canon/definition-of-done; surfaced klappy://canon/principles/code-claims-require-code-observation; pitfalls: visual proof for UI, test output for logic.
- oddkit_challenge (planning): CHALLENGED, knowledge_base, tensions none, block=false. Answers: confidence = working belief from source read at efb (lines cited above), untested in code; comparison target = the existing run()/api() outer wrappers as they are at efb (not a strawman: their blanket restore and unconditional evidence prepend are the exact counterexample the reviewer raised); retraction condition = any stale effect in the 18-case negative matrix, or any diff in existing non-code suites (diagnostic-path, visibility, participant-dom/resume, public-choices); dependency if false = the wrapper approach is replaced by a narrower api() currentness callback, still within app.js — not a ticket-scope change; no new term coined ("code-only guarded invocation wrapper" is the ticket's own phrase).
- oddkit_gate planning→execution: PASS 4/4 (irreversibility: deletable branch/PR only, serialized ignore line; constraints: all MUST rules addressable inside six paths). Owner PASS ≠ FIRE.

## First 30-minute increment (forecast; binds only at FIRE on an accepted exact base)
Branch from the FIRE-named base; add legacy-adapter.js (kit panel/batch row/action grouping over the existing ids, no state); wire legacy/index.html classes/links; in app.js add the code-only guarded wrapper (snapshot identity/session+assessment+survey+batch generation+method/target/ids/token before dispatch; check before completion/error/finally, control restoration with per-node original disabled state, and evidence append) around issue-codes and preview-export; first integration harness: real /legacy/ entry, synthetic API intercepted before navigation, issue→preview with values hidden, desktop 1440×900 + phone 390×844 pairs, request evidence captured. Checkpoint returned to this dish with head + test output + sanitized screenshots. Forecast for the remaining slice (execute reveal, 18-case negative matrix, failure/currentness/double-invoke, non-code regression suites, assetsignore line, 404/200 asset proof, PR): two to three further 30-minute increments. Retracts to amendment if the wrapper cannot preserve non-code behavior byte-for-byte.

## Blockers / gaps (exact)
- Awaiting: independent re-acceptance already landed (bc085818) → coordinator FIRE naming the exact base (efb53588 planning source vs the release-integrated head after PR174 corrections). I do not choose the base.
- .assetsignore serial line: request pending, not taken.
- Auggie channel: this dish + session only; no callback tool.
- Concurrency: I hold two custodies (PR174 metadata, blocked; K5a, not fired). If PR174 handoff and K5a FIRE arrive together, PR174 re-verification runs first (it is smaller and blocks release); K5a starts after, and I report the sequencing rather than interleaving writes.

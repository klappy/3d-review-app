# For later: shared atomic actions with inline MCP UI

Status: **PROPOSED / NOT FIRED / AFTER CURRENT DEMO**. User idea, recorded by the delegated CoS author from root's explicit coordination handoff on September17,2026. This is a paraphrase of the requested idea, not text authored in Chris's public voice. No owner ACK, promise, implementation, new crew or spending is implied. Root retains the original user-message/journal attribution; this write does not touch the shared journal.

Chris's idea: expose the same small actions through MCP, API and normal UI; offer undo where an actual inverse exists; reuse the app's entity cards, actions and forms inside supported MCP inline UI so a user can inspect before/after/results, direct the action and undo when valid. Aim for guided user control and less support effort. Inspiration pointer: https://agentopoly.lol . The site was not analyzed; no capability, design or licensing claim is borrowed from that pointer.

## Reuse before new work

Existing root board13c5698876604 already records one API/shared handlers, small MCP surface, atomic action×scope×state/effect cases, and the distinction between inverse and irreversible disclosure. Preserve that contract foundation rather than creating a competing agent-only action system. Current app src/dispatch.ts is the shared HTTP/MCP execution path; registry/contract defines class/risk and confirmation; existing UI modules render real authorized entities. Those are ingredients to inspect against the future exact main, not proof that they can already render inside an MCP client.

Duplicate search: live kitchen full nontruncated tree33f2009b3e3f6ecd616975d0898eb687ba8ffb50 searched for3D inline/atomic/MCP-UI/support/undo and backlog/future/idea paths; root cookbook issue13 complete comments searched for agentopoly/inline UI/MCP Apps/atomic action. Found existing atomic/shared-handler contract discussion above, but no dedicated inline-UI reuse implementation order in these inspected surfaces. Reuse existing planning home `rail/1-ordered/2026-09-16-3d-reproducible-preplan/` via this additive future idea; do not open another meal or claim an exhaustive historical search.

## Boundaries to carry into any later planning dish

- Atomic action means a bounded coherent operation/transaction. It does not imply reversible effects. Email cannot be unsent; disclosure cannot be unseen. Distinguish exact inverse, compensating control and irreversible action, preserve preview/confirm and actual impact.
- MCP/API/UI must use the same authoritative permissions, exact scope, current state, validation, idempotency and effect contracts. Inline cards/forms do not grant access, bypass confirmations, trust caller roles, expose hidden entities or convert a token into authority.
- Reuse source components only where feasible. Discover actual target MCP client support, resource transport/rendering model, authentication/session/delegation, CSP/sandbox rules, focus/accessibility, lifecycle and stale-state handling. Installed tools or a demo site do not prove client support. Unsupported clients need an honest usable non-inline fallback.
- Before/after/result views must show actual authoritative outcomes and uncertainty after interrupted requests. A UI animation or tool success envelope is not proof a side effect completed. Undo is offered only with a valid authorized inverse/current-state check; no generic misleading Undo button.
- Treat tokens, private entity names, membership and response data as scoped content. Reuse existing redaction; no raw credential route in diagnostic text, no broad catalogue for card rendering.
- Keep user direct control explicit: propose/inspect/edit/confirm/observe; do not let the assistant silently approve a human-only decision. Record genuine actor/delegation and retained effect receipts.

## Later planning return, only when separately ordered

Produce a bounded source/client capability inventory, actual reuse-versus-adapter comparison, proposed smallest end-to-end action with failure/uncertainty/undo cases, source-based UX examples, independent security/accessibility challenge and exact acceptance evidence. If it is worthwhile and accepted, issue fully specified bounded implementation tickets with real owners/budgets. No empty claimable build placeholders now.

Measure user task completion, mistaken/repeated actions, recoverable failures and support effort against an observed baseline; no invented improvement percentage, cost saving or completion promise. Current demo, W/I integration, self-service creation and existing mail work continue independently. This idea is recorded, not running.

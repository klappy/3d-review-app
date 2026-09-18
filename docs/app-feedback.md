# Current-shell app feedback

Issue106 recovers kitchen `rail/1-ordered/2026-09-16-3d-feedback-schema-richer` and the preserved Prefer `PLAN-2026-09-17-feedback-component-fixtures.md`. The frozen existing contract, not the earlier required-fields proposal, remains authoritative.

`App feedback` in the current shell opens `#feedback`. Signed-in users can send canonical `note`, helpful, optional satisfaction/confusion/frustration1–5, and optional sentiment_journey through existing POST `/v2/feedback`. Empty fields are omitted. No page content, assessment identifiers, answers, credentials or inferred scores are captured. Feedback is linked by the server to the signed-in actor; the form explains authorized-support access.

The separate component uses the shell's existing authenticated API. It preserves entered values across local validation and server/connection failure. Confirmed `recorded:true`, `stripped:false` and a feedback reference produce the success state. Ambiguous/malformed outcomes show uncertainty and require an explicit second send, warning that a duplicate may result; no automatic retry/idempotency claim. Identity/navigation changes suppress stale completion. Demo and unauthenticated contexts cannot mount a sending form. Drafts live only in the page and are lost on leaving/reload; expired-session copy explains saving text before sign-in.

This first delivery does not add backend/schema, support readback UI, survey feedback, voice, AI processing or public ticket creation. Future meaning-preserving triage, explicitly authorized ticketing, tested fixes and original-user verification remain deferred under the original ticket. They do not gate the form.

Validation: local DOM/component and shell-entry regressions; no live feedback submission or human sentiment measurement. Browser/deployment proof and a canonical compatible MINOR release pin remain separate, pending integration ordering with theme0.9.2 and cards0.10.0.

## Attributed-write precondition

A cached sign-in does not prove that the next write is authenticated. The form sends optional `require_authenticated:true`; the existing shared feedback handler checks the request-resolved principal before persistence and refuses anonymous callers with NOT_AUTHENTICATED. This is an additive parameter on the existing HTTP/MCP capability, not a database change or restriction on public feedback. Omitted/false retains existing anonymous behavior; the flag is never persisted or treated as identity. No preflight-only guarantee is claimed. The field map in capabilities/OpenAPI is amended together; canonical MINOR release notes must include it.

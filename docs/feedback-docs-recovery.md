# Feedback field discovery correction

Scope: [issue113](https://github.com/klappy/3d-review-app/issues/113), direct user feedback recorded September18,2026. Sanitized scenario: the capability docs omitted accepted fields, so a client tried `body`, `message` and `comment` before discovering `note` through capability enumeration. The authenticated private feedback locator is retained in the owning issue; this document does not reproduce its raw content. Root supplied source environment DEV/ChatGPT and feedback timestamp 2026-09-18T18:08:50.246Z. Original full natural-language query, calling role, exact build and contract pin were not captured. Root observed DEV 0.9.3 at app0eb297d at18:11; that nearby observation does not prove the report’s exact source version. `q: feedback` below is a sanitized reproduction, not a claim to quote that missing query.

Disposition: documentation/discoverability defect. The write already works; no runtime feedback repair or new tool is needed. The existing schema is the authority. The docs renderer now returns params/result schemas without copying their definitions, derives required/optional lists, preserves field-level amendment provenance, and supplies a minimal synthetic note example. The existing TOPICS source holds feedback explanation/recovery; entry exposes topic names. Search behavior remains unchanged: capability IDs/notes/UI surface, not topic prose. The field contract is not broadened.

Baseline: app `6577d10e27b9bf7a5ef0d4bae8150cf6fb51506f`, accepted form candidate stacked above main. That dependency includes optional `require_authenticated` from cookbook amendment `e9c09cb97ef206abb418de741bb93629bd1c9e23`; this docs change must not land before that contract/runtime dependency. Canonical PATCH0.11.3 follows sharing0.11.2, MCP connection0.11.1 and feedback0.11.0. This supersedes the earlier provisional0.11.2 assignment. Final integration preserves merged main and the accepted sharing runtime; release identity is derived from the cookbook record through the existing manifest chain, not this document.

## Fixed evidence scope

Seven cases per face (HTTP and MCP),14 total: entry/search/topic/detail path; runnable minimal example; each of three invalid-name guesses followed by canonical note recovery; anonymous resolved-caller attribution refusal without insertion; unsupported-query truthful miss. Same fixture/source/data method before/after:

| Evidence | Baseline | Candidate | Scope |
| --- | --- | --- | --- |
| HTTP local Request + D1 fixture | 2/7 pass,5/7 fail | 7/7 pass | Authenticated synthetic collaborator; separate anonymous guard case |
| MCP local JSON-RPC Request + D1 fixture | 2/7 pass,5/7 fail | 7/7 pass | App dispatcher behind auth edge; not OAuth connection/host proof |
| Affected docs/feedback regressions | Not rerun for comparison | 66/66 pass | Includes14 new cases; do not add overlapping counts |
| Typecheck | Not comparative | Pass | Normal generated-version prerequisite |
| DEV deployed replay | Untested | Untested | Requires released docs source/build and contract pin |
| Production deployed replay | Untested | Untested | Requires same validated release and served docs proof |
| Human comprehension | Not measured | Not measured | Sample0; no satisfaction/confusion/frustration score |

Writes occur only in isolated synthetic D1 fixtures, never in live feedback. Example responses are checked not to echo the note, the note is read back in the local fixture, and the attribution guard cannot insert an anonymous row. Existing privacy/persistence suites preserve omitted/false behavior and redaction. MCP authentication is stated in guidance; the isolated app dispatcher test does not prove the outer OAuth edge.

Technical source review and deployed verification are separate. Do not close issue113 on source merge alone. Root owns release integration and the recurrence-aware DEV/production follow-up: record served semantic version/build, narrative docs source and contract/amendment pin; replay discovery and safe read-only example inspection, compare later reports to those versions, and reopen/link recurrence. Human confirmation remains explicitly pending; no outreach is authorized by this change.

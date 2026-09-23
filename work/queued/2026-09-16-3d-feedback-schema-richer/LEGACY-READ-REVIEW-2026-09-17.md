# AMEND — exact PR34 legacy projection

Independent bounded review of068537ec0cd6c28c93923b99de9e67bcde18d248. Actual START2026-09-17T08:30:30Z; complete08:33Z. No candidate implementation edits, provider activity, DEV rows, pushes or migration FIRE. Disposable detached checkout /tmp/3d-feedback-legacy-probe; only untracked probe plus dependency symlink. PR34 comments/reviews checked first: sole root comment5711377799 explicitly assigned this bounded falsifier; no other active owner/testing acknowledgment observed.

## Confirmed P2 contract defect

Both requested falsifiers reproduce through actual HTTP GET, authenticated synthetic support session, actual candidate dispatcher/policy/handler, disposable Miniflare D1. Two tests pass because they assert the observed defect, not desired acceptance. Runtime bundled Node24 / Vitest2.1.9. Existing0001–0004 and committed synthetic seed initialize disposable memory only. No candidate full-suite rerun.

1. Stored valid JSON {text:{legacy:'value'},stripped:false} returns HTTP200 ok:true and body.note={legacy:'value'}. Exact OpenAPI FeedbackGetResult requires note:string. Independent JSONSchema validation fails at body.note. Prior299f825 writer at platform.ts83–88 persisted rest.text without a string check, so this is a historically admitted shape, not merely corrupt-storage speculation.
2. Stored helpful:'yes', satisfaction:'5', confusion:{legacy:2}, frustration:[] returns HTTP200 ok:true with all four unchanged. Exact read schema rejects boolean/integer violations. These richer malformed values are deliberately injected storage fixtures: the prior299f825 writer did not persist those fields, so no claim those four came from that historical writer or exist in DEV.

Cause: src/handlers/platform.ts184–190 copies selected raw object values after only JSON/object-shape validation; JSON validity does not establish the published read contract. OpenAPI lines242 onward defines the typed read projection. Governing packet5732375 lines133–161 specifies exact support-only projection, persisted-key omission and text→note mapping. Its exact excerpt does not itself state a fully specified malformed-object recovery policy; root5711377799 explicitly holds this case for disposition. Existing implementation already hides malformed JSON/arrays with NOT_FOUND_OR_NOT_VISIBLE. This is a support-only response-contract failure, not demonstrated authorization bypass or participant disclosure.

## Minimum disposition

AMEND before integration: extend the existing malformed-row fail-closed disposition to invalid typed stored fields before successful projection, preserving optional omission and arbitrary valid context. Do not stringify/coerce values, invent scores, drop malformed fields silently, loosen the output schema or migrate historical rows. Same fixed existence-hidden error used for other malformed storage is the narrow consistent behavior for owner/Auth confirmation. Grok retains implementation; this review implements nothing. Required regression covers these two cases and ordinary valid legacy string text. No whole feedback feature redesign or new user decision is required by this evidence.

Evidence: OBSERVED.json contains exact synthetic HTTP results; READ-SCHEMA.json extracted from exact candidate OpenAPI via Ruby YAML; SCHEMA-VALIDATION.json reports1+4 type violations using jsonschema4.25.1. TEST.log and PROBE.test.ts retained. Initial YAML module probes failed locally (node yaml and Python yaml unavailable); Ruby parser succeeded, no package changes. This does not affect the executed HTTP falsifiers.

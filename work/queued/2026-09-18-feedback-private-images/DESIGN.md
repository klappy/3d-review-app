# Bounded design: Optional private feedback attachments

Child of issue130. Design explicit optional upload, preview/remove/redaction, bounded formats/sizes, private access and failure/retry/receipt behavior through existing feedback pipeline. No automatic capture or answers/tokens.

Separate feature design before implementation; does not block in-place modal.

Use existing application components, scoped authorization and the shared API/MCP pipeline. No new tracking backend, provider writes or unrelated release changes. Validate with local fixtures before any authorized live acceptance. Preserve explicit unknowns; do not infer experienced version from submission version.

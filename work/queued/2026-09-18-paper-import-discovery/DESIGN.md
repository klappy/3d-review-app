# Bounded design: Paper survey import discovery

Define form identity, authorized uploads, extraction uncertainty, correction and human review before persistence, duplicate detection and audit provenance. API/MCP-first contract; no autonomous uncertain OCR writes.

Discovery only; no version or implementation promise.

Use existing application components, scoped authorization and the shared API/MCP pipeline. No new tracking backend, provider writes or unrelated release changes. Validate with local fixtures before any authorized live acceptance. Preserve explicit unknowns; do not infer experienced version from submission version.

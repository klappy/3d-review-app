# Bounded design: Identifiable printable surveys

Reproduce the real blank survey and invitation print flows; determine why the reported form lacks a QR. Include assessment/form identity, scannable authorized entry and human-readable fallback without private data. Screen and multipage print proof; distinguish identification from bearer access. Do not bundle AI import.

Reproduction and scope first; no implementation in Letter release.

Use existing application components, scoped authorization and the shared API/MCP pipeline. No new tracking backend, provider writes or unrelated release changes. Validate with local fixtures before any authorized live acceptance. Preserve explicit unknowns; do not infer experienced version from submission version.

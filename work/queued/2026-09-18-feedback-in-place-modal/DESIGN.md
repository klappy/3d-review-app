# Bounded design: Report feedback without losing current work

Bounded child slice of contextual feedback130: open feedback in place, preserve unfinished work, dismiss back to same context. Safe route/component and experienced UI/API version context with allowlist only; reuse existing backend/MCP contract. No input values, survey answers, bearer/query identifiers or automatic screenshots.

Separate implementation queue; attachments and broader observability remain discrete.

Use existing application components, scoped authorization and the shared API/MCP pipeline. No new tracking backend, provider writes or unrelated release changes. Validate with local fixtures before any authorized live acceptance. Preserve explicit unknowns; do not infer experienced version from submission version.

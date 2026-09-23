# Bounded design: Letter by default, explicit A4 retained

Set initial preview and generated print page size to US Letter. Retain explicit A4 and preserve the selection through printing. Check controls, output CSS and clean isolated printing. No QR or import changes.

Small separate PATCH after 0.14.2; independent review and MAIN/DEV first.

Use existing application components, scoped authorization and the shared API/MCP pipeline. No new tracking backend, provider writes or unrelated release changes. Validate with local fixtures before any authorized live acceptance. Preserve explicit unknowns; do not infer experienced version from submission version.

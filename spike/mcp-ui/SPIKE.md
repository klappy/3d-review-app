# 3d-review MCP Apps UI spike — isolated, fixture-only

Order: cookbook #16 c5719587147 · contract #16 c5719616259 · challenge folded #16 c5719669587.

**What this proves:** a tool round-trip rendered INLINE in the MCP Apps reference host (`ext-apps` `examples/basic-host` 2.0.0): `tools/list` carries `_meta.ui.resourceUri`, `resources/read` serves `text/html;profile=mcp-app`, `tools/call` → host renders the view → view receives the tool result (`toolresult` event registered before `connect()`). Screenshots and RPC samples in `out/`.

**What it does NOT prove:** live wiring (the real server exposes four generic tools — `docs/read/write/danger` — and no `resources/*`; this spike is a standalone demonstration, not a path onto `src/mcp.ts`); rendering in any host other than basic-host (the Claude host serves this profile to other connectors, which is observation, not a test); real authorization (role-awareness is the fixture's `role` field — hosts pass no principal); any write (`cap.survey.select/deselect` never called; "Preview selection" writes nothing; no Undo offered because no reversal is exercised).

**Data:** `fixture/assessment.json`, labelled in-view "Fixture data — not live"; shape copied from `cap.assessment.get` (`{assessment, surveys}`) plus per-survey `cap.survey.get_status` counts (N+1 in live wiring).

**Isolation:** own `package.json` (`@modelcontextprotocol/server@2`, `ext-apps@2`, `zod@4`); nothing under `ui/` (public assets); root `tsconfig`/`vitest` includes do not reach `spike/`; not built or deployed by the Worker; never calls a 3d-review URL (the DEV root appears only as the `ui/open-link` target string).

**Known gap (Design):** views inline the design-system tokens/components CSS but do not yet follow the showcase app-flows structure or apply host theming; visually flatter than the app. Next increment if the experiment continues.

Run: `cd spike/mcp-ui && npm ci && npm run build:views && node server.mjs` (streamable HTTP `:3001/mcp`), then basic-host per `out/README.md`; tests `node --test *.spec.mjs`.

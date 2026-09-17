# MCP Apps UI spike — run record

Tool round-trips rendered **inline in the ext-apps reference host** (`examples/basic-host`),
driven by Playwright. Fixture data only: the spike server makes no call to any 3d-review
DEV/production URL. The DEV root appears once, as a link-target string in the overview view.

Spike source: `/home/claude/spike-work/spike/mcp-ui/` (maps to repo path `spike/mcp-ui/`).
Nothing was committed or pushed; the read-only app worktree was not modified.

## Versions

| Thing | Value |
| --- | --- |
| node | v22.22.2 |
| bun | 1.3.13 |
| ext-apps repo | https://github.com/modelcontextprotocol/ext-apps @ `6d9bdc7babf275b759225aa722cbf5510c4c6021` (shallow clone of `main`), package version 2.0.0 |
| basic-host | `@modelcontextprotocol/ext-apps-basic-host` 2.0.0 (host :8080, sandbox proxy :8081) |
| spike deps | `@modelcontextprotocol/server` 2.0.0, `@modelcontextprotocol/ext-apps` 2.0.0, `zod` ^4, dev: `esbuild` ^0.25 |
| app repo read for shapes | klappy/3d-review-app @ main `b0bb9c9` (read-only worktree) |
| Playwright | 1.57.0 (repo devDependency) |
| Chromium | /opt/pw-browsers/chromium-1194 (pinned via `executablePath`; `playwright install` was NOT run) |

## Exact commands

```bash
# Step 0 — host
git clone --depth 1 https://github.com/modelcontextprotocol/ext-apps.git /home/claude/spike-work/ext-apps
cd /home/claude/spike-work/ext-apps
npm install --include-workspace-root --workspace=@modelcontextprotocol/ext-apps-basic-host
npm run build                                     # SDK: schema gen + bun build + link-self
cd examples/basic-host && npm run build           # vite build of index.html and sandbox.html
bun serve.ts                                      # host :8080, sandbox :8081, servers default ["http://localhost:3001/mcp"]

# Steps 1–3 — spike
cd /home/claude/spike-work/spike/mcp-ui
npm install
npm run build:sdk-bundle                          # esbuild -> views/vendor/app-global.js (window.McpApps)
npm run build:views                               # inlines design tokens + views/src bodies -> views/*.html
node server.mjs                                   # streamable HTTP on :3001 /mcp, RPC log to out/rpc-log.jsonl

# Step 4 — drive
cd /home/claude/spike-work/ext-apps
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node drive.mjs   # copy kept at spike/mcp-ui/drive-host.mjs

# Step 5 — tests
cd /home/claude/spike-work/spike/mcp-ui && node --test *.spec.mjs   # 7 pass
```

Notes on two deliberate deviations:

- The spike server uses `createMcpHandler(...).fetch` from `@modelcontextprotocol/server`
  behind a ~40-line `node:http` bridge, rather than `@modelcontextprotocol/node` +
  `express` as the ext-apps examples do. That keeps the dependency list to exactly the
  three packages specified. Streamable HTTP, `POST /mcp`, no stdio path at all.
- Views are generated files: `build-views.mjs` inlines `views/src/*-body.html` and `ui/design-system/tokens.css`
  and `components.css` (copied to `views/vendor/*.css`, verbatim) plus the view body, and
  `server.mjs` substitutes the esbuild SDK bundle for the `/*__APP_SDK_BUNDLE__*/` marker
  at `resources/read` time. The HTML the host receives is fully self-contained — no CDN,
  no `src="http…"` (asserted in `server.spec.mjs`).

## What rendered (screenshots, 1280×900)

Each was captured after the host completed `tools/call` → `resources/read` → sandbox load →
`toolresult`, with the view's own `body[data-view-state]` confirming the state.

| Screenshot | Tool / fixture | State confirmed in the frame |
| --- | --- | --- |
| `out/overview-default.png` | `assessment_overview` `{fixture:"default"}` | Name, `stage: collect`, "Fixture data — not live" badge, three lens cards 2/4/2 with summed counts (9·7, 12·11, 9·8), "Open in app" button present |
| `out/overview-empty.png` | `assessment_overview` `{fixture:"empty"}` | "No surveys included" empty state |
| `out/overview-error.png` | `assessment_overview` `{fixture:"error"}` | Error state rendering the fail envelope verbatim: `{"ok":false,"error":{"code":"NOT_VISIBLE","message":"assessment is not visible to this principal"}}` (tool returned `isError: true`) |
| `out/selector-default.png` | `survey_selector` `{fixture:"default"}` | Three lens groups, 8 included checkboxes + `Video-Sign` available, controls enabled (role owner), "Preview selection" clicked — pending list rendered as text, no write |
| `out/selector-viewer.png` | `survey_selector` `{fixture:"viewer"}` | "fixture role: viewer — controls disabled"; every checkbox and both buttons disabled (verified programmatically: `previewDisabled === true`) |

Driver output (states, extracted frame text, preview text, iframe attributes) is in
`out/drive.json`; browser console log for the run is in the same file. `out/host.log` and
`out/server.log` are the two servers' stdout.

## Host capabilities the view saw

From `app.getHostCapabilities()` inside the sandboxed view, logged to the console after
`app.connect()` (captured in `out/drive.json` → `caps`):

```json
{"openLinks":{},"serverTools":{"listChanged":true},"serverResources":{"listChanged":true},"updateModelContext":{"text":{}}}
```

`openLinks` is advertised, so the overview renders the "Open in app" button targeting the
DEV root `https://3d-review-dev.klappy.workers.dev/` (root only, no deep link). The button
was rendered, screenshotted and clicked: `app.openLink({url: <dev root>})` returned a
non-error result and the view reported "Link handed to the host." No `sampling` and no
`elicitation` capability was advertised by this host.

## Viewer restrictions the host applies (verbatim from basic-host source)

Double-iframe: host (8080) → outer sandbox proxy (8081, separate origin) → inner iframe.
The view HTML is handed to the sandbox over `postMessage`
(`ui/notifications/sandbox-resource-ready`); at runtime the inner iframe carried no `srcdoc`
attribute (`hasSrcdoc: false` in `out/drive.json`).

- Outer iframe, `examples/basic-host/src/implementation.ts:171`:
  ```ts
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  ```
  plus an optional Permissions-Policy `allow` attribute built from the resource's requested
  permissions (this spike requests none, so no `allow` attribute was set — confirmed at
  runtime: `allow: null`).
- Inner iframe, `examples/basic-host/src/sandbox.ts:46`:
  ```ts
  inner.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  ```
  (overridden only if the resource supplies its own `sandbox` string — this spike does not).
  Observed at runtime for both views: `sandbox="allow-scripts allow-same-origin allow-forms"`, `allow: null`.
- CSP is set as an HTTP header on `sandbox.html` by `examples/basic-host/serve.ts`
  (`buildCspHeader`). With no `csp` declared by the resource, the header served during this
  run was, verbatim:
  ```
  Content-Security-Policy: default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; style-src 'self' 'unsafe-inline' blob: data:; img-src 'self' data: blob:; font-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'none'
  ```
  Consequences for a 3d-review view: `connect-src 'self'` means a view cannot fetch the
  3d-review API directly — all data must arrive through tool results. Inline script/style is
  permitted, which is what makes the self-contained bundle work. `frame-src 'none'` and
  `base-uri 'none'` block nested frames and base rewriting.

## JSON-RPC log

`out/rpc-log.jsonl` — 120 lines (~5.1 MB; each `resources/read` response embeds the whole
self-contained view), appended across the last two five-case runs, written by the spike server
(`{ts, direction, payload}` per line; `direction` is `request` or `response` as seen by the
server). Three sample lines (truncated) are in `out/rpc-samples.txt`; the log contains, for
each case: `initialize`, `notifications/initialized`, `tools/list` (response carries
`_meta.ui.resourceUri` for both tools), `resources/list`, `tools/call` (request + response),
and `resources/read` (response `mimeType: text/html;profile=mcp-app`).

## Not exercised

- **No write path.** `cap.survey.select` / `cap.survey.deselect` are never called; the
  selector previews a pending set only. There is no Apply and no Undo — the views carry the
  note: "Real cap.survey.select / deselect return an undo_token; this spike does not offer
  Undo because no reversal is exercised."
- **No live data.** No auth, no session, no D1, no `cap.*` dispatch; `counts` is a static
  map, where live wiring would be one `cap.survey.get_status` call per survey (N+1).
- **`callServerTool` from inside the view.** Every render here came from a host-initiated
  `tools/call`; the view never calls a tool itself, so in-view refresh is untested.
- **Host-context/theming.** `hostcontextchanged` is delivered by basic-host but the views do
  not apply `applyDocumentTheme` / host style variables; the design-system tokens render
  against the host's default background, so the glass/panel treatment looks flatter inline
  than it does in the app. Nothing was measured about dark mode.
- **Other hosts.** Only `examples/basic-host` was used. No Claude/ChatGPT/other host, no
  `resources/subscribe`, no elicitation, no sampling, no `structuredContent` schema
  validation by the host.
- **The `empty` selector fixture** was not screenshotted (the two selector shots are
  `default` and `viewer`); the empty branch is covered only by `lens.spec.mjs`.

## Elapsed time

| Step | Wall clock (UTC) | Elapsed |
| --- | --- | --- |
| 0 — clone, install, build, serve basic-host | 18:59 → 19:05 | ~6 min (clone 1.5 s, `npm install` 36 s, SDK `npm run build` 9 s, host build 7 s) |
| 1–3 — spike server, fixture, views | 19:05 → 19:09 | ~4 min |
| 4 — Playwright run against basic-host | 19:09 → 19:13 | ~4 min including two re-runs |
| 5 — spec tests | 19:11 | 0.7 s for 7 tests |

# MCP Apps UI spike — run record

Tool round-trips rendered **inline in the ext-apps reference host** (`examples/basic-host`),
driven by Playwright. Fixture data only: the spike server makes no call to any 3d-review
DEV/production URL. The DEV root appears once, as a link-target string in the overview view.

Spike source: `spike/mcp-ui/` in this repo. Everything under that path is committed on the
spike branch, including this run record and every artifact it cites: the five screenshots,
`drive.json`, the trimmed `rpc-log.jsonl`, `rpc-samples.txt`, `host.log` and `server.log`.
Nothing outside `spike/mcp-ui/**` is touched: no app source, no `ui/`, no migrations, no
Worker config.

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
git clone --depth 1 https://github.com/modelcontextprotocol/ext-apps.git <work>/ext-apps
cd <work>/ext-apps
npm install --include-workspace-root --workspace=@modelcontextprotocol/ext-apps-basic-host
npm run build                                     # SDK: schema gen + bun build + link-self
cd examples/basic-host && npm run build           # vite build of index.html and sandbox.html
bun serve.ts > <spike>/out/host.log 2>&1          # host :8080, sandbox :8081, servers default ["http://localhost:3001/mcp"]

# Steps 1–3 — spike   (<spike> = this repo's spike/mcp-ui, <work> = any scratch dir)
cd <spike>
npm install
npm run build:sdk-bundle                          # esbuild -> views/vendor/app-global.js (window.McpApps)
npm run build:views                               # inlines design tokens + views/src bodies -> views/*.html
node server.mjs > out/server.log 2>&1             # streamable HTTP :3001/mcp; RPC_LOG defaults to spike/mcp-ui/out/rpc-log.jsonl

# Step 4 — drive. The driver is spike/mcp-ui/drive-host.mjs, run from the ext-apps checkout
# because that is where `playwright` resolves from. OUT defaults to spike/mcp-ui/out.
cp <spike>/drive-host.mjs <work>/ext-apps/drive.mjs
cd <work>/ext-apps
OUT=<spike>/out PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node drive.mjs \
  > <spike>/out/drive.json 2> <spike>/out/drive.err

# Step 5 — tests
cd <spike> && node --test *.spec.mjs   # 9 pass, 0 fail
```

Notes on two deliberate deviations:

- The spike server uses `createMcpHandler(...).fetch` from `@modelcontextprotocol/server`
  behind a ~40-line `node:http` bridge, rather than `@modelcontextprotocol/node` +
  `express` as the ext-apps examples do. That keeps the dependency list to exactly the
  three packages specified. Streamable HTTP, `POST /mcp`, no stdio path at all.
- Views are generated files: `build-views.mjs` inlines `views/src/*-body.html` plus
  `ui/design-system/tokens.css` and `components.css` (copied to `views/vendor/*.css`), and
  `server.mjs` substitutes the esbuild SDK bundle for the `/*__APP_SDK_BUNDLE__*/` marker at
  `resources/read` time.
- The vendored CSS is copied with exactly one edit: **the Google Fonts `@import` that the app
  source carries at `ui/design-system/components.css:4` is stripped** from `views/vendor/components.css`,
  so the served resource fetches nothing off-origin. Serif text falls back to the local stack
  in `--font-scripture-latin`. `server.spec.mjs` enforces this: the guard fails on ANY
  `http(s)://` reached through `url()` or `@import` in the served `<style>`, or through `src=`
  or `href=` anywhere in the served HTML; only `data:` and `blob:` are allowed. (`url()`/`@import`
  are checked inside `<style>` only, because the SDK bundle legitimately builds
  `new URL("https://…")` values that are never fetched. The DEV root in the overview view is a
  JS string handed to `ui/open-link`, so it appears in none of the four reference forms.)
- **Design-system reuse is real in this run.** `components.css` is scoped entirely under `.rv`
  (119 of 122 selectors carry `.rv`; `:root` and two `.toastc` rules do not; `tokens.css` is
  unscoped `:root` custom properties). The app roots it on the
  document body — `ui/index.html`: `<body class="rv" data-entry-view="home">` — so
  `build-views.mjs` emits `<body class="rv" data-view-state="loading">` and the views pick up
  the same aurora ground, glass panels, `.eyebrow`/`.badge`/`.metric` type scale and primary
  button as the app. Visible in `out/overview-default.png`: gradient ground, three glass lens
  cards with the token radii and shadow, uppercase `STAGE:` eyebrow, the green primary
  "Open in app" button. `server.spec.mjs` asserts the `class="rv"` body on both views.

## What rendered (screenshots, 1280×900; `selector-viewer` at 1280×1400)

Each was captured after the host completed `tools/call` → `resources/read` → sandbox load →
`toolresult`, with the view's own `body[data-view-state]` confirming the state.

| Screenshot | Tool / fixture | State confirmed in the frame |
| --- | --- | --- |
| `out/overview-default.png` | `assessment_overview` `{fixture:"default"}` | Name, `stage: collect`, "Fixture data — not live" badge, three lens cards 2/4/2 with summed counts (9·7, 12·11, 9·8), "Open in app" button present |
| `out/overview-empty.png` | `assessment_overview` `{fixture:"empty"}` | "No surveys included" empty state |
| `out/overview-error.png` | `assessment_overview` `{fixture:"error"}` | Error state rendering the fixture failure envelope, whose code/message/shape/`trace_id` follow `src/envelope.ts` `fail()` with the message from `src/handlers/errors.ts` `notVisible("assessment")`: `{"ok":false,"error":{"code":"NOT_FOUND_OR_NOT_VISIBLE","message":"assessment not found or not visible"},"trace_id":"tr_fixture_error"}`. `notVisible()` sets no hint, so `error` has exactly `code` and `message` — asserted in `server.spec.mjs` (`Object.keys(env.error)` deep-equals `["code","message"]`, and `"hint" in env.error === false`). The view shows code, message, `trace_id` and the envelope verbatim (tool returned `isError: true`) |
| `out/selector-default.png` | `survey_selector` `{fixture:"default"}` | Three lens groups, 8 included checkboxes + `Video-Sign` available, controls enabled (role owner), "Preview selection" clicked — pending list rendered as text, no write; measured over every checkbox: 9 of 9 `disabled === false`, `previewDisabled === false`, `resetDisabled === false` |
| `out/selector-viewer.png` | `survey_selector` `{fixture:"viewer"}` | "fixture role: viewer — controls disabled". Measured programmatically over EVERY checkbox in the view — `[...document.querySelectorAll('input[type=checkbox]')].map(c=>c.disabled)` — all **9 of 9** checkboxes `true`, plus both buttons disabled (`previewDisabled === true`, `resetDisabled === true` for `#reset-pending`). The array, its count (9) and the all-disabled verdict are in `out/drive.json` as `selector-viewer:checkboxDisabled` / `:checkboxCount` / `:allCheckboxesDisabled`. This one shot is taken at 1280×1400 so the whole 9-checkbox list is in frame |

Driver output (states, extracted frame text, preview text, iframe attributes, host
capabilities, console log) is committed as `out/drive.json`; `out/drive.err` is the driver's
stderr for the same run (empty). `out/host.log` and `out/server.log` are the two servers'
stdout, also committed.

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

## Viewer restrictions **this host** applies (verbatim from basic-host source)

Everything in this section is a property of `ext-apps` `examples/basic-host` 2.0.0 as observed
in this run. It is that host's implementation choice, not a guarantee of the MCP Apps
specification, and another host may sandbox differently or not at all.

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
  (`buildCspHeader`) — again, basic-host's own policy, not a spec requirement. Crucially the
  header is **derived from the resource's declared `csp`**: `serve.ts:88` builds
  `connect-src 'self' ${connectDomains}` from the resource's `csp.connectDomains`, and the
  other directives interpolate `resourceDomains` the same way. This spike declares no `csp`,
  so those interpolations are empty and the header served during this run was, verbatim:
  ```
  Content-Security-Policy: default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; style-src 'self' 'unsafe-inline' blob: data:; img-src 'self' data: blob:; font-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'none'
  ```
  Consequences for a 3d-review view, **in this host and for a resource that declares no
  `csp`**: `connect-src 'self'` leaves no origin a view could fetch the 3d-review API from, so
  all data has to arrive through tool results. That restriction holds *because this spike
  declares no `connectDomains`* — a resource that declared the API origin would get it added to
  `connect-src` by `serve.ts:88` and could then fetch it directly. It is not a universal MCP
  Apps guarantee, and it is not an authorization boundary: it says nothing about what a view
  would be allowed to do with a credential it already held. Inline script/style is permitted by
  this host, which is what makes the self-contained bundle work; a host with a stricter
  `script-src` would break these views. `frame-src 'none'` and `base-uri 'none'` block nested
  frames and base rewriting here.

## JSON-RPC log

`out/rpc-log.jsonl` — the committed log is **one run of all five cases, 55 lines**, written
by the spike server (`{ts, direction, payload}` per line; `direction` is `request` or
`response` as seen by the server). It is **trimmed, and here is exactly how**: the raw
one-run log is 2.5 MB because each of the five `resources/read` responses embeds the whole
self-contained view (~500 KB each), which is over the 2 MB the review allows. The trim
replaces `contents[0].text` in those five response lines with
`<elided by the trim step: N bytes of self-contained view HTML>`; **every other byte of
every line, and every line, is verbatim** — nothing was dropped, no run was merged, and the
five cases are all present. Trimmed size: 32 KB.

`grep -c '\-32000' out/rpc-log.jsonl` is **0**: the node:http bridge now answers JSON-RPC
notifications (any message with no `id`, e.g. `notifications/initialized`) with **HTTP 202,
no body, no JSON-RPC reply**, and answers basic-host's pre-POST `GET /mcp` SSE probe with a
plain `405` (this server is `responseMode: "json"`; a non-JSON-RPC request gets an HTTP
status, not a manufactured `-32000` "response"). The previous run record's log carried six
`-32000` lines from those two paths; none remain, and no notification is answered at all.

The log contains, for each case: `initialize` (client capabilities `{}`),
`notifications/initialized`, `tools/list` (response carries `_meta.ui.resourceUri` for both
tools), `resources/list`, `tools/call` (request + response), and `resources/read` (response
`mimeType: text/html;profile=mcp-app`).

`out/rpc-samples.txt` carries the three key messages pretty-printed and untruncated —
`tools/list` response with **both** tools' `_meta`, the `resources/read` response header, and
the `tools/call` request. Only the `resources/read` view HTML is elided there too, for the
same reason and with a byte count in its place.

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
  not apply `applyDocumentTheme` / host style variables. The design system *is* applied (see
  above) but only in its light `:root` values: the views ignore the host's theme signal, so a
  host in dark mode still gets the light aurora ground. Nothing was measured about dark mode,
  and the views do not follow the app's showcase app-flows page structure.
- **The `io.modelcontextprotocol/ui` extension capability was never negotiated.** basic-host's
  `initialize` request carried `capabilities: {}` (see the `initialize` line in
  `out/rpc-log.jsonl`), so nothing about this run exercises extension-capability negotiation;
  the host discovers the views purely through `_meta.ui.resourceUri` on `tools/list` and
  `resources/read`. Any host that gates MCP Apps behind that capability is untested here.
- **Other hosts.** Only `examples/basic-host` was used. No Claude/ChatGPT/other host, no
  `resources/subscribe`, no elicitation, no sampling, no `structuredContent` schema
  validation by the host.
- **The `empty` selector fixture** was not screenshotted (the two selector shots are
  `default` and `viewer`); the empty branch is covered only by `lens.spec.mjs`.

## Elapsed time

| Step | Elapsed |
| --- | --- |
| 0 — clone, install, build, serve basic-host | ~6 min (clone 1.5 s, `npm install` 36 s, SDK `npm run build` 9 s, host build 7 s) |
| 1–3 — spike server, fixture, views | ~4 min |
| 4 — Playwright run, five cases against basic-host | ~1 min per run |
| 5 — spec tests | 0.8 s for 9 tests |
| review pass (this revision: design-system rooting, artifacts, no-CDN guard, real error envelope) | ~20 min |

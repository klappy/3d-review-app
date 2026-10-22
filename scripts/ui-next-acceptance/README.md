# UI Next live acceptance harness (status: provisional)

Browser-driven acceptance of the LIVE `/next/` app on its normal routes (`/next/#/…`), as the cookbook root plan
`work/active/2026-10-21-ui-next-demo-wiring/RESULTS-root-continuation-2026-10-22.md` steps 5–6 require: real persisted journeys,
visible navigation (links, back/forward, reload, deep links) and playbook rule 15 measurement (each screen vs its board at
1280×800 and 390×844, light + dark, provenance off, ≤5 % changed pixels). Fixture captures (`?screen=`) do not count here.

Scripts (Node ≥ 22, Playwright 1.58 + pixelmatch 5 + pngjs 7 installed in a scratch dir; Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` or set `executablePath`):

- `journey.mjs` — signs in with a synthetic sandbox account (`<name>@example.invalid`, DEV/local only: the code comes back in-band),
  walks home → project → review → collection room (real link + QR), then a participant context on a phone viewport through the
  real form (answers persist across reload), submit (real receipt), receipt-per-device, bad-code error, results/report/collect pages,
  back/forward and an unknown deep link. `BASE=<origin> EMAIL=<sandbox> SHOTS=<dir> node journey.mjs`. Exits 1 on the first failure.
- `measure-live.mjs` — rule 15: `node measure-live.mjs <canvasDir> <base> <outDir> <aid> <pid> <linkFragment>` with optional
  `AID2=<review with a built report>` and `ONLY=Board,Board`. Writes `board-*`, `app-*`, `diff-*` PNGs and `measure-live.json`.
- `boards.mjs` — reference renders of boards alone at the shipping viewports, light + dark, provenance off.

## Isolated synthetic data (what the harness actually used, 2026-10-22, local Worker)
The README's `migrate:local && … 0002_platform_ext.sql && seed:local` recipe names a file that does not exist; the procedure that works:

```sh
rm -rf .wrangler/state                                    # reset: Miniflare's local D1/KV/R2 live here
for f in migrations/*.sql; do npx wrangler d1 execute 3d-review-dev --local --file=$f; done   # 0001–0016 in order
npx wrangler d1 execute 3d-review-dev --local --file=seed/synthetic.sql
npx wrangler d1 execute 3d-review-dev --local --file=seed/synthetic-responses.sql
echo 'SESSION_SECRET=local-dev-secret' > .dev.vars        # confirm tokens (links, report build) need it; .dev.vars is gitignored
npm run build:next && npx wrangler dev --local --port 8787
```
Board-matching data for the measurement (project "Hindi New Testament", review "Mark 1–4 draft" with five surveys in collection,
review "Luke 1–2" with 18 responses and a built report) was created through the same `/v2` routes the current UI uses
(`/v2/auth/link` + `/v2/auth/session` sandbox sign-in, `/v2/projects`, `/v2/projects/:id/languages|assessments`,
`/v2/assessments/:id/surveys|stage|surveys/:sid/links` dry_run→execute, `/v2/participate/link|form|responses`).
Rebuilding `/next/` while `wrangler dev` runs can drop the asset until the dev server restarts.

Pins: cookbook canvas at the app PIN (`ui-next/design-source/PIN`); measurements cite the canvas commit and app head in `measure-live.json`'s
companion receipt in the cookbook unit.

## Measurement rules (2026-10-22, root plan step 5/6)

- `CHROMIUM=/path/to/chrome` overrides the Chromium binary in every script (another machine's Playwright cache).
- `measure-live.mjs` exits 1 when any requested pair has no board or measures above `LIMIT` (default 5%): a missing pair or a raw
  >5% is a failed run, never a skipped one. Participant screens are reached by their real prerequisite (answers for q/n and
  review; a real submission for the receipt), never by navigating to the route.
- `measure-qr.mjs <generatorDir> <base> <outDir> <aid>` is the like-for-like QR Room run: it reads the live room's encoder
  cells (same encoder: `app/data.js qrModules` = `ui/assess/vendor-qrcode.js qrcode(0,"M")`), writes `qr_data-runtime.json`,
  rebuilds the boards from it (`QR_DATA=…` → `build.py`) and measures 1280×800 and 390×844, light and dark, provenance off.
- `journey.mjs` fails on any page exception, console error or failed request (except the signed-out `GET /v2/me` probe and the
  deliberate bad-code 404), asserts each screen is the page and not the Status card, and reads the owner's survey counts back
  from `/v2` before and after the submission: exactly one open survey moves, by exactly +1; a new tab on the same link must show
  the same receipt id (server session via the device's remembered bearer).
- Board-matching seed: the boards draw from the cookbook's `generator/qr_data.json`, recorded by `qr-cells.mjs` from the exact
  seeded links (`identity.json`: host + the five real `#survey=` links of the local review `assess_3d1cbfb0-…`); a replay on a
  fresh local store regenerates that file from the new links (the token strings differ; n and layout are what the boards keep).

Local result 2026-10-22 (head of `ui-next-demo-wiring`, local Worker): QRRoom 1280×800 2.4% light / 2.4% dark; QRRoomPhone
390×844 0.5% / 0.5%. Earlier live pairs (before the shell-fill rule in `components/type.css`) are superseded and must be re-run.

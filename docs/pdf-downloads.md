# PDF download increment

Status: draft implementation. Local generation/transport tests do not establish DEV, production, or physical-phone acceptance.

## Binary endpoints

- `GET /v2/assessments/{aid}/surveys/{sid}/print.pdf?lang=en&paper=letter`
- `GET /v2/reports/{id}/pdf?paper=a4`

Both use the existing session/cookie or bearer. Survey roles and selected-template data come from `cap.survey.print`. Report access, current eligibility and suppression come from `cap.report.get`; full-detail export additionally holds if an included perspective is below the environment display minimum or has no snapshot evidence count; export never invokes report build or accepts report/HTML/answer input. Incomplete requested survey translations return an actionable 409 instead of an unmarked English document. A survey reuses an existing unexpired shared link where recoverable; export never issues a link.

Successful responses are `application/pdf`, an attachment filename, `private, no-store`, and checked `%PDF-` bytes. Rendering has a 30-second caller deadline, a 25-second provider navigation/PDF timeout, 2 MB HTML and 12 MB streamed-output bounds. HTTP/file/websocket resource requests are rejected and documents have a restrictive CSP. Fonts and QR images are embedded; report charts remain vector graphics. No PDF is stored by the application. The Browser Run binding has no AbortSignal argument: cancellation stops active response reading or cancels a late response, while an already-running provider job remains subject to its provider timeout.

## DEV runtime configuration (not deployed by this PR)

The top-level DEV Wrangler configuration includes a Browser Run binding named `PDF_BROWSER` on **3d-review-dev**. It becomes live only through the normal reviewed Git-connected configuration path; the named production environment does not inherit it:

```toml
[browser]
binding = "PDF_BROWSER"
```

The current compatibility date meets `quickAction`'s `2026-03-24` minimum. No API token or new secret is needed. Production is a separate gated configuration/promotion decision. Without the binding, otherwise-valid, fully prepared authorized requests return `PDF_UNAVAILABLE`; unauthorized requests retain their existing refusal.

Browser Run usage can incur charges beyond the account plan's included usage. The documented allowances are 10 minutes/day on Workers Free, or 10 hours/month plus 10 average concurrent browsers on Workers Paid; excess Paid duration is $0.09/browser-hour. This quickAction PDF path is charged for duration only, not the $2 additional average-concurrency fee that applies to Browser Sessions. These are documentation values, not an observation of this account's plan or remaining allowance. Check current [pricing](https://developers.cloudflare.com/browser-run/pricing/) before provisioning. No billing/resource mutation is included here.

## UI integration (shared files stay with their owner)

`ui-next/src/screens/actions/PdfActions.svelte` takes `url`, the existing `token`, and an optional `label`. Supply the survey URL above from the currently selected survey/language/paper, or the stored report id. The component discards prepared files when URL/session changes and aborts on unmount. It prepares asynchronously, then exposes explicit **Save PDF**, **Open PDF** in a separate tab, and **Share PDF** when file sharing is supported; the latter is a fresh user gesture for iOS. Preparation alone is never reported as a completed download. Preserve the existing Print fallback and the screen's one-primary-action contract when integrating. Do not mount a control with a fabricated report id or expose it across roles the screen does not authorize.

`ui/pdf/download.js` provides the same binary validation, object-URL lifecycle, sharing and cancellation primitives for other UI surfaces. Print and report screens are wired through Live using the current selection or authorized stored report id. The separately owned print toolbar/helper files are untouched.

## Local evidence

Run the focused Vitest suites `test/pdf-render.test.ts`, `test/pdf-routes.test.ts` and `test/ui-next-pdf.test.ts`, plus `node --test ui/pdf/pdf.test.mjs`. The route tests use a local synthetic D1 database and the real application auth/store handlers.

To additionally generate genuine binary endpoint artifacts locally, set `PDF_LOCAL_CHROME` to an installed Chromium executable and `PDF_EVIDENCE_DIR` to an absolute writable output directory, then run `test/pdf-routes.test.ts`. This explicit local binding substitute renders the actual server-generated HTML; it is not a live Cloudflare binding test. Its Hindi translation-memory strings are synthetic layout fixtures, not validated translations. `scripts/pdf-fixtures.mjs` separately creates readable English/Hindi survey and stored-report HTML fixtures for rendering and inspection.

Remaining before release: fresh exact-head reviews/checks, canonical release identity, connected-build/live binding checks and actual desktop/standalone-phone save/open/share behavior. Production follows only after DEV acceptance and its own gates.

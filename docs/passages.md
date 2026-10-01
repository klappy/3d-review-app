# The passage under review (files and links on an assessment)

Captain 2026-09-29 (BCS demo, Teryl): bring back the Lovable version's scripture files. Each assessment can carry the
passage under review — **USFM / SFM / USX text, a PDF, an MP3**, or **a link** (e.g. a YouTube video of the passage in
sign language) — and participants open it from the survey.

## Prior art
The Laos Lovable app stored `assessment_events.scripture_file_paths` in a **public** Supabase bucket (`scripture-files`)
and showed one "View Scripture Portion" button per file above every question (opens a new tab). Here files are
**private** in Cloudflare R2 and reach participants through **12-hour signed links** (HMAC with `SESSION_SECRET`), so a
passage is only reachable from its own survey; facilitators get 1-hour links.

## Facilitators
Prepare view → **The passage for participants**: upload a file (USFM, SFM, USX, PDF or MP3, up to 50 MB; the first bytes
are checked so a renamed file is refused), or add an https link with a title; each can carry a passage reference
("Mark 4:1-20"); Remove takes it away (the stored file is deleted). Up to 20 per assessment.

## Participants
A **The passage** card sits at the top of every survey screen: open on the welcome, folded to one line once the
questions start. Audio plays in the page (with seeking — the file route answers Range requests, which phones need);
PDF / USFM / USX, videos and links open in a new tab. Labels translate with the rest of the page. A USFM or SFM passage
opens as a **PDF typeset by PTXprint** (verses, not backslash markers) when one was made — see below.

## USFM/SFM → PDF through the PTXprint MCP server
Captain 2026-09-30 12:08 ET: "Use PTXprintmcp server that i use for converting the usfm/usx/sfm files to print/pdf."
On upload of a `.usfm`/`.sfm` file the Worker (src/ptxprint.ts) calls the PTXprint MCP server once
(`PTXPRINT_MCP_URL`, streamable-HTTP MCP, e.g. `https://ptxprint.klappy.dev/mcp`, no key): `initialize` →
`submit_typeset` with the file as a 10-minute signed `?raw=1` link plus its sha256 (the server's container fetches and
verifies it) → poll `get_job_status` → fetch the PDF. The layout is the server's own proven smoke fixture
(`smoke/bsb-jhn-empirical.json`: A5, two columns, Gentium Plus), copied to `src/ptxprint-passage-config.json`; only the
book (from the `\id` line; the 66 books, Paratext numbering) changes. The PDF is stored beside the original
(`assessments/<aid>/<pid>.pdf`) and `assessment_passage.pdf_key` names it (migration **0014**).
- `GET /v2/passages/:pid/file` serves the PDF for that passage; `?raw=1` serves the original text.
- Degrade, never a 500: URL unset, no known `\id` book, a failed render, over 30 s, a PDF over 25 MB, or 0014 not applied
  → the raw file stays, no `pdf_key`, one `passage.pdf` log line; the facilitator's card says "Text file" (else "Text · PDF").
- USX is not sent (the server documents USFM sources only); it stays a text file. Gentium Plus covers Latin, Greek and
  Cyrillic; other scripts need a font in the payload (follow-up).

## API (src/passages.ts; envelope `{ok, result}`)
- `GET /v2/assessments/:aid/passages` (viewer+) → `{ passages, file_storage, accepts, max_bytes }`
- `POST /v2/assessments/:aid/passages` (owner/member): JSON `{url, title?, reference?}` adds a link; any other body is
  the file itself with `?name=<file.ext>&title=&reference=`
- `DELETE /v2/assessments/:aid/passages/:pid` (owner/member)
- `GET /v2/passages/:pid/file?exp=&sig=` → inline, exact content type, `nosniff`, Range; USFM/SFM/USX served as
  `text/plain` with a sandbox CSP. The signature is checked first: only a missing, tampered or expired link spends
  `RL_HTTP_ANON` (audit round 1 W2 — a room of phones seeking in one MP3 shares an address)
- `cap.assessment.delete` removes the assessment's passage rows (removed ones too) and their stored files with it; the
  dry run's `impact.affected[0].passages` counts the active ones (audit round 1 W3)
- `cap.response.form` → `passages: [{id, kind, media, title, reference, filename, size, pdf?, href}]` (`pdf` on text
  passages: true when the link opens a PTXprint PDF)

## To turn files on (links work without this)
1. Apply migrations **0013** and **0014** to DEV and production D1; set `PTXPRINT_MCP_URL` per environment.
2. Create R2 buckets `3d-review-passages-dev` and `3d-review-passages`, then uncomment the two `r2_buckets` blocks in
   `wrangler.toml` (a binding to a missing bucket fails the deploy, so they ship commented).

## Next: built-in tools to read / listen / watch
- **Read:** render USFM/USX in the page as clean verses (chapter/verse markers, headings, no backslash codes) with a
  verse-range filter from the passage reference — e.g. usfm-js or Proskomma (6B borrow evaluation first).
- **Watch:** embed YouTube/Vimeo in the page (`youtube-nocookie.com`), captions on.
- **Listen:** verse markers / chapter chips on the audio; download for offline listening before a village visit.
- **PDF:** in-page viewer with pinch-zoom; printed forms can include the reference and a QR to the passage.
- **Paper:** print the passage alongside the printed survey.

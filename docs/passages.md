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
PDF / USFM / USX, videos and links open in a new tab. Labels translate with the rest of the page.

## API (src/passages.ts; envelope `{ok, result}`)
- `GET /v2/assessments/:aid/passages` (viewer+) → `{ passages, file_storage, accepts, max_bytes }`
- `POST /v2/assessments/:aid/passages` (owner/member): JSON `{url, title?, reference?}` adds a link; any other body is
  the file itself with `?name=<file.ext>&title=&reference=`
- `DELETE /v2/assessments/:aid/passages/:pid` (owner/member)
- `GET /v2/passages/:pid/file?exp=&sig=` → inline, exact content type, `nosniff`, Range; USFM/SFM/USX served as
  `text/plain` with a sandbox CSP
- `cap.response.form` → `passages: [{id, kind, media, title, reference, filename, size, href}]`

## To turn files on (links work without this)
1. Apply migration **0013** to DEV and production D1.
2. Create R2 buckets `3d-review-passages-dev` and `3d-review-passages`, then uncomment the two `r2_buckets` blocks in
   `wrangler.toml` (a binding to a missing bucket fails the deploy, so they ship commented).

## Next: built-in tools to read / listen / watch
- **Read:** render USFM/USX in the page as clean verses (chapter/verse markers, headings, no backslash codes) with a
  verse-range filter from the passage reference — e.g. usfm-js or Proskomma (6B borrow evaluation first).
- **Watch:** embed YouTube/Vimeo in the page (`youtube-nocookie.com`), captions on.
- **Listen:** verse markers / chapter chips on the audio; download for offline listening before a village visit.
- **PDF:** in-page viewer with pinch-zoom; printed forms can include the reference and a QR to the passage.
- **Paper:** print the passage alongside the printed survey.

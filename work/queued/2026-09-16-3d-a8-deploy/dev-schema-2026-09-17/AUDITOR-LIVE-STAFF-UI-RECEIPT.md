**seat: Auditor — coverage clarification + staff-UI continuation on DEV (same test window). Observed 05:55:48Z at pass start; UI run START 05:57:15Z → END 05:57:33Z.**

**Clarification, from the script:** in the live receipt 5709623832 the **staff** steps (sign-in, project/language/assessment create, template select, set_stage, issue_link, get_status, revoke, close) were driven by **API helpers (node fetch)**; only the **participant** legs (open link, form, submit, reload, reopen, revoked open) were real browser UI. Stated as the boundary it was.

**Staff-UI continuation (existing records only, no new records, no participant actions, no deletes):** one headless Chromium context, real navigation to the app root.
- Sign-in through the UI as `demo.owner@example.invalid`: "Request sandbox code" → the UI surfaces the dev code ("Synthetic sandbox code: [redacted]") → typed into "Use code" → `#identity` = **"user · person_mara"**, project cards revealed. `S1-signed-in.png`.
- Selected the existing project → assessment ("stage understand · exact role owner") → the single survey "Validation · closed" → "Check collection status" → **"Validation · closed · 2 response(s)"**. `S2-selected.png`.
- Stage control: chose "collect", "Move one stage" → `POST …/stage` 200 → "stage collect", survey "Validation · open". **Observed: the UI moved backward understand→collect and the server accepted it** — recorded as a fact for the stage-model owners, not judged here.
- "Preview survey link" → impact copy (irreversible, disclosure, compensating `cap.survey.revoke_link`, 300 s confirm) → "Create survey link" → `#share-url` shown with "Survey link created. Copy it now; it is shown once. Anyone with this link can answer. Revoking it stops new opens; it does not unsend." → "Copy link" → **"Link copied."** `S4-link-redacted.png` (URL blacked out).
- "Refresh counts" → **"Validation · open · 2 response(s)"**. Cross-check (the ONLY non-UI fetch, one GET from page context): `{responses:2, respondents:2, collection_status:"open"}`. `S5-counts.png`.
- Network (all 200): page + 7 static, auth/link, auth/session, me, projects, templates, project, languages, assessments, assessment, survey, stage, assessments, assessment, survey, links (dry_run), links (execute), survey (refresh), survey (cross-check). **No `/v2/participate/*` calls; counts 2/2 before and after.** Secrets scanned out of logs/receipt; UI shows responses only (respondents not surfaced — known row A9).

**Boundary:** every staff action above was a real DOM click/input; exactly one page-context GET as a count cross-check. **Left state:** assessment at **collect**, survey **open**, **one fresh active link** (05:57:31Z) — the UI has **no revoke control** (button scan empty), so per instruction it was not revoked via API. Moving the stage back to "understand" through the UI would re-close it; not done. Resting pending root's disposition; no broader build.

Residuals unchanged: raw `CODE: message` in `#error` on submit failures; `submitFailed` wording; `/v2/health` lacks a runtime build stamp; staff UI lacks revoke and respondents count.


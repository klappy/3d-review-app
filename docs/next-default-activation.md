# Next default entry — activation candidate

This preparation belongs to existing Summit optional item 13. Chris's latest
instruction is to switch **after the next production promotion**. It does not
authorize early activation or video work. The root bootstrap now calls the default-entry decision; production activation still follows the protected release path.

`ui/index.html` now loads `ui/default-entry.js` as its one application bootstrap. It is a
small client entry decision; it does not change API routing, cookies, session
tokens, invitations, surveys, reports, access rules or the existing UI internals.

## Prepared behavior

- Ordinary `/` and `/index.html` visits go to `/next/?ui_next=on` after a successful
  same-origin HEAD probe. Next's existing identity/session handling decides its
  signed-out or signed-in page. No legacy boot runs on the redirect branch.
- `/?ui=legacy` is an explicit current-UI entry. Existing root hash links also
  retain their current handler, including participant tokens, Access session
  returns, invitations, projects, assessments/reports and saved setup routes.
- Unknown query parameters remain with the current handler. This conservatively
  preserves return URLs, demo entry and other existing query contracts rather
  than guessing how to translate them. Presentation-only queries retain their
  bytes when forwarded. Explicit `/next/` and participant/PDF/API paths are not
  intercepted. This is a default-entry switch, not a migration of old deep links.
- `location.replace` avoids adding a root entry to Back/Forward history. A failed
  Next **entry HTML** probe or refused navigation falls back to the existing UI.
  A successful HEAD response does not verify JavaScript, bundles or app health;
  failures after navigation do not automatically return to the current UI.
  The promotion and wired browser acceptance must verify those assets and boot.
  No persistent
  default preference is introduced. The explicit Next query avoids an old DEV
  gallery opt-out taking over the new entry.
- The URL decision is checked again after the asynchronous probe. A newly
  selected survey/session hash, legacy opt-in or return query cannot be replaced
  by a stale default redirect.

## Activation dependency and controlled wiring

1. The coordinating release owner supplies the **next production promotion's
   live-verification receipt**: exact production commit/version/release pin,
   canonical connected build and active runtime identity, plus affected smoke
   results. A main merge, DEV health or an open production PR is insufficient.
   Prerequisite supplied and consumed: production PR #615 merged 2026-11-06 19:21:58 UTC; coordinator live health at 19:26 UTC reported `0.39.2+09eba5e`, commit `09eba5eaa6c3d32658ea580180cd0c32f0ddd771`, build `a85350b4-36e7-450f-8d8e-792d41a047d5`, D1 OK, trace `tr_cneU7jaM3oJAbr43`. This is coordinator-attributed evidence. Its source preceded #612; the activation branch instead incorporates current main `739506dd481a8e977bcd580313a451dcdca49705`, including #612 and #618.
2. Reconcile this preparation onto that verified source and preserve all owners'
   changes, particularly #612 and other coordinated Summit fixes. Refresh the
   existing canonical release/version/changelog chain; do not invent a second
   version authority.
3. Only then replace the root's final legacy bootstrap with:

   ```html
   <script type="module">import { bootDefaultEntry } from "/default-entry.js"; bootDefaultEntry();</script>
   ```

   Keep the legacy boot exclusively inside the fallback import. If the optional
   local `ui/server.mjs` harness is used, add its corresponding static JS mapping;
   Cloudflare's existing `./ui` asset directory already contains the module.
4. Recheck the actual wired build on desktop and mobile: signed-out root;
   already signed-in root; Next HTML and all referenced bundles loading; actual
   Next sign-in/sign-out and unchanged Access callbacks;
   explicit current/Next entries; all seven existing survey destinations; stored
   report and invitation links; return URLs; Back/Forward; offline/missing entry
   HTML, and the documented non-fallback on later JavaScript failure.
   Keep the seven existing tokens byte-for-byte. Do not mint, revoke or submit.
   Update the preparation-only inactive-wiring assertion to test the reviewed
   activated bootstrap. Unit history simulation is not browser acceptance.
5. Obtain independent exact-head review and finished ordinary checks, then use
   the protected main -> DEV -> separately reviewed production path. Verify the
   default only on the resulting live production identity. Do not merge or deploy
   this preparatory branch merely because its unit tests passed.

## Rollback

Restore the original root bootstrap:

```html
<script type="module" src="/assess/assess.js"></script>
```

Use the same protected corrective path and observe the resulting runtime.
No token, cookie, preference or data reset is necessary. Explicit `/next/` stays
available and existing root deep links keep their original handler. `/?ui=legacy`
also remains an escape route if Next JavaScript fails after a successful probe.

## Evidence limits

The preparation tests cover entry decisions, exact untouched URLs/tokens,
fallbacks, a simulated history stack and the fact that activation is absent.
Existing Next router tests remain relevant. No authenticated hosted browser, real-device or post-activation production result is claimed by the unit tests. Deployment evidence must be added after the protected release.

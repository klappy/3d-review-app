# Independent local browser harness amendment

Verdict: **ACCEPT, scoped to the browser harness substitution only.** No app implementation review, FIRE, browser-oracle PASS or deadline assurance.

Reviewed source hashes:
- Accepted shared-link plan: `9e7f444461c0d5d23167cb9989e0b7eedc89baa9d76823aac87f5de85aa8d94f`.
- Runtime/driver-seat receipt: `7186b1ce8e94371c1df39d0c688ef78562b059d4e0cea709618fbafc40e92ca7`.
- Read independent queue-resolution review including its final accepted-plan hash refresh.

The accepted plan explicitly permits a specific environment amendment when the original remote Playwright1.56.1/Chromium141 environment is unavailable. Using bundled Node24.19.0, Playwright/playwright-core1.62.1 and explicit cached Chromium153.0.8010.12 preserves the required browser mechanisms and does not alter the behavioral oracle. The reported launch/title/close probe establishes availability only; actual app/browser behavior remains unproved.

Credited use must preserve these existing oracle requirements:

1. Use the explicit recorded Chromium executable, not the failing default headless-shell lookup or an unrecorded fallback. Record actual Node, Playwright and browser versions in every independent receipt. No app package/lockfile change is needed or granted.
2. Run baseline and corrected candidate through the **same pinned harness/browser/context settings**. Browser runtime is a harness dependency, separate from the locked app/Miniflare toolchain; do not silently upgrade the application runtime. Baseline missing-token/same-respondent failures and candidate success remain independently demonstrated, with exact app/source pins.
3. Preserve two independently created browser contexts, not two tabs sharing a context. Preserve stale-global credential/key negatives, per-link sessionStorage, same-tab reload/draft/receipt checks, credentials-omit inspection, staff count+2, validation, closed/revoked/expired and race oracles. No reset/mocking away the behavior under test.
4. Explicit executable launch success cannot stand in for protocol compatibility or application results. If this Playwright/Chromium pairing fails an oracle or harness operation, record the failure and return that concrete amendment; do not skip the test or substitute a different runtime silently. Independent reviewer uses the same pin for reproducible comparisons.

This is meaningful baseline/current comparison for the accepted Chromium slice. It does not claim cross-browser/mobile/field acceptance. Existing owner ACKs, class/Design/migration custody, implementation gates, mandatory independent review and literal BugbotSUCCESS remain unchanged. This review resolves only the local browser runtime planning gate.

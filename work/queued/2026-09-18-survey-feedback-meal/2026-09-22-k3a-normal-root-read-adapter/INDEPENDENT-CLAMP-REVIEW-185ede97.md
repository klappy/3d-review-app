# Independent clamp review — AMEND

Observed 2026-09-22 15:12:17 UTC; exact app head 185ede97c22bbe5c4065f2738746019f2bbffb08. No product edits.

The two-path delta from 2e7e030 changes ui/index.html CSS and adds a rule/keyboard guard to test/kit-root.integration.test.mjs. Independently ran all 15 integration tests: pass. Copied stable harness output SHA256 6ddebe5e23ed247a0a2e60f9c50c59024e27e777bbdc514b054130f3aad44002. All 26 source module hashes/blobs and transformed actual root DOM/style prefix match exact source. Standard desktop/phone headers remain57/75px.

## Blocking finding: context covers account actions
Actual isolated Chrome at195x422 CSS pixels with long synthetic account email: open menu is correctly bounded x8–187, but the collapsed context overlaps it. Use another account center hits the September assessment context span, and Version center hits ASIDE. At standard390x844 with standard email, Use another account is likewise covered by the context span. At720x450 long email, Sign out and Use another account are covered. These are actual elementFromPoint hit tests and visually inspected screenshots, not a predicted overflow. This finding is not asserted to have been introduced by the clamp; the prior review covered keyboard focus, not these pointer hit targets.

Required bounded correction: establish proper menu/header stacking so every visible account action receives pointer input above context/content, retaining the clamp and keyboard behavior. Add an actual browser center-hit/click check at195,390,720px; a rectangle-in-viewport assertion or CSS regex alone does not prove usable controls. No live logout/switch needed: synthetic harness and safe test instrumentation suffice.

## Retained passing evidence
Long synthetic email was supplied by reviewer-only account-read response override through the actual controller. No stable bundle mutation or live request. At195px header185.625px and at390px long-email100.5625px; full email wraps. Density standard-fixture bounds do not apply to these stress cases per coordinator ruling. Menu width bounds pass; keyboard ArrowDown focuses Sign out then Use another account; Escape closes and restores toggle in all four cases. CSS-layout viewport emulates reflow at200%, not a claim of native browser zoom testing.

Artifacts: /tmp/k3a-review-185/identity-proof.json, tests.txt, measurements.json, narrow-results.json, hit-results.json, narrow.cjs, hit.cjs; actual PNGs phone200-open.png, phone200-closed.png, desktop200-open.png, phone-long-open.png, phone-open.png and desktop/phone assessment/project PNGs.

K3a completion/source handoff remains held for this concrete usability correction. Do not promote prior2e7 acceptance to this candidate or call Oddkit completion on the uncorrected product. Source roles/currentness/controllers are unchanged by this two-path delta. No broad rerun required after correction: exact delta/hash plus affected hit/keyboard proof.

# Independent K3a source and synthetic visual review

Observed 2026-09-22 15:03:26 UTC. Verdict: ACCEPT the bounded source/compact-chrome correction at exact app head 2e7e030f97afd4977ae7be61d17f4883e7d1ba8b. This is not full design-batch, live-provider or release acceptance.

## Independent evidence
- Detached exact-head checkout /tmp/k3a-independent-2e7; original Fable worktree and visible Chrome untouched. Diff from 8ae35465b2c9139116cf634a7fa38b528c2fbddd is exactly the authorized 13 paths.
- Immutable reviewer harness /tmp/k3a-review-2e7/index.html SHA256 61b58c69dc65a739f5c072259d08a9b6830c185cb22a4d4bbcec804dbb6d958d; transform c844abb9fe5b5d25add74a11e3510eb1c5ea4cd1c844c2338d0c3c12ce0e64ec. All 26 manifest module SHA256/Git blobs match exact source. Independently compared the entire 45,544-byte root DOM/style prefix after the declared stylesheet/title transformation; exact match. Actual ui/index.html SHA256 06077aeda1748ef21bd70c06c92596401314682df5f21d034e78cf027be45754. Did not independently rebuild esbuild0.28.2 output.
- Independently ran node --test ui/kit/app-adapter.test.mjs ui/kit/shell.test.mjs test/kit-root.integration.test.mjs: 42/42 passed. These cover stale route/retry, identity, late command completion, mounted content/controls, source roles and shell composition.
- Separate empty-profile headless Chrome actual synthetic root: desktop1440x900 and phone390x844. Four route measurements plus eight owner/member/viewer/direct-grant role-viewports. Network requests outside copied local harness were aborted; no live identity, logout or write.
- Header 57px desktop /75px phone. Assessment tabs y214–271 desktop, y304–395 phone; no horizontal overflow. Single assessment h1; no duplicate legacy context sidebar. Viewed actual desktop and phone assessment PNGs.
- Correct Owner/Member/Viewer labels, direct grant Viewer. Independently tested unknown, empty, constructor, __proto__, toString and null: no role label. No invented privilege.
- Account menu opens focusing actual Sign out; ArrowDown reaches actual Use another account; Escape closes and returns focus. Actual synthetic email remains visible and present in accessible subtree. On phone context opens and Escape returns focus to context toggle.
- Workspace owner view: one kit read card, zero duplicate management cards, one compact names-only management row with retained Remove button.
- Exact .assetsignore contains kit/app-adapter.test.mjs plus prior kit test exclusions. Author's reported HTTP asset proof was not independently rerun in this review.

## Artifact custody
Local immutable review directory /tmp/k3a-review-2e7 contains manifest.json, build-harness.mjs, measure.cjs, measurements.json, interactions.cjs, interactions.json, desktop/phone project and assessment PNGs, and eight role-view PNGs. These are actual saved images, not claimed source-only visual proof. Primary images: desktop-assessment.png and phone-assessment.png.

## Completion check and limits
Actual Oddkit validate at 2026-09-22T15:03:28.938Z returned VERIFIED for this explicitly bounded independent review with the actual PNG references. Debug shows zero fetches and filename extraction only; this is not independent image inspection by Oddkit and does not replace reviewer observations. The call explicitly said no current landed DOLCHEO was claimed. Coordinator must retain actual journal/completion custody.

Long-email/200% zoom remains separately author-owned pending its exact evidence. Native OS IME, provider account switch, deployment and whole K1–K6 parity are not passed here. Synthetic source/controller evidence is sufficient for the accepted K3a source handoff; ordinary current-head service/release gates remain. No source edits performed.

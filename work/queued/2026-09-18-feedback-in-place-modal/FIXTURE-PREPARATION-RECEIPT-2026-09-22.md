# PR159 fixture preparation checkpoint

Fixture-only FIRE 733f8bfa executed against immutable app 332b862903c2d3961681649d2d450fd7fe669e8a. All 340 tracked archive files byte-match Git after execution; only ignored identity output was stamped. No product edits, real credentials, live submission, or production mutation.

Local artifact home: /tmp/3d-review-159-normal-shell. Files: server.mjs, browser-check.cjs, route-contract.json, results.json, desktop-modal.png, phone-modal.png. Port 8899 was verified unused before binding. Server command: `node server.mjs --root /tmp/3d-review-159-normal-shell/source --host 127.0.0.1 --port 8899`. Browser command: `node browser-check.cjs --origin http://127.0.0.1:8899 --expected-head 332b862903c2d3961681649d2d450fd7fe669e8a`.

Actual Chrome 153, isolated synthetic contexts, desktop 1440×900 and phone 390×844: real root Projects shell and editable project field remain mounted and retain unsaved synthetic work through feedback modal Back/Escape. Draft retention and return focus passed. Pending response after navigation to Workspaces cannot reopen stale UI; already dispatched write is explicitly not claimed cancelled. A 503 retains uncertain draft without automatic retry. Two synthetic feedback sends per context; minimal feedback context excludes synthetic unsaved field content. No page errors.

Interception is installed before navigation. Only enumerated local static GETs and synthetic account/list/health/feedback routes are permitted. Deliberate unknown-local POST and nonlocal POST are both aborted before dispatch on each viewport. Source and fixture contract remain separate from live/provider proof.

LIMITATION: strict keyboard containment did not pass: one Tab position reports BODY on both viewports, then focus returns to dialog controls; no background application control was observed. Results deliberately record keyboardContainment:false rather than hiding this observation. Independent browser interpretation/review remains required. Signed-out/demo, identity replacement, and live participant/provider cases are not exercised here. This is a runnable normal-shell fixture prerequisite, not whole PR159 acceptance or product reconciliation FIRE.

Product ordering remains accepted161 main handoff →159 →K3. Independent harness validation is required before relying on this fixture for reconciliation.

# PR156 canonical DEV release receipt

Observed September21,2026 America/New_York (build completed2026-09-22T01:19:44.804Z). Release executor ui_audit actually acknowledged adopted9d388c9b disposition before mechanics. No source edits, settings changes, manual build/deployment, data publication, migration or seeding. Production candidate creation/merge is not performed; coordinator explicitly retained that next dispatch. PR159 remains open and untouched.

## Guarded merge and canonical deployment

Normal expected-head merge of PR156 d93fa68cce431881fd69723776fa26f0df5d768d to main succeeded at76fe13823dda23c9c046d2b44cdce94fc0842602. Immediate premerge: expected base2e9cb18b80dc60e93631dac56c8f2c2c3bd0ed36 unchanged; clean/mergeable; real Cursor Bugbot app1210556 and Workers app85455 both completed success on exact head,2 total; zero status contexts; one resolved/outdated grammar thread and COMMENTED review, no unresolved finding. Current coordinator custody and preserved159 re-observed. Corrective-control issue14 linkage: https://github.com/klappy/3d-review-cookbook/issues/14#issuecomment-5769835860 . No bypass or blanket hold lift.

Actual DEV trigger b82be56e-33f0-43d5-bf24-3749dd4dc168 was read before merge: main-only, existing npm ci/typecheck/test command and existing prepare-roadmap-deploy dev then wrangler deploy command. Observed push_event build119b0b41-d1c8-445a-9125-3f38b51351c3 at exact merge76fe138, stopped/success. Paginated build logs:54/54 test files,591/591 tests pass; stamp0.14.4+76fe138; deployment version3dbfda07-a49e-4904-8ec2-036e2675b720. Active deployment15bf4411-0e07-4586-bd62-8c45a73581a3 read back at100% that version.

## Accepted source and release identity

Full Git tree df7caca24120c9e4ace1ea41be67bf584001d7c4 is identical for reviewed d93fa68 and merged76fe138. Merge parents are prior main2e9 and reviewed d93. Effective version0.14.4; cookbook pin791b86cbcdfb4a8cbc492a2914dc6de9790d2b46. This is the exact complete source tree to compare for later same-version production; no cherry-picked subset acceptance.

Anonymous health on https://dev.3dreview.app/v2/health and worker alias reports exact version/build/commit/build_uuid/release_source, contractcontract-v0.1 and source_sha0f4413768c4365054372d917619311d7c2a00e96, D1ok. Canonical-domain8/8 asset byte comparisons match the accepted source: roadmap index.html (following its normal redirect), page.js, page.css, model.js, live.js, changelog.js, design-system tokens.css and components.css. Generated /changelog.json current0.14.4 includes pinned0.14.4 sections and preserves candidate/status/persona unknowns. Source hash/pin/history review remains in INDEPENDENT-RELEASE-REVIEW-2026-09-21.md.

Initial Python HTTPS client failed local CA trust; verified curl succeeded without disabling TLS verification. Initial index.html comparison did not follow its redirect and returned empty body; corrected to normal redirect-following GET then8/8 passed. These were verification harness issues, no product fix. Local read-only artifacts: /tmp/pr156-independent-20260921/live/health.json, assets.json, changelog.json, roadmap.json and verify-live.py. Local raw feed was not published to Git.

## Bounded rendered coverage

Actual native Chrome via CUA on https://dev.3dreview.app/roadmap/, current version0.14.4. Browser-tab adapters were unavailable; native browser worked. Desktop screenshot at768px window width and mobile responsive viewport390×844 observed. Screenshots are inline task tool evidence only; no local screenshot path or persisted screenshot is claimed.

Fixed live verification denominator:5 scenarios,3 passed/3 attempted/0 failed/2 untested:

1. PASS desktop lane navigation and visible semantics: Now selected initially; Future then Past selectable; Past24 (20shown), Now4, Future7. Legend states Done/Pending/Blocked reported progress with verification separate. Cards show explicit unknowns, badges, Status and distinct reported/not-verified lines.
2. PASS mobile lane navigation at390×844: Past→Now→Future selections and corresponding4/7 card counts visibly update; version0.14.4 present.
3. PASS mobile five-stage card matrix: actual Past card shows Planned/Built/Reviewed across first row, DEV/Production across second; readable within card, explicit Not reported and Done with not-verified separate. Status, blocker and next action visible below. No Production-column clipping observed in that mobile viewport.
4. UNTESTED live empty-lane behavior: real feed has no empty lane. Exact mounted empty-snapshot source test passed all3 grammatical messages during independent review; no live data was removed or injected to manufacture a case.
5. UNTESTED live Blocked-stage rendering: current real feed has55 done reports and1 pending, no blocked report. Exact Blocked automated regression passed previously; no live blocked-case claim.

Anonymous current feed cursor129/generation0,35items, full page item_next null; explicit placement counts24past/4now/7next. These differ from historical28-item author fixture, not an expanded combined denominator. Operational data still carries old contradictory/in-progress summaries (including156 awaiting build and130 future queue text despite Now); source presentation does not verify or repair that separately owned data. No publication or false attestation performed. No full-app acceptance, five-newcomer/creator re-run, real-human satisfaction, MCP host or user-outcome claim.

## Disposition and next gate

DEV live identity/source/deployment verified; affected3 attempted live presentation scenarios pass with2 named fixture-absent cases retaining automated coverage. No new adverse source finding. Built/Reviewed/DEV live are done for this bounded increment; Production0.14.4 pending. Production health remains0.14.3+0b798ce, buildd16a3609-e25f-4e24-88aa-655907515bc0 and oldc9045c2 pin, consistent with separately owned160; no production mutation here.

Return to coordinator: dispatch separate same-version0.14.4 production candidate with complete tree comparison againstdf7caca, independent exact-head review/checks, actual comment-only promotion evidence and candidate-specific disposition. Preserve159 and independent roadmap data/Fable work. Do not represent this receipt as production approval or closure of issue140/123/154 user outcomes.

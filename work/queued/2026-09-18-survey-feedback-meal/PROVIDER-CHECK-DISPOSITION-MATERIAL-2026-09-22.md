# Scoped provider-check exception material — 2026-09-22

PROPOSED disposition material, NOT an override or merge authorization. Chris's named exception decision remains pending. No GitHub/provider check has been rewritten or cancelled. Each candidate retains independent source acceptance and all other exact-head gates.

## Proven duplicate-completion cases

| Candidate | Exact head | Stale attached check | Provider terminal check | Same external build ID | Independent provider evidence |
|---|---|---|---|---|---|
| PR167 |318132de8082c36af3903be3ec006d688cdc7482|106621597153 IN_PROGRESS|106623029589 SUCCESS|398174c5-59cc-41f6-ae67-50046bd040bf|Cloudflare stopped/success2026-09-22T05:06:35.621Z; prior observed push-event preview, recorded in account161/DEV-167-DISPOSITION-2026-09-22.md at91dfbeae|
| PR169 |73a995e5903912d795bfb159d1e7e2587daa4917|106623342262 IN_PROGRESS|106625290252 SUCCESS|b4ce3edb-d3a8-484c-9ecc-d08baf12d7ab|Fresh05:19:40UTC direct GET build:stopped/success2026-09-22T05:18:10.419Z; matching head/branch|

PR169 Bugbot106624239869 is genuinely completed SUCCESS. Fresh PR169 head unchanged, filter=all total3 checks. Both Workers records have exactly identical external_id and details URL, not merely the same check name. Independent K2 source acceptance6165de20 remains exact73a995e. PR167 source/metadata acceptances and actual BugbotSUCCESS remain recorded separately; its earlier observation is not falsely relabeled a new poll.

Check URLs:
- https://github.com/klappy/3d-review-app/runs/106621597153
- https://github.com/klappy/3d-review-app/runs/106623029589
- https://github.com/klappy/3d-review-app/runs/106623342262
- https://github.com/klappy/3d-review-app/runs/106625290252

Build URLs:
- https://dash.cloudflare.com/b03e6ea242724c05eb97eb732cceb21d/workers/services/view/3d-review-dev/production/builds/398174c5-59cc-41f6-ae67-50046bd040bf
- https://dash.cloudflare.com/b03e6ea242724c05eb97eb732cceb21d/workers/services/view/3d-review-dev/production/builds/b4ce3edb-d3a8-484c-9ecc-d08baf12d7ab

## PR168 is not yet a duplicate-completion case

Fresh exact4c84d123e107a3ec99ebaa322a88dc7c16d45328: Bugbot106625299966 IN_PROGRESS and Workers106624870797 IN_PROGRESS. External buildc3a8c181-a817-48a8-8a27-9d429d0285ac directly observed RUNNING, no terminal outcome. This is real pending work, NOT eligible for any duplicate-completion disposition at this observation. Independent source ACCEPT7216dedf does not substitute checks.

## Governing boundary and recommendation

App docs/release.md Lawful corrective path4, blob9dbd8004c39eef155da772079cf6455ede874fd2: “Every attached check must finish; every adverse conclusion and review finding needs a recorded disposition.” Kitchen HYGIENE§3: “A named, logged override is the only bypass.”

Options: preserve literal gate and await legitimate provider synchronization; or named authority may record a narrowly scoped exception accepting the proved same-build terminal completion for ONLY each listed stale check at the listed exact head. This is an exception to the old attached-check state, not a declaration that it became terminal, not a fabricated SUCCESS, not a Bugbot waiver and not blanket future permission. Changed source or distinct/pending provider build requires new review. PR168 is excluded until actual facts warrant separately recorded consideration.

No callable provider check-resync operation was found in prior bounded API inspection. Manual builds, no-op commits and check fabrication are not proposed. Successful previews are not deployed canonical DEV proof. No candidate is merged by this packet; staging-base design integration and account DEV release keep their distinct coordinator dispositions.

## Later PR168 observation — still excluded

Exact4c84 has provider check106626139390 SUCCESS and prior106624870797 IN_PROGRESS, both external buildc3a8c181-a817-48a8-8a27-9d429d0285ac. Direct Cloudflare GET confirms stopped/success2026-09-22T05:22:28.981Z. However real Bugbot106625299966 completed NEUTRAL with finding4068661297 (search label/icon pointer leaves filtering deferred), and Autofix106626429620 is IN_PROGRESS. The independent composed-root defect also remains AMENDf435d7eb. Therefore PR168 is NOT proposed for exception or integration readiness; successful provider build does not waive source findings or active cloud custody. Coordinator routed any author correction to a separate isolated branch, preserving original168.

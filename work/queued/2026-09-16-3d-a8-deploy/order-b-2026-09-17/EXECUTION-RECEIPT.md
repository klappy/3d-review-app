# A8 Order B — settings-only execution receipt

Executor /root/queue_resolution/a8_inert_author. Actual START observed Oddkit 2026-09-17T04:40:29.967Z; final readbacks completed before observed 04:42:33.573Z. Within actual 20-minute estimate and 7-minute checkpoint. Root FIRE read at kitchen 1d364e0f23d322a450bfe0f11e27df242f559f49; accepted packet 7ada1b98f3733bb7b9691e95381a0473dc9060af. Root confirmed native Auth/Auditor/Design and root/API freeze ACKs. Root retains freeze pending independent verification; executor has not released it.

## Observed outcome

Settings-only steps1–6 completed. ExistingDEV trigger now watches main; existing production trigger now watches production. Newly created production ref is the exact empty 895339fb5a289b357148e7050447125791e6a411 ancestry, protected by active production-only ruleset 23578667 with no bypass and creation-status exemption false. Existing 23571595 main/phase0 rules and effective policy unchanged. Main remains empty 895339fb; phase0 remains 10f5f444d68475d7114ab8fe0bf269fe106476b1. No main population, merge, deployment, build start/retry/cancel, secret/binding/data/migration or production promotion was performed.

Fresh under-freeze BEFORE snapshot equaled the earlier preflight on all queried Git and provider fields. DEV complete listing 19 builds, all stopped; production 0; next_pagefalse and total counts match. Final listings retain the same IDs/statuses/timestamps/source/ref/SHA. No unexpected build observed.

DEV active deployment 450369eb-d0ef-41c1-af82-b0f28ded5cac/version038befe0-cf15-4c3d-b48e-021a7704f13e100%; production4a4d9869-62e8-46c8-acbd-3ef95db0fb42/version864f58cd-835c-4999-bc5d-0c9f987ebe77100%. Both unchanged at intermediate and final reads. This proves unchanged observed versions, not future inactivity or full application acceptance.

## Sequential action evidence

1.04:41:04.278862Z shell-clock request start: POST accepted production-only ruleset body. Response bound ID 23578667. GET and effective-production rules matched. Production absent; existing policy and empty main reverified. Expected documented server PR defaults present: required_reviewers[], allowed_merge_methods[merge,squash,rebase], require_extra_approval_for_unattributed_changestrue. No added creation/update restrictions. CF queues/deployments/triggers unchanged after this step.
2.04:41:25.090907Z shell-clock request start: POST create-only production ref 895339fb. Successful exact ref GET. No ref replacement/update.
3.04:41:35.733695Z shell-clock request start: PUT newly created ruleset using just-read supported request fields, changing only creation-check exemption false. Omitted unsupported returned extra-approval field from request; readback retained true. Full GET/effective rules checked, including strict real Cursor Bugbot 1210556 and PR/deletion/non-fast-forward policies. Only updated_at changed beyond the intended exemption. Existing 23571595 and main/phase0 remained exact. CF unchanged after bootstrap/tightening.
4. Oddkit observed 04:41:55.873Z before PATCH production trigger d067de78-0937-42cc-8f3e-cc001c4af8fc with exactly branch_includes[production] and trigger_name Production Deploy (production, via PR). Server modified_on 04:41:56.607Z. Full sequential trigger/queue/deployment readback matched only these two changes and modified_on. Main/phase0 refs reverified before DEV operation.
5. Oddkit observed 04:42:13.084Z before PATCH DEV trigger b82be56e-33f0-43d5-bf24-3749dd4dc168 with exactly branch_includes[main] and trigger_name Dev Deploy (main). Server modified_on 04:42:13.870Z. Full final provider/Git readbacks matched exact allowed deltas; final ruleset GET remained tightened.

No failure/retry/bypass occurred. GitHub/Cloudflare successful writes now provide actual operation capability evidence; earlier read-only permission observations alone did not.

## Comparison and custody

The complete trigger objects preserve Worker IDs, build-token association, repo connection and its metadata, commands, root directory, branch exclusions, path filters, caching, created/deleted timestamps. Only intended branch/name and top-level modified_on differ. Build listings preserve every returned row's ID/status/outcome/creation/modification/source/ref/SHA, plus full pagination metadata; irrelevant repeated historical trigger/message payload was compacted to avoid tool truncation. Active deployment objects preserve full latest returned object. No secret values were requested or retained.

BEFORE.json, AFTER.json and REQUEST-RESULTS.json are the declared receipt product. Intermediate readbacks and exact request bodies are adjacent. Shell timestamps are labeled as directly observed system time; Oddkit observations bracket the run. No background monitor or quiet-period guarantee is claimed.

## Remaining boundary

Root must independently verify execution and decide freeze custody. Whole-baseline/main integration remains separately gated, including exact-head independent review, literal BugbotSUCCESS, terminal checks/findings and prospective hold disposition. These settings do not accept API/UI/Auth, A8 as a whole, runtime version stamps or collection functionality. Production stays captain-owned and no production delivery occurred. Any later main merge is intended DEV delivery under its separate accepted order.

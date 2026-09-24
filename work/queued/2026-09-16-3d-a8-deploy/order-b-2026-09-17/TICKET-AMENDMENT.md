# A8 Order B settings-only amendment v1.0.0 — 2026-09-17

What this is: Correct existing Git protection and Cloudflare trigger mapping, leaving deployed applications and data unchanged.
Why now: Chris settled main→existingDEV and productionbranch→production; current production listener still watchesmain.
Your move: Root lands this packet, obtains remaining controller freeze ACKs, then explicitly fires the named executor for accepted readiness steps1–6 only.

Class: entrée. Risk: ALLERGY. Station: Otto infrastructure coordination. Owner: Astra. Executor: /root/queue_resolution/a8_inert_author. Promise: actual20minutes from FIRE, checkpoint within7minutes; excludes drain/PR3review/buildduration. OriginalA8 90minute history preserved, no reset. Depends: accepted OrderA pair/remote checks; independent OrderB review; actual main/phase0/build-control freeze ACKs and immediate executor snapshot. Product handlers/UI work is not a dependency of settings-only correction; broader A8 remains open.

Bounded ingredients: app22 exact78d009157e19c9f3e5180db42ebb41b5d6e9174f, cookbook35 exactecab91ae12f7361f1b8d273b15c095c681a67445; accepted readiness hash a8a88b5df6f50fbf542a242d692dc50503906f021f148b17f1c34cbd3b3a6f60 and INDEPENDENT-ORDER-B-REVIEW.md. Root chooses NO OrderA merge into phase0 before this cutover. No app/code/recipe merge occurs in this order. Current remote exact heads remain open; checks refreshed04:24Z show completed Cursor BugbotSUCCESS(appID1210556) on both; cookbook also two completed frontmatterSUCCESS. Both PR reviewThreads arrays empty with hasNextPagefalse.

Prospective settings-only scope for root disposition: use accepted payloads to add production-only ruleset, create protected emptyproductionref at895339fb, immediately tighten creationstatus exemption, detach existingproductiontrigger→production, retarget existingDEVtrigger→still-emptymain and read back. STOP after readiness step6. No step7/main population; no PR3merge; no OrderAmerge; no productionpromotion, buildstart/retry, manualdeployment, secret/binding/migration/data changes. Existingmain/phase0rules unchanged. Cancellation is not preauthorized: currently no target; newly active builds drain or return for specific disposition. Any rollback mutation is separately dispositioned, never restoreproduction→main.

Freeze custody: root freezes own shared app writes. Native controller requests app3c5708453632/cookbook14c5708453849 are PENDING here, not ACKs. Required actual return binds no main/phase0 merges/pushes and no operations on either buildtrigger for the bounded window; isolated Auth/API/UI work continues. Executor refreshes complete queues/refs/effective rules/fulltriggers/deployments after ACKs and before first mutation; historical observations cannot satisfy this.

Declared receipt product in existing A8 order-b-2026-09-17 cargo: EXECUTION-RECEIPT.md, BEFORE.json, AFTER.json, REQUEST-RESULTS.json (redacted; identifiers not secrets). Include exacttimes/actionIDs, rulesetID,response-boundproductionref, allqueuepages, activeversions, expectedmodified_onchanges and unchangedrequestfields. Owner updates shared journal. No new framework/backlog.

Done-means:
- Root can read actual controller ACKs and observe bounded shared-write/build-operation freeze without stopping isolated source work.
- Executor can read complete fresh queues and observe no pending old-target build before retarget.
- Reviewer can queryproductionref/effective rules and observe empty895339fb ancestry, strictrealBugbot/PR protection, no bypass and creationexemptionfalse.
- Reviewer can read both existingtriggers and observe production→production, DEV→main with commands/filters/token/repo associations unchanged.
- Reviewer can read activeversions and observe unchangedDEV038befe0 and production864f58cd, with no newbuild caused or tolerated silently.
- Root can inspect finalreceipt and observe mainstill895339fb, no merge/deploy/migration, and explicit release-or-retain freeze decision.

## Failure Modes — What Breaks When a Listener Moves Before Its Queue Is Safe

MissingfreezeACK; newhead/ref/rule drift; incomplete/activequeue; API403/refusal; bootstrap/tightening mismatch; unexpectedbuild/version; unexplainedsettingschange.

## Required Response When Detected

MissingACK→do notfire. Head/ref/rule drift→stop,reconcile exactchange beforewrite. Incomplete/activequeue→complete/drain, no speculativecancel. APIrefusal→stop,noalternatecredential/bypass. Bootstrap/tightenfailure→leaveemptyrefunchanged, noattach/mainwrite. Unexpectedbuild/version→stopmainwrites, inspectsource and escalateexactrecovery; cancellationaloneisnotrecovery. Settingsdrift→stopcompare; no blanketmetadataignore. Preserve dataandversions. Never restoreproduction→main.

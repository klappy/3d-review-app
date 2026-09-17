# Release-governance correction — review only

Owner: Otto-delegated bounded worker; coordination home: cookbook issue 14. Base: app `518e083aee6395fef144f8705b888d1d76941ff7`. Observed gate timestamp: 2026-09-16 20:28:58 America/New_York (`2026-09-17T00:28:58.267Z`).

## Cargo and proof

Adds repository boarding bindings, release runbook, promotion comment-only Bugbot policy and an unapplied ruleset proposal. README gains the release pointer. No runtime, auth, contract, UI, report, data, version or trigger change. Existing worktrees are untouched; this isolated clone is `/tmp/3d-release-governance-0916`.

Author checks: `git diff --check` and JSON parse passed. No runtime tests claimed for this documentation-only change. Independent review and current-head Cursor Bugbot remain pending; no merge, deploy, rule application, hold release or full-app acceptance is claimed.

Fresh reads: Cartographer `read_repo_file` returned exact DEV `wrangler.toml` at the base SHA; GitHub API returned no rulesets and unprotected `main`/DEV branches. Exact base check-runs contained only successful `Workers Builds: 3d-review-dev`, not Bugbot. The proposed app binding comes from coordinator observation of Cursor App `1210556`; independent review must verify it before application. Cloudflare trigger values in the runbook are explicitly Otto-attributed.

## Review reasoning and limits

Driver-seat walkthrough: a future releaser could mistake a GitHub green merge flag or this new instruction file for permission to merge. The runbook therefore begins with the active freeze, makes head changes invalidate receipts, separates policy from actual Autofix configuration, and requires deployed API/MCP plus human-browser evidence. Native GitHub required checks accept neutral/skipped; the runbook now explains why the proposed ruleset cannot prove literal SUCCESS. A synthetic success proxy was rejected because it would hide the actual review conclusion. A larger custom enforcement service is outside this bounded proposal.

Oddkit preflight ran. Initial gate queries misclassified the transition; their completion verdicts are discarded. The corrected planning-to-execution gate passed 4/4 using knowledge-base governance at the timestamp above, before file authorship. Oddkit challenge returned non-blocking CHALLENGED (not approval): its evidence/scope/reversibility prompts are addressed here and in source links. Proposal is reversible until applied; application remains separate and can disrupt direct-push workflows, intentionally requiring PR review. If current app IDs, branch topology or GitHub semantics differ, revise the proposal before applying it.

Loop 1: the recorded three premature merges remain violations; this work does not rewrite history. Loop 2: missing repo bindings and unenforced branches let a mergeable UI outrank kitchen policy; proposed controls make the policy visible and partly enforceable. Loop 3: review must test the control's limits, not just the document's existence—especially neutral status and service-side Autofix behavior. Otto/Auggie return these findings to the existing cookbook/rail learning record; this worker does not own those shared writes.

Boarding limitation: live recipe, identity, STACK, CoS card, model contract, HYGIENE and companions were retrieved, but RULINGS/LANES were initially guessed at repository root (404) and then recovered from `health-code/`; exact line-check order was not achieved. No claim of pristine first-touch compliance. Journal persistence is delegated to Auggie; these are worker cargo observations, not Kirigami-validated journal rows.

## Independent review amendment

Otto returned CHANGES REQUIRED on the first proposal: requiring one GitHub approval and approval of the latest push would introduce a separate-account/human dependency because current agents share the author account. No authority for that extra gate was established. Revised `required_approving_review_count` to `0` and `require_last_push_approval` to `false`; PR requirement, actual Bugbot app requirement, conversation resolution, and independent exact-head review evidence remain. No ruleset was applied. This amendment needs fresh applicable checks and review at its new head. Added the coordinator-attributed exact DEV build/version/deployment linkage; did not change any trigger.

## Applied settings receipt amendment

Earlier “unapplied” statements above describe the authoring checkpoint. After independent review of `0e6562e`, Otto reports one ruleset creation, ID `23571595`. This author independently GET/read back the active rule, exact targets, no bypass actors, current-user bypass `never`, and both branches protected. GitHub supplied three default parameters; the initial full-dictionary comparison failed because of those additions, with no retry mutation. Official documentation explicitly establishes that extra approval for unattributed Copilot PRs has no effect with required approvals zero. The original request JSON remains unchanged as provenance. Root separately reports scoped Cloudflare deploy-command correction with exact readback and no build/deployment change. No merge or promotion is claimed; literal SUCCESS and all remaining hold conditions still govern.

## Local integration checkpoint after PR #10

Preserved original `89abccb` checkout. New isolated `/tmp/3d-release-integrated-0916`, branch `governance/release-integrated-0916`, incorporates exact DEV `7f454791867d6b1ab83a170045c2a7e48931b529` with a history-preserving merge. No conflict: DEV’s four auth/interface/test paths and governance’s six paths do not overlap. Current runbook now distinguishes PR #10’s narrow prospective DEV correction from the continuing general hold and marks the `518e083` deployment linkage historical. Deployed PR #10 status is Otto-attributed. No shared merge or feature push; new independent review and fresh remote Bugbot remain required.

Integration verification observed 2026-09-16 20:43 America/New_York (`2026-09-17T00:43:29Z`): full repository suite 41/41 across 17 files, typecheck, JSON parse, relative Markdown link existence and whitespace checks passed. These are author integration checks; independent review and fresh Bugbot remain pending.

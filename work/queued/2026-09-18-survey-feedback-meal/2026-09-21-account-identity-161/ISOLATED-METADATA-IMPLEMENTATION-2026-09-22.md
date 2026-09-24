# Isolated 0.14.5 metadata candidate — 2026-09-22

Author orphan_audit. Independent metadata acceptance pending.

PR167 https://github.com/klappy/3d-review-app/pull/167 targets main76fe13823dda23c9c046d2b44cdce94fc0842602. Exact head318132de8082c36af3903be3ec006d688cdc7482, treee1e6381448ffac0bb859dfca77d9020d5fad6b48, branch release/0.14.5-isolated-account-2026-09-22. Parent lineage preserves independently accepted9cf345f8 and all original cloud commits. PR163 and166 branches untouched. Thirteen total paths versus main = seven existing functional paths + six scoped metadata/test paths; no new runtime source here.

## Canonical merge and exact pin

Cookbook PR101 merged by ordinary expected-head API at97af53e83624d3992884ad1d2520b34bd61b74af. Immediately beforehand c04e816 was unchanged, mergeable/clean, independent ACCEPT5f120cd4 observed, literal Bugbot106620629806 SUCCESS and frontmatter106619495395/106619485975 SUCCESS. No bypass; original branch retained. Unicode false-positive resolution and coordinator custody disposition are in CANONICAL-MERGE-DISPOSITION-2026-09-22.md at0b9e9034. Fresh service rerun—not thread resolution alone—satisfied the check.

Merged canonical record and index equal reviewed copies byte-for-byte:
- record blob91bea67f49a04d7cf59579d014bb3b9cff90f061; SHA256 c994a98623c2692fd5e81fbeee9c3e0d6b7bee936eb1f2c79cbf27db887367c7.
- index blobc381466dfc0054473c5bd648809b6294a5531b88; SHA256 c9831b19f1c1ff53f8741b6e0f533a0be19d16d7b00b7c55f39af1fa8a5f2eb6.

Five authorized paths are release/cookbook/0.14.5.md, release/cookbook/releases.json, release/release-manifest.json, package.json and package-lock.json. All five Git readbacks byte-equal prepared files at318132d. Package files differ only root/current version0.14.4→0.14.5, including both lock version fields.

## Narrow sixth-path amendment and validation

Actual first version-suite run exposed seven expectations hardcoded to the prior0.14.4, plus three failures caused by archive scratch lacking Git. Coordinator expressly authorized test/version-stamp.test.ts only for current0.14.5 expectations, preserving negative/history assertions. Exact diff is twelve literal0.14.4→0.14.5 substitutions; no assertions removed, no stamp/runtime/config change.

Validation rerun in a real clone /tmp/3d-161-release-git at exact318132d:
- npm run stamp:0.14.5+318132d with merged release_source97af53e.
- npx vitest run test/version-stamp.test.ts:16/16 pass.
- npm run typecheck:pass.
- Git diff against9cf:exactly six files. node_modules is an untracked dependency symlink, not candidate cargo.
- Prior48 affected UI tests and meaningful old-source failure proof remain independently accepted bd00e1f9. No new whole-suite/browser pass claimed.

## Remaining gates and provider validation

Independent six-path metadata/test review; exact current PR167 checks; fresh PR163 cloud comparison and coordinator integration disposition; normal guarded main merge and canonical Git-connected DEV build/active health pin proof. PR166's independent source branch already has real Bugbot106619204458 and Workers106619911508 SUCCESS, which do not substitute PR167 checks.

After DEV deployment, use a separately authorized test-browser/account journey: verify account email matches current Access identity; actions reachable on affected routes; actual account switch returns existing workspace/project/assessment. Failed revocation retaining usable session and stale completion preserving a newer identity have meaningful synthetic/source proofs and must not be represented as real-provider fault-injection results.

Unavoidable human/browser boundary: entering the intended account at the Access/identity-provider login and deliberately authorizing provider-wide logout in a suitable test session. Chris's current session is not a logout fixture. No credentials, private identity or entity names in public receipts. Actual provider forwarding/switch cases remain pending; production requires same validated version/source/pin plus actual comment-only service-setting evidence before shared-head promotion. No manual deploy, data/grant write or implied production acceptance.

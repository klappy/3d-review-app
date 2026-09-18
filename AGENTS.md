# 3D Review working agreement

This app answers to [klappy/kitchen](https://github.com/klappy/kitchen). Fetch its current `health-code/HYGIENE.md` and applicable companions before work; this pointer does not freeze upstream law.

- **HYGIENE 3:** PR review and finished checks gate every non-rail change. Real `Cursor Bugbot` must conclude `SUCCESS` on the exact current head; all attached checks finish and findings receive dispositions. No self-issued override.
- **HYGIENE 10a:** deployment happens only through the Git-connected Workers Build. No seat runs a deploy or uploads a Worker version.
- **Topology:** `main` → existing DEV; `production` → production. Provider cutover remains separately gated; the captain owns production promotion. An explicit staging branch/app is optional future scope only if needed.
- **HYGIENE 19:** `package.json` is the version source. Production promotes the same semantic version, canonical release pin and product source already validated in DEV; no promotion-only bump. Actual fixes go through `main` and DEV first. Build/client evidence must prove the manifest-derived `<version>+<sha7>` stamp. The current cookbook HYGIENE §10 standing rule supersedes the earlier every-promotion bump requirement.

The repo-specific procedure and current promotion hold are in [docs/release.md](docs/release.md). Read it before any release action. Do not interpret this documentation as lifting that hold or proving version-stamp machinery exists.

Coordinate claims in [cookbook issue 14](https://github.com/klappy/3d-review-cookbook/issues/14). Preserve Fable's auth/contract ownership, delegated report ownership, Design/Grok claims, dirty worktrees and historical evidence. Steve Watters's full `3d-quality-review` work is the source baseline; unresolved contradictions are explicit tensions, never permission to invent scoring.

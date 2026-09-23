# Playable preview delivery — September 9

## Current status — September 10 documentation closure

PR10's separate study and PR11's hosted delivery are complete. The last recorded live proof is September 9, 10:04–10:06 EDT; bounded desktop JavaScript passed. Physical iOS, full visual/persona review and captain acceptance remain unverified. See [LEARNING.md](LEARNING.md) for this learning review and [Claude handoff](../../meals/2026-09-08-3d-scenario-ux/CLAUDE-HANDOFF.md) for current follow-up scope. 

## Historical author and delivery checkpoints — preserved

Statements below such as pending checks, no hosting, or missing browser evidence describe their original phase. They are superseded by the dated live-delivery evidence, not current blockers.


## Current checkpoint

PR11 is open at 101e8c9165212d0be308d10583bb2cf2bb344174. Eight files read back exactly. The author and independent reviewers ran 93 Worker request assertions successfully. CoS independently reviewed the hosting package and exact one-line welcome navigation amendment; Otto independently reviewed payload/security/configuration. Two frontmatter checks finished successfully; Cursor Bugbot is still running. No merge, new deployment or browser completion is claimed here.

## Intended live routes

- https://3d-review-showcase.klappy.workers.dev/ — restored welcome as the initial greeting.
- https://3d-review-showcase.klappy.workers.dev/3d-review-glass.html — glass sample assessment.
- https://3d-review-showcase.klappy.workers.dev/app-flows/ — separate app-flow study.

The greeting adds only “Explore the app flows →”. The explicit build allowlist excludes all source transcripts, planning and source maps. Existing glass, CSS and app-flow bytes stay unchanged; updated welcome SHA256 is 66687c2d14cdc6bf4f664810cd14ad0374b0b2e2a8faab407337cedc1c36b75a. Glass SHA256 is 40a221533a8c720753cdba9f5f440d72dc16b2a4bcbbc54c00ce974e2218ee75; app-flow is bee775fe4270cbc044dc9060456b0e3cc32669ff80cfc9e82bd1736c589a2942.

## Remaining delivery gate

Exact-head Bugbot success, governed merge, Git-triggered build/deployed-version observation, HTTP asset identity and live JavaScript journeys. Browser/mobile appearance is not proven by Worker request tests. The existing initial review checkpoint produced candidate files before its ten-minute bound; attached external checks remain visibly running.

## Merge checkpoint

Exact-head Cursor Bugbot and both frontmatter checks finished SUCCESS. PR11 merged at 45eb3623bbde28f56d04d8962ee9b7a32d6329c0. Otto is observing the configured Git-triggered build; live runtime and JavaScript verification remain pending. This supersedes the earlier running-check paragraph, not the remaining live-delivery gate.

## Deployment and public-byte proof

The connected main build c0cceba5-69fa-46e5-9b37-7014dd56ec8a completed SUCCESS at 2026-09-09 10:04:30 EDT from merge 45eb3623bbde28f56d04d8962ee9b7a32d6329c0. Deployment 1de4b97d-62ca-4742-ad62-20b216a7b2b0 serves Worker version 8ff732a1-92c5-4954-9a2e-d42340aed46e at 100%. Postmerge frontmatter also succeeded. This was the configured Git build, not a seat upload.

Otto fetched four live assets and matched their exact reviewed SHA256: welcome 66687c2d14cdc6bf4f664810cd14ad0374b0b2e2a8faab407337cedc1c36b75a (12076 bytes); glass 40a221533a8c720753cdba9f5f440d72dc16b2a4bcbbc54c00ce974e2218ee75 (37768 bytes); CSS 4adfb1a013bf34291f400683cc3b7d5c07c0a97905e89e7cd93c53af1343abba (3957 bytes); flow bee775fe4270cbc044dc9060456b0e3cc32669ff80cfc9e82bd1736c589a2942 (28325 bytes).

Live negative checks passed: source-map path, transcript path and old showcase/core.js all404; POST root405; /app-flows?sample=1 redirects308 to /app-flows/?sample=1. Headers permit retained inline JavaScript while denying network connections, form submission and framing; no-store avoids stale HTTP preview caches. Runtime/source identity is verified; browser interaction evidence follows separately.

## Live browser delivery — PASS

CoS independently exercised the deployed pages in desktop cloud Chrome during 2026-09-09 10:04–10:06 EDT: root rendered the restored greeting and new app-flow link; Show me how opened step1/5 and Back restored the greeting; Browse a sample assessment opened /3d-review-glass.html and its Collect button rendered collection content. The greeting's actual app-flow link opened /app-flows/; assessment Collect opened, the Translator survey dialog opened, and its participant link reached #participant/a1/Translator. Selecting Somewhat familiar and submitting produced Response received with the saved value.

This proves the requested playable hosted delivery, not physical iOS, persona review or full visual/product acceptance. Those are not silently claimed. The ticket is plated for its bounded synthetic artifact and live-preview delivery; the captain may now steer the experience. No new analysis or learning queue was started.

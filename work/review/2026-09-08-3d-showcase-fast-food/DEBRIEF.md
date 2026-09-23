# 3D Review showcase — deployment receipt

Live: https://3d-review-showcase.klappy.workers.dev/
Deployed 2026-09-08 17:14 America/New_York, captain-authorized Cloudflare Workers showcase.
Worker: 3d-review-showcase. Deployment ID: 8d33518c615c4f6bb8ad6bdda7e0426c.
Source commit: eeb08988760d6e406212b99c60af73b72746ae5a, cookbook branch design/2026-09-08-scenario-ux, PR6.

## Verification
Cloudflare upload and workers.dev enable returned success. Initial propagation request returned 404; subsequent live GET at 17:15:24 returned HTTP 200 and HTML identical to saved showcase/index.html. Correct HTML content type, noindex, no external connections permitted by CSP. Local Worker checks cover root, unknown route 404 and unsupported method 405. Existing interaction-script and proposal-model checks pass; no browser-render proof claimed.

## Scope
Only the standalone synthetic walkthrough is served. Source transcripts, whiteboards, private repo documents and real project data are not deployed. No login; link is publicly accessible. Feedback is requested from reviewers through the person sharing the link; no feedback form/storage is implemented. No new paid plan, bindings or existing service changes.

## Reproduce / rollback
Worker source is worker.mjs, generated from index.html; wrangler.jsonc identifies the isolated worker. For edits regenerate embedded HTML, test and deploy this worker only. To unpublish, disable this worker's workers.dev subdomain; no shared domain or existing service route was modified. Preserve Git source and deployment receipt. This deployment does not ratify unresolved product permissions or merge PR6.

Cookbook PR: https://github.com/klappy/3d-review-cookbook/pull/6

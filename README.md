# 3D Review App — integrated slice

This branch connects a browser client to a Cloudflare Worker and persistent local D1. It consumes the draft capability registry under `contract/`; it does not claim full product parity.

## Local run

```sh
npm ci
npm run db:local
npm run dev:api
# in another terminal
npm run dev
```

Open http://127.0.0.1:5173. The clearly labeled local synthetic session is not Cloudflare email sign-in. Production authentication remains unavailable until the actual provider settings are verified; no fallback local identity is allowed there. The D1 ID in this configuration is a local placeholder, not a deployed database.

```sh
npm run test:backend
node scripts/smoke.mjs
npm run build
npm run check:worker
```

The smoke journey creates a synthetic project, language, assessment, selected template, confirmed code export, participant submission and stable replayed receipt. It checks participant isolation and an honest policy-held summary. Scoring policy is unresolved; counts are synthetic persistence evidence, not computed quality results.

Known browser defect: after reloading a saved assessment, the persisted result remains available but the selected survey is not restored to the UI. The assessment API returns a `surveys` array while the current client looks for a top-level `assessment_survey_id`; issuing another code from that reloaded screen is blocked. This draft preserves the working local slice for reference and is not the coordinated phase-0 implementation branch.

Implementation branches preserve the existing Fable contract files. Production bindings, real email-code sign-in, delegated agent authorization and deployment require their actual configuration and separate verification. No real participant data belongs in this repository or local fixtures.

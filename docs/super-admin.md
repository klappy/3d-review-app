# Super admin — what it opens and how it is switched

Super admin is the existing support switch on an account (`principal.support`, read in `src/auth.ts`). There is no separate super admin role yet; a scoped admin role is later, planned work.

## What it opens

Everything a support principal can do (`src/policy.ts`, `authorize`): every workspace, project and assessment, reads and writes, template publishing and participant unlock — plus the app-wide totals read `cap.ops.usage`. An agent connected as that account through the MCP connector acts as that account and holds the same access. Writes still leave receipts. `docs {topic: permissions}` says the same to callers.

## `cap.ops.usage`

`read {capability: "cap.ops.usage", params: {from?, to?}}` or `GET /v2/ops/usage?from=YYYY-MM-DD&to=YYYY-MM-DD`. Support only: a signed-in non-support caller gets `NOT_AUTHORIZED_AT_SCOPE`, an anonymous caller `NOT_AUTHENTICATED`. Counts and dates only; field definitions are in the capability's `docs` page (`docs {capability: "cap.ops.usage"}`). `from`/`to` bound the per-day requests and writes (default: the last 30 days); totals are all-time.

## Switching it on or off

One recorded step, never hand-written SQL:

```sh
node scripts/super-admin.mjs on  --email <account> --by <operator> --env dev            # dry run: prints current state and plan
node scripts/super-admin.mjs on  --email <account> --by <operator> --env dev --apply    # switch + receipt, then read-back
node scripts/super-admin.mjs off --email <account> --by <operator> --env dev --apply    # the inverse
```

- The account must have signed in once. Emails are normalised and hashed locally, as sign-in does; no address is sent or stored.
- `--apply` runs one batch: a `receipt` row (`capability` `script.super_admin.on|off`, `actor` = the operator's account id, `scope` = `principal:<account id>`, `prior_state_json` = the old switch) and the flip. Already in that state → no change, no receipt.
- `--env production` targets the production database. Production flagging is the product owner's call; the script records who ran it, it does not decide who may.
- Needs `wrangler` authenticated to the Cloudflare account. `--local` targets the local dev database.

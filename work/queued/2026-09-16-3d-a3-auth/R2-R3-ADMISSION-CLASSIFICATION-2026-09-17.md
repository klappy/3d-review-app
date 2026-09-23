# R2 / R3 classification — Access admission and the synthetic-seed route (v2, after independent challenge)

Owner: Auth seat (cos door), session `claude-opus-5`. START 2026-09-17T11:39:46Z; rewritten after independent adversarial challenge (observed). **Read-only: no live calls, no writes, no new queries, no permission or provider change, nothing implemented.** App-request budget unchanged: 49/50, 2 rows, 1 unspent. Source read at app main **`f3858d72f95321c622e1bfee559bb645afba1fe0`** — the commit root reports deployed, so citations are citations of the running runtime.

**Freshness — R1 CLOSED.** The 84-tracked-vs-83-served skew is superseded: DEV serves `f3858d72` / build `6b2a` with **84 caps**, and `contract/capabilities.json` at that commit has 84 rows. Tracked == served. Proof: root `16c5713568563` / `14c5713568714`. My R1 line is withdrawn. No old campaign re-run.

> **My v1 headline was wrong and is withdrawn.** v1 concluded that R2 confers "only a session — zero data grants". An independent challenger contradicted it; I verified the decisive point myself and it holds against me. The correction is §R2 below. I am reporting it as a correction, not smoothing it over, because the corrected finding is the most consequential thing in this assessment.

---

## R2 — admission: what a sign-in actually confers

### The thing I missed, verified independently

`seed/synthetic.sql:4-5` seeds `person_mara` with `email_hash = d18a316e892d81bd12c1e2178a94eb8005c0ee9dffe74525c11ac25cd57e5cf5`, `provisioned = 1`, and its own comment states the preimage: *"SHA-256(lowercase('demo.owner@example.invalid')): local-only reserved-domain sign-in fixture."*

I computed it: `sha256("demo.owner@example.invalid")` = that exact hash (and identically for upper-case or whitespace-padded input, since `normalizeEmail` is `trim().toLowerCase()`, `common.ts:32`).

Both admission routes resolve the principal **by `email_hash`**, not by creating a fresh one:

| Route | Resolution | Anchor |
|---|---|---|
| Dev email-code | `SELECT id, support FROM principal WHERE email_hash = ?` → `mintSession(env, pr.id, …)` | `platform.ts:52-53` |
| Cloudflare Access | `INSERT OR IGNORE` then `SELECT id, support FROM principal WHERE email_hash = ?` | `index.ts:128-130` |

`email_hash` is `UNIQUE` (`migrations/0001_init.sql:7`), so the address and the principal are one-to-one.

**Consequence:** completing the dev email-code flow for `demo.owner@example.invalid` does not create a new unprovisioned principal — **it returns a session as `person_mara`**, which is `provisioned = 1` and holds 53 assessment-scope owner grants, 39 project and 9 workspace (root's SELECT receipt). The `dev_only_code` is returned **in the response body** (`platform.ts:39`), so the flow is self-service: two calls, no out-of-band channel.

And the dev worker is **publicly reachable** — `verifyAccessJwt` appears only inside the `/v2/auth/access` route (`index.ts:126`); nothing else under `/v2/*` is Access-fronted, which matches my own anonymous probes of `/v2/health` and `/v2/capabilities.json`. The only limiter on the path is `RL_AUTH` at 10/60 s per IP (`ratelimit.ts`).

### So the corrected answer to root's question

**It depends entirely on whether the email's hash already exists in `principal`.**

- **A fresh, non-colliding email** (any Access-admitted address that isn't a seeded fixture): gains **only a session** — `provisioned 0`, `support 0`, **no grants**, only `sha256(email)` stored, no plaintext. My v1 bucket analysis holds for this case and the challenger confirmed no leaking row: every scoped row ends in `notVisible()` 404 or an empty grant-joined list; the two `provisioned creator` rows refuse; `S` and `P` rows refuse; `cap.assessment.create` needs project-member. Incremental surface over an anonymous visitor = own identity, own trace/undo, feedback, and `cap.request.create` rows (`status:'pending'`, nothing auto-approves — `request.ts:19-20`).
- **The one seeded fixture address**: gains `person_mara` — **provisioned owner of the entire synthetic estate**. That is not a session-only outcome.

### Is this a defect against accepted policy?

**No — and that is the uncomfortable part.** The accepted boundary says `ENVIRONMENT=dev` is a *shared* synthetic sandbox that issues the code in-band and therefore accepts **only** reserved `.invalid` identities, so "no real mailbox can be impersonated" (`platform.ts:19-25`, citing cookbook #14, 2026-09-16). The `.invalid` restriction's stated purpose is preventing **real-mailbox** impersonation; it was never a claim that admission is restricted. A shared demo owner reachable by a known fixture address is the **intended** mechanism — it is how every seat signs in, including my own acceptance run at 09:56Z.

So: not a code defect, not a policy violation. What is new, and what I failed to state in v1, is the **combination**: publicly reachable worker + in-band code + one fixture address that resolves to a provisioned owner holding grants over records of unestablished provenance.

### Material impact — this upgrades R9, it does not merely qualify it

S1/R9 previously read "the operator identity behind `person_mara` sessions is not established." The correct statement is stronger: **it is unbounded.** Anyone who could reach the public dev worker could have held that session. Therefore:

- The 18 UUID-form assessments' creator is not narrowable to the seats at all. My v1 §"Consequence for S1" claimed the Access route was "excluded as a creation path on authorization grounds" — **withdrawn**: anyone resolving to `person_mara` is provisioned and a project owner, so both `cap.project.create` and `cap.assessment.create` are open to them.
- Assessment free text (`name`, `purpose`, `notes_*`) on all 53 granted assessments, and survey response/respondent **counts**, are readable by anyone completing that two-call flow.
- Unchanged and still holding: **no response content is reachable** (`answers_json` is returned by no handler; its only reader is the attestation-gated capture CTE), and the report surface remains closed on the 18 (permanently ineligible).
- Session provenance is **not** recorded: `index.ts:135` passes `{ via: "cloudflare-access", sub }` but `mintSession` stores only `delegated_by` / `participant_survey_id` / `respondent_id` (`auth.ts:46-51`), so nothing at rest distinguishes an Access-minted session from a dev-code one. That is why `created_by` could never have answered the provenance question.

### Disposition — and why I am not recommending the one-line fix today

The challenger proposes the neat fix: replace `person_mara`'s `email_hash` in `seed/synthetic.sql:5` with a non-preimage sentinel, exactly as `person_ion` already uses (`'synthetic_hash_ion'`, line 6). It removes the self-serve provisioned-owner path from **both** routes at once, with in-file precedent.

**It is the right fix and it must not be applied now.** Every seat's DEV sign-in is that address — my acceptance runs, the browser proofs, the staff-UI continuations, and the demo path all depend on resolving to `person_mara`. Sentinelling the hash breaks all of them, hours before the demo, and would strand the two immutable reports behind an identity nobody can assume. I am not trading a known, accepted, rate-limited sandbox exposure for a broken demo.

**Recommended sequencing, for root/captain (no fire from me):**
1. **Now, before the demo:** change nothing in code. Record the exposure (this document). If anything is wanted immediately, it is edge-side and outside the app — an Access policy in front of `/v2/auth/*` on the dev hostname — which is a provider change and therefore explicitly out of my scope.
2. **After the demo:** sentinel the mara hash and introduce a deliberate sign-in fixture whose address is not a published constant, in the same change as a documented seat sign-in procedure. One file, one line, plus the procedure note.
3. **Keep the `ENVIRONMENT` gate off the Access route.** The challenger confirmed my v1 reasoning here: `oauth.ts:118` redirects to `/v2/auth/access?next=oauth` and `:123` keys the consent page on that param, so on dev this is the only OAuth sign-in leg. Gating it would break the MCP connector flow PR #15/#20 shipped.

### v1 errors corrected, for the record

- Bucket table summed to **92, not 84** — the 8 `public` rows were double-counted under `V` and the self-scoped allowlist. Counts dropped rather than patched.
- **10** scope-role rows never resolve a `targetScope` (`cap.language.*`, `cap.recommendation.*`, `cap.rollup.*`, `cap.grant.revoke_invitation`, `cap.report.get`) and fall through `policy.ts:51`. The challenger checked all 10: none leaks — languages and `revoke_invitation` filter in-handler, `report.get` filters in SQL, and the 4 rollup/recommendation rows are pre-empted by `dispatch.ts:46` as `RESERVED_NOT_BUILT` **before** `authorize` runs. My stated basis was wrong; the no-leak conclusion survives on better evidence.
- Citations fixed: `assessment.ts:20` (not 22) for `loadProject(…, "member")`; Access route span `index.ts:123-143`; accepted-policy prose `platform.ts:19-23`, regex `:25`, dev gate `:29-32`.

---

## R3 — `POST /v2/ops/seed/synthetic`

My earlier record called this "an un-receipted write route open to any signed-in principal" and omitted the decisive gate. Corrected here; the substance of this section survived the challenge intact.

| Gate | Exact behaviour | Anchor |
|---|---|---|
| **Environment — fail closed** | `if (env.ENVIRONMENT !== "dev") return 403 NOT_AUTHORIZED_AT_SCOPE`. Source comment: *"Fail CLOSED (Astra 5706439170): only an explicit `ENVIRONMENT="dev"` is dev. A missing variable is not dev."* | `index.ts:150-151` |
| Authentication | `user` or `support` else `401` | `index.ts:153` |
| Provisioning / ownership | **none** | `index.ts:148-159` |
| Contract status | **Not a capability** — 0 occurrences in `contract/capabilities.json` and `contract/openapi.yaml`; answers as `dev.bootstrap.seed_synthetic`, outside the 84-row parity surface | grep 0 / 0 |
| Payload | Replays the **compiled-in** `seed/synthetic-responses.sql` (Text module via `wrangler.toml:48-50`); **no caller input**, not fetchable or overridable | `index.ts:154-156` |
| Idempotence / reach | Challenger enumerated it: **all 637 statements are `INSERT OR IGNORE`** across 6 tables (425 response, 112 assessment_survey, 44 grant, 34 assessment, 10 project, 10 language); **zero** UUID-form ids; all 44 grants to `person_mara`; cannot touch non-synthetic rows | `seed/synthetic-responses.sql` |
| Statement split | Drops column-0 `--` lines, splits `";\n"`. Verified at this commit: no indented comments, no inline trailing `--`, no non-EOL semicolons. A future `;\n` inside a literal would fail the D1 batch **transactionally** (fail-loud), not mis-execute | `index.ts:154` |

**Accepted-policy verdict: permitted.** Dev-only, fail-closed, no caller input, fixed synthetic fixtures into the synthetic sandbox — squarely inside the accepted boundary (`platform.ts:19-23`). Not an authz defect, not a privacy risk.

**Residuals (narrow, and one added by the challenge):**
1. **No receipt and no trace row** — the route sits outside `execute()`, so a re-seed is unauditable. This is the one that bothers me.
2. **Entirely unmetered** — the anon limiter lives inside the capability loop (`index.ts:42`) and `CAP_LIMITER` covers four auth caps only (`ratelimit.ts:35-40`); ~637 statements / 13 D1 batches per call, unbounded, for any signed-in principal — which, given §R2, includes any internet caller who assumes `person_mara`. **Added by the challenger; absent from my v1.**
3. Can resurrect rows someone deliberately removed, and adds `person_mara` grants (feeds the S1 pile).

**Disposition — my v1 refusal was wrong and is withdrawn.** v1 declined a `provisioned` check on the grounds that it "risks making the bootstrap route unusable". The challenger disproved that from source: `package.json:16` applies **both** seed files out-of-band via `wrangler d1 execute --file=`, and `synthetic-responses.sql` inserts **no principal** while binding `created_by='person_mara'` and `grant.principal_id='person_mara'` against FKs (`migrations/0001_init.sql:51,85`) — so the route **cannot** succeed before `synthetic.sql` has run, and `synthetic.sql` is what creates the `provisioned = 1` principal. Bootstrap ordering is enforced by foreign key, not by policy. A `provisioned` check is therefore safe.

Smallest in-scope options, for root's ruling, **not fired and not needed for the demo**: (a) emit a trace row via the existing `persistTrace` — one line, restores auditability; (b) add the `provisioned` check — safe per the above; (c) add the route to a limiter. I recommend (a) and (b) together after the demo, as one small change with an independent review. Note (b) becomes largely moot if root adopts the R2 sequencing, since an unprovisioned caller would no longer be able to assume `person_mara`.

---

## Obligations kept on the record (not deferred, not re-cooked)

| Item | Carried forward unchanged |
|---|---|
| **R7 mail** | OF-3 blocker preserved — provider unconfigured, `delivered:false` honest; app PR **#16** on the dead `phase-0` base; captain's configuration decision. |
| **R8 source fidelity / forms** | app PR **#14** (seed coverage) and **#17** (phase-A refusal sweep) stranded on `phase-0/walking-skeleton` (`10f5f444`; main 108 ahead, 0 phase-0 commits in main). **Not** superseded by the parity rebuild. Owner retarget ruling owed. |
| **R5 trace** | Trace-span redaction and the foreign-trace negative still **unproven on the deployed runtime** (A7); local suite only; 2 requests under the preserved ceiling. |
| **R6 topology** | app PR **#22** open on the dead base; `v0.1.0` tag + cookbook C2 outstanding; A8 freeze in force. |
| **R4 report limits** | Synthetic-only trio; single-control closure on the 4 UUID-form assessments holding responses; cursor actor-binding/expiry/pagination and viewer/member/support/participant/OAuth/archived actors unexercised on DEV. |
| **R9 S1** | **Upgraded by §R2:** operator identity behind `person_mara` is not merely unestablished but **unbounded**. Assessment free text and counts readable by anyone completing the two-call dev sign-in; response content still unreachable; report surface still closed on the 18; ≥27 project / ≥8 workspace UUID-form grants present but unenumerated; DEV not quiescent. |

Design, release and participant work proceed independently; nothing here touches them.

## What this is not

No implementation, no fire, no ticket moved, no permission or provider change, no live call. Every proposed fix is named with its cost and left to root/captain, and the one fix that would close R2 cleanly is explicitly **deferred past the demo** because it would break the sign-in path every seat and the demo itself depend on.

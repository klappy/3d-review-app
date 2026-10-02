#!/usr/bin/env node
// Super admin on/off — the one recorded step for the support switch (principal.support). No bare SQL as procedure.
//
//   node scripts/super-admin.mjs <on|off> --email <account> --by <operator> [--env dev|production] [--local] [--apply]
//
// Without --apply it reads the account's current state and prints the plan; nothing changes.
// With --apply it runs ONE batch: a receipt row (actor = operator, scope = principal:<account id>, prior state) and the
// flip. Already in the asked state → no change, no receipt. The account must have signed in once (a principal row).
// Emails never leave this machine: both are normalised (trim + lowercase) and SHA-256 hashed like sign-in does.
// Production is the captain's call (kitchen HYGIENE 32); the script does not decide who may run it.
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DBS = { dev: "3d-review-dev", production: "3d-review" };
const HEX64 = /^[0-9a-f]{64}$/;

export const emailHash = (email) => createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex");

/** The SQL for one flip. Inputs are hashes and generated ids only (validated), so literals are safe to inline. */
export function buildStatements({ action, targetHash, operatorHash, receiptId, traceId, at }) {
  if (action !== "on" && action !== "off") throw new Error("action must be on or off");
  for (const h of [targetHash, operatorHash]) if (!HEX64.test(h)) throw new Error("hash must be 64 lowercase hex");
  for (const v of [receiptId, traceId, at]) if (!/^[A-Za-z0-9_:.-]+$/.test(v)) throw new Error(`unsafe literal: ${v}`);
  const want = action === "on" ? 1 : 0;
  const inverse = action === "on" ? "off" : "on";
  return [
    `INSERT INTO receipt (id, actor, capability, scope_type, scope_id, class, inverse, undo_token, confirm_token, trace_id, prior_state_json, at) ` +
      `SELECT '${receiptId}', COALESCE((SELECT id FROM principal WHERE email_hash = '${operatorHash}'), 'operator:${operatorHash.slice(0, 12)}'), ` +
      `'script.super_admin.${action}', 'principal', p.id, 'write.reversible', 'script.super_admin.${inverse}', NULL, NULL, '${traceId}', ` +
      `json_object('support', p.support), '${at}' FROM principal p WHERE p.email_hash = '${targetHash}' AND p.support <> ${want}`,
    `UPDATE principal SET support = ${want} WHERE email_hash = '${targetHash}' AND support <> ${want}`,
  ];
}

export const readStatement = (targetHash) => {
  if (!HEX64.test(targetHash)) throw new Error("hash must be 64 lowercase hex");
  return `SELECT id, support FROM principal WHERE email_hash = '${targetHash}'`;
};
export const receiptStatement = (receiptId) => `SELECT id, actor, capability, scope_type, scope_id, prior_state_json, at FROM receipt WHERE id = '${receiptId}'`;

function args(argv) {
  const [action, ...rest] = argv;
  const o = { action, env: "dev", apply: false, local: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--apply") o.apply = true;
    else if (a === "--local") o.local = true;
    else if (a === "--email" || a === "--by" || a === "--env") o[a.slice(2)] = rest[++i];
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!["on", "off"].includes(o.action) || !o.email || !o.by || !DBS[o.env])
    throw new Error("usage: super-admin.mjs <on|off> --email <account> --by <operator> [--env dev|production] [--local] [--apply]");
  return o;
}

function d1(o, sql) {
  const cmd = ["wrangler", "d1", "execute", DBS[o.env], o.local ? "--local" : "--remote", ...(o.env === "production" ? ["--env", "production"] : []), "--json", "--command", sql];
  const out = execFileSync("npx", cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  const parsed = JSON.parse(out);
  return (Array.isArray(parsed) ? parsed : [parsed]).flatMap((r) => r.results ?? []);
}

function main() {
  const o = args(process.argv.slice(2));
  const targetHash = emailHash(o.email), operatorHash = emailHash(o.by);
  const before = d1(o, readStatement(targetHash))[0];
  const plan = { env: o.env, action: o.action, account: before ? before.id : null, support_now: before ? before.support : null, target_hash_prefix: targetHash.slice(0, 8), operator_hash_prefix: operatorHash.slice(0, 8) };
  if (!before) { console.log(JSON.stringify({ ...plan, result: "refused: no account with that email; it must sign in once first" })); process.exit(2); }
  const want = o.action === "on" ? 1 : 0;
  if (before.support === want) { console.log(JSON.stringify({ ...plan, result: "no change: already " + o.action })); return; }
  if (!o.apply) { console.log(JSON.stringify({ ...plan, result: "dry run: re-run with --apply to switch and write the receipt" })); return; }
  const receiptId = `rc_sa_${randomUUID().replace(/-/g, "")}`;
  const traceId = `script_${randomUUID().replace(/-/g, "")}`;
  d1(o, buildStatements({ action: o.action, targetHash, operatorHash, receiptId, traceId, at: new Date().toISOString() }).join(";\n") + ";");
  const after = d1(o, readStatement(targetHash))[0];
  const receipt = d1(o, receiptStatement(receiptId))[0] ?? null;
  console.log(JSON.stringify({ ...plan, result: after?.support === want && receipt ? "switched" : "FAILED: read-back does not match", support_after: after?.support, receipt }, null, 1));
  if (!(after?.support === want && receipt)) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { main(); } catch (e) { console.error(String(e?.message ?? e)); process.exit(1); }
}

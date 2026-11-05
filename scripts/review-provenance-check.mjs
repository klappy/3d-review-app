#!/usr/bin/env node
// Review provenance check (warning only). Looks at the reviews on a PR and warns on any
// review submitted after the cutoff whose body lacks a well-formed ```review-provenance@1 block.
// It never fails the job, never writes to the PR and never deploys anything.
// Usage:
//   GITHUB_TOKEN=... node scripts/review-provenance-check.mjs <owner/repo> <pr-number>
//   node scripts/review-provenance-check.mjs --self-test
// The rule and template live in the 3D Review cookbook (HYGIENE.md section 13, templates/review-provenance.md).

export const SCHEMA_ID = 'review-provenance@1';
// Reviews submitted before this instant are grandfathered (2026-11-04 15:02 ET).
export const CUTOFF = Date.parse('2026-11-04T20:02:00Z');
const TOP = ['schema', 'agent_name', 'role', 'github_login', 'model', 'model_version', 'reasoning_level', 'harness'];
const ENV = ['os', 'runtime', 'ci_runner'];

const unq = (v) => v.trim().replace(/^(["'])(.*)\1$/, '$2').trim();

/** Extract and validate the last review-provenance block in a review body. */
export function parseProvenance(body) {
  const re = /^[ \t]*```review-provenance[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```[ \t]*$/gm;
  let m, last = null;
  while ((m = re.exec(body || '')) !== null) last = m[1];
  if (last === null) return { ok: false, reason: 'missing' };
  const top = {}, env = {};
  let inEnv = false;
  for (const raw of last.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const nested = /^\s+\S/.test(raw);
    const kv = /^\s*([a-z_]+):\s*(.*)$/.exec(raw);
    if (!kv) return { ok: false, reason: `unparseable line: ${raw.trim().slice(0, 40)}` };
    const [, k, v] = kv;
    if (nested) {
      if (!inEnv) return { ok: false, reason: `unexpected indent at ${k}` };
      env[k] = unq(v);
    } else if (k === 'environment') {
      inEnv = true;
    } else {
      inEnv = false;
      top[k] = unq(v);
    }
  }
  const problems = [];
  if (top.schema !== SCHEMA_ID) problems.push(`schema must be ${SCHEMA_ID}`);
  for (const k of TOP) if (!top[k]) problems.push(`missing ${k}`);
  for (const k of ENV) if (!env[k]) problems.push(`missing environment.${k}`);
  for (const k of Object.keys(top)) if (!TOP.includes(k)) problems.push(`unexpected key ${k}`);
  for (const k of Object.keys(env)) if (!ENV.includes(k)) problems.push(`unexpected key environment.${k}`);
  return problems.length ? { ok: false, reason: problems.join('; ') } : { ok: true, value: { ...top, environment: env } };
}

/** Pure check over a list of GitHub review objects. */
export function checkReviews(reviews, cutoff = CUTOFF) {
  const findings = [];
  for (const r of reviews) {
    if (!['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED'].includes(r.state)) continue;
    if (!r.submitted_at || Date.parse(r.submitted_at) < cutoff) continue;
    const res = parseProvenance(r.body);
    findings.push({ id: r.id, login: r.user?.login ?? 'unknown', state: r.state, at: r.submitted_at, commit: (r.commit_id || '').slice(0, 8), ...res });
  }
  return findings;
}

function selfTest() {
  const good = '```review-provenance\nschema: review-provenance@1\nagent_name: a\nrole: independent-reviewer\ngithub_login: x\nmodel: unknown\nmodel_version: unknown\nreasoning_level: medium\nharness: cli\nenvironment:\n  os: Linux\n  runtime: node 22\n  ci_runner: none\n```';
  const t = [
    [parseProvenance('LGTM\n\n' + good).ok, true],
    [parseProvenance('LGTM').reason, 'missing'],
    [parseProvenance(good.replace('role: independent-reviewer\n', '')).ok, false],
    [parseProvenance(good.replace('review-provenance@1\nagent', 'review-provenance@2\nagent')).ok, false],
    [parseProvenance(good.replace('  ci_runner: none', '  ci_runner: none\n  extra: 1')).ok, false],
    [checkReviews([{ id: 1, state: 'APPROVED', submitted_at: '2026-11-04T19:00:00Z', body: '' }]).length, 0],
    [checkReviews([{ id: 2, state: 'APPROVED', submitted_at: '2026-11-04T21:00:00Z', body: '' }])[0].ok, false],
    [checkReviews([{ id: 3, state: 'PENDING', submitted_at: '2026-11-04T21:00:00Z', body: '' }]).length, 0],
  ];
  const bad = t.filter(([a, b]) => a !== b);
  if (bad.length) { console.error('self-test FAILED', bad.length); process.exit(1); }
  console.log(`self-test ok (${t.length} cases)`);
}

async function main() {
  const [repo, pr] = process.argv.slice(2);
  if (!repo || !pr) { console.error('usage: review-provenance-check.mjs <owner/repo> <pr-number> | --self-test'); return; }
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'review-provenance-check' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const reviews = [];
  for (let page = 1; page < 20; page++) {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${pr}/reviews?per_page=100&page=${page}`, { headers });
    if (!res.ok) { console.log(`::warning::review-provenance-check could not read reviews (HTTP ${res.status}); skipped`); return; }
    const batch = await res.json();
    reviews.push(...batch);
    if (batch.length < 100) break;
  }
  const findings = checkReviews(reviews);
  const rows = ['| review | reviewer | state | commit | provenance |', '|---|---|---|---|---|'];
  for (const f of findings) {
    rows.push(`| ${f.id} | ${f.login} | ${f.state} | ${f.commit} | ${f.ok ? 'ok' : f.reason} |`);
    if (!f.ok) console.log(`::warning title=review-provenance::PR #${pr} review ${f.id} by ${f.login} (${f.state}, ${f.commit}) has no valid ${SCHEMA_ID} block: ${f.reason}. A review without it does not count for merge (cookbook HYGIENE section 13).`);
  }
  const summary = findings.length ? rows.join('\n') : 'No reviews after the cutoff to check.';
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## review-provenance check (warning only)\n\n${summary}\n`);
}

if (process.argv[2] === '--self-test') selfTest();
else if (import.meta.url === `file://${process.argv[1]}`) await main();

#!/usr/bin/env node
// Summit load test (DEV only): N QR-link survey completions across the three lenses (Community, Church,
// Translation Team) plus paper-form entries redeemed by access code, against a fresh synthetic project.
// Measures submit latency (p50/p95), errors by type, rate-limit refusals, count-in vs count-stored, report build time.
//
//   BASE=https://dev.3dreview.app N=200 CONC=20 PAPER=2 node scripts/summit-load.mjs > summary.json
//
// Refuses any BASE that is not DEV or local. Identities are RFC 2606 `.invalid` addresses only (DEV dev_only_code login).
const BASE = (process.env.BASE ?? "https://dev.3dreview.app").replace(/\/$/, "");
const N = Number(process.env.N ?? 200), CONC = Number(process.env.CONC ?? 20), PAPER = Number(process.env.PAPER ?? 2);
const TAG = process.env.TAG ?? `load-${Date.now().toString(36)}`;
const LENSES = [
  { lens: "Community", template_id: "tpl_written", version: 2 },
  { lens: "Church", template_id: "tpl_involved_pastor", version: 2 },
  { lens: "Translation Team", template_id: "tpl_validation", version: 2 },
];
if (!/^https:\/\/dev\.3dreview\.app$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error(`refusing BASE=${BASE}: DEV or local only`); process.exit(2);
}

const errors = {}; const bump = (k) => { errors[k] = (errors[k] ?? 0) + 1; };
let rateLimited = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(method, path, body, bearer, { retry429 = 12 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const t0 = performance.now();
    let status = 0, json = {};
    try {
      const r = await fetch(BASE + path, { method, headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      status = r.status; json = await r.json().catch(() => ({}));
      if (status === 429 && attempt < retry429) {
        rateLimited++;
        const ra = Number(r.headers.get("retry-after")) || 0;
        await sleep(Math.max(ra * 1000, 2000 * 2 ** Math.min(attempt, 4)) + Math.random() * 1000);
        continue;
      }
    } catch (e) { json = { ok: false, error: { code: "FETCH_FAILED", message: String(e) } }; }
    return { status, body: json, ms: performance.now() - t0, attempts: attempt + 1 };
  }
}
const must = (label, r) => { if (!r.body?.ok) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.body?.error ?? r.body).slice(0, 300)}`); return r.body.result; };
const twoStep = async (label, method, path, params, bearer) => {
  const dry = must(`${label} dry_run`, await call(method, path, { ...params, mode: "dry_run" }, bearer));
  return must(`${label} execute`, await call(method, path, { ...params, mode: "execute", ...(dry?.confirm_token ? { confirm_token: dry.confirm_token } : {}) }, bearer));
};

function answersFor(items, seed) {
  const a = {};
  for (const it of items) {
    if (it.type === "scale" && it.scale) a[it.id] = it.scale.min + ((seed + it.id.length) % (it.scale.max - it.scale.min + 1));
    else if (it.type === "single" && it.options?.length) a[it.id] = it.options[seed % it.options.length].code;
    else if (it.type === "multi" && it.options?.length) { const ok = it.options.filter((o) => o.flag !== "exclusion"); a[it.id] = [(ok[seed % ok.length] ?? it.options[0]).code]; }
    else if (it.type === "text") a[it.id] = `synthetic load answer ${seed}`;
  }
  return a;
}
const pct = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)].toFixed(1); };

async function main() {
  const started = new Date();
  // Owner login (DEV returns the code in-band for .invalid identities only).
  const email = `${TAG}+owner@example.invalid`;
  const link = must("auth.link", await call("POST", "/v2/auth/link", { email }));
  if (!link.dev_only_code) throw new Error("no dev_only_code: not a DEV environment");
  const sess = must("auth.session", await call("POST", "/v2/auth/session", { email, code: link.dev_only_code })).session;
  const ws = must("workspace", await call("POST", "/v2/workspaces", { name: `Synthetic load ${TAG}` }, sess)).workspace.id;
  const pid = must("project", await call("POST", "/v2/projects", { name: `SYNTHETIC LOAD TEST ${TAG}`, workspace_id: ws, organization: "Invented Load Lab" }, sess)).project.id;
  const lang = must("language", await call("POST", `/v2/projects/${pid}/languages`, { name: "Loadish (invented)", code: "qlx" }, sess)).language.id;
  const aid = must("assessment", await call("POST", `/v2/projects/${pid}/assessments`, { name: `Synthetic load cycle ${TAG}`, language_id: lang }, sess)).assessment.id;
  const surveys = [];
  for (const l of LENSES) {
    const sel = must(`select ${l.template_id}`, await call("POST", `/v2/assessments/${aid}/surveys`, { template_id: l.template_id, version: l.version }, sess));
    surveys.push({ ...l, sid: sel.survey?.id ?? sel.sid });
  }
  must("stage collect", await call("POST", `/v2/assessments/${aid}/stage`, { stage: "collect" }, sess));
  for (const s of surveys) s.token = (await twoStep(`link ${s.sid}`, "POST", `/v2/assessments/${aid}/surveys/${s.sid}/links`, { params: {} }, sess)).link_token;
  // Paper forms: access codes on the first lens's survey, exported as a facilitator would print them.
  const paperSurvey = surveys[0];
  const issued = must("codes", await call("POST", `/v2/assessments/${aid}/surveys/${paperSurvey.sid}/codes`, { count: PAPER }, sess));
  const codes = (await twoStep("export codes", "POST", `/v2/assessments/${aid}/surveys/${paperSurvey.sid}/codes/export`, { ids: issued.ids }, sess)).codes.map((c) => c.code);
  const setupDone = new Date();

  const submitMs = [], openMs = [], e2eMs = [], accepted = [];
  const perLens = Object.fromEntries(LENSES.map((l) => [l.lens, 0]));
  const tasks = [];
  for (let i = 0; i < N; i++) tasks.push({ kind: "qr", i, s: surveys[i % surveys.length] });
  codes.forEach((code, j) => tasks.push({ kind: "paper", i: N + j, s: paperSurvey, code }));
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const t = tasks[next++]; const t0 = performance.now();
      try {
        const op = t.kind === "qr" ? await call("POST", "/v2/participate/link", { token: t.s.token }) : await call("POST", "/v2/participate/code", { code: t.code });
        openMs.push(op.ms);
        if (!op.body?.ok) { bump(`open:${op.status}:${op.body?.error?.code ?? "?"}`); continue; }
        const pt = op.body.result.participant_token ?? op.body.result.session ?? op.body.result.token;
        const form = await call("GET", "/v2/participate/form", null, pt);
        if (!form.body?.ok) { bump(`form:${form.status}:${form.body?.error?.code ?? "?"}`); continue; }
        const key = `${TAG}-${t.kind}-${t.i}`;
        const sub = await call("POST", "/v2/participate/responses", { idempotency_key: key, answers: answersFor(form.body.result.items, t.i) }, pt);
        submitMs.push(sub.ms);
        if (!sub.body?.ok) { bump(`submit:${sub.status}:${sub.body?.error?.code ?? "?"}:${String(sub.body?.error?.message ?? "").slice(0, 60)}`); continue; }
        const rc = await call("GET", "/v2/participate/receipt", null, pt);
        if (!(rc.body?.ok && rc.body.result?.submitted && rc.body.result.response_id === sub.body.result.response_id)) bump("receipt:mismatch");
        accepted.push({ kind: t.kind, lens: t.s.lens, response_id: sub.body.result.response_id, receipt_ok: rc.body?.result?.response_id === sub.body.result.response_id });
        perLens[t.s.lens]++;
        e2eMs.push(performance.now() - t0);
      } catch (e) { bump(`exception:${String(e).slice(0, 60)}`); }
    }
  }
  const loadStart = new Date();
  await Promise.all(Array.from({ length: CONC }, worker));
  const loadEnd = new Date();

  // Count stored. Row-level lists are suppressed by policy (D7), so: results.responses_in (server-side COUNT),
  // per-survey status, and each participant's own receipt (checked in the worker above).
  const results = await call("GET", `/v2/assessments/${aid}/results`, null, sess);
  const storedCount = results.body?.result?.responses_in ?? null;
  const status = [];
  for (const s of surveys) { const g = await call("GET", `/v2/assessments/${aid}/surveys/${s.sid}`, null, sess); status.push({ lens: s.lens, keys: Object.keys(g.body?.result ?? {}), counts: g.body?.result?.responses ?? g.body?.result?.response_count ?? g.body?.result?.counts ?? null }); }
  const surveyCount = status.reduce((n, x) => n + (x.counts?.responses ?? 0), 0);
  const storedTotal = storedCount ?? surveyCount; // responses_in is only named below the D7 minimum
  const distinctIds = new Set(accepted.map((a) => a.response_id)).size;
  const rb0 = performance.now();
  const dry = await call("POST", `/v2/assessments/${aid}/reports`, { mode: "dry_run" }, sess);
  const exe = await call("POST", `/v2/assessments/${aid}/reports`, { mode: "execute", ...(dry.body?.result?.confirm_token ? { confirm_token: dry.body.result.confirm_token } : {}) }, sess);
  const reportMs = performance.now() - rb0;
  // report.stage spans (0.34.1+): {stage, ms} per build stage from each request's own trace (cap.ops.trace, actor = sess).
  // On Workers CPU-only stages read ~0 ms (clock advances only across I/O); the local bench gives the CPU split.
  async function stages(r) {
    const id = r.body?.trace_id; if (!id) return null;
    const t = await call("GET", `/v2/ops/traces/${encodeURIComponent(id)}`, null, sess);
    if (!t.body?.ok) return { trace_id: id, error: t.body?.error?.code ?? t.status };
    // cap.ops.trace returns the persisted blob (src/receipt.ts persistTrace): result.spans = { capability, transport, ok, ..., spans: [...] }.
    const blob = t.body.result?.spans;
    const list = Array.isArray(blob) ? blob : Array.isArray(blob?.spans) ? blob.spans : [];
    return { trace_id: id, spans: list.filter((x) => x.span === "report.stage").map((x) => ({ stage: x.data?.stage, ms: x.data?.ms })) };
  }
  const reportStages = { dry_run: await stages(dry), execute: await stages(exe) };

  console.log(JSON.stringify({
    base: BASE, tag: TAG, project_id: pid, assessment_id: aid, surveys: surveys.map(({ token, ...s }) => s),
    started: started.toISOString(), setup_done: setupDone.toISOString(), load_start: loadStart.toISOString(), load_end: loadEnd.toISOString(),
    load_span_s: +((loadEnd - loadStart) / 1000).toFixed(1), concurrency: CONC,
    attempted: tasks.length, attempted_qr: N, attempted_paper: codes.length,
    accepted: accepted.length, accepted_paper: accepted.filter((a) => a.kind === "paper").length, per_lens: perLens,
    stored_responses_in: storedCount, stored_survey_counts: surveyCount, count_in_equals_stored: storedTotal === accepted.length && surveyCount === accepted.length, distinct_response_ids: distinctIds,
    receipts_ok: accepted.filter((a) => a.receipt_ok).length, survey_status: status,
    results_status: results.body?.result?.status ?? results.body?.error?.code, results_reason: results.body?.result?.reason ?? null,
    submit_ms: { n: submitMs.length, p50: pct(submitMs, 50), p95: pct(submitMs, 95), max: pct(submitMs, 100) },
    open_ms: { n: openMs.length, p50: pct(openMs, 50), p95: pct(openMs, 95), max: pct(openMs, 100) },
    e2e_ms: { p50: pct(e2eMs, 50), p95: pct(e2eMs, 95) },
    rate_limited_429_retries: rateLimited, errors,
    report: { ms: +reportMs.toFixed(0), dry_status: dry.status, dry_result_status: dry.body?.result?.status ?? dry.body?.error?.code, exec_status: exe.status,
      ok: !!exe.body?.ok, suppressed: exe.body?.result?.suppressed ?? null, reason: exe.body?.result?.reason ?? exe.body?.error?.message ?? null, report_id: exe.body?.result?.report?.id ?? null, stages: reportStages },
  }, null, 2));
}
main().catch((e) => { console.error(String(e)); console.log(JSON.stringify({ fatal: String(e), errors, rate_limited_429_retries: rateLimited })); process.exit(1); });

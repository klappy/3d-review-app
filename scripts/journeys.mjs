// B2 runner (live leg): one polarity per row; FAIL and unmet REQUIRE floor exit 1.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const J = JSON.parse(fs.readFileSync(new URL("../scenarios/journeys.json", import.meta.url)));
export const FLOOR_REQUIRE = Object.freeze(["AUTH", "ME", "J8", "J14a", "J7", "J6", "MCP", "OUT"]);
export const TOKEN_RE = /(st|pt)_[A-Za-z0-9_-]{32}/;
export const BEARER_MARK = "Bearer ";
export const COVERAGE = Object.freeze({
  J1: { label: "PARTIAL", capabilities: ["cap.assessment.create", "cap.survey.select"] },
  J2: { label: "PARTIAL", capabilities: ["cap.participant.redeem_code"] },
  J3: { label: "NOT-EXECUTED-BY-THIS-RUNNER", capabilities: [] },
  J4: { label: "NOT-EXECUTED-BY-THIS-RUNNER", capabilities: [] },
  J5: { label: "NOT-EXECUTED-BY-THIS-RUNNER", capabilities: [] },
  J6: { label: "PARTIAL", capabilities: ["cap.results.summary", "cap.response.list"] },
  J7: { label: "EXECUTED", capabilities: ["cap.ops.trace"] },
  J8: { label: "EXECUTED", capabilities: ["cap.docs.get"] },
  J9: { label: "PARTIAL", capabilities: ["cap.ops.undo"] },
  J10: { label: "NOT-EXECUTED-BY-THIS-RUNNER", capabilities: [] },
  J11: { label: "PARTIAL", capabilities: ["cap.participant.open_link", "cap.response.form", "cap.response.submit", "cap.response.receipt"] },
  J12: { label: "NOT-EXECUTED-BY-THIS-RUNNER", capabilities: [] },
  J13: { label: "PARTIAL", capabilities: ["cap.request.create"] },
  J14: { label: "PARTIAL", capabilities: ["cap.entry.intents", "cap.entry.example", "cap.ops.health", "cap.template.render", "cap.docs.capabilities"] },
});

const SYM = { PASS: "✅", FAIL: "❌", RESERVED_501: "⚪501", SKIP: "⏭" };

export function specIdFor(rowId) {
  if (rowId === "J2-neg") return "J2";
  if (rowId === "J6+") return "J6";
  if (rowId === "J11-live") return "J11";
  const m = /^(J\d+)/.exec(rowId);
  return m ? m[1] : null;
}

export function coverageGaps(specJourneys = J.journeys, coverage = COVERAGE) {
  const specIds = specJourneys.map((j) => j.id).sort();
  const mapIds = Object.keys(coverage).sort();
  const extras = mapIds.filter((id) => !specIds.includes(id));
  const missing = specIds.filter((id) => !mapIds.includes(id));
  const illegalExecuted = [];
  for (const j of specJourneys) {
    const cov = coverage[j.id];
    if (!cov) continue;
    const needed = [...new Set(j.steps.map((s) => s.capability))];
    const asserted = new Set(cov.capabilities);
    const missingCaps = needed.filter((c) => !asserted.has(c));
    if (cov.label === "EXECUTED" && missingCaps.length) illegalExecuted.push({ id: j.id, missingCaps });
  }
  return { extras, missing, illegalExecuted };
}

export function coverageSummary(coverage = COVERAGE) {
  const labels = Object.values(coverage).map((c) => c.label);
  return {
    spec: labels.length,
    executed: labels.filter((l) => l === "EXECUTED").length,
    partial: labels.filter((l) => l === "PARTIAL").length,
    notExecuted: labels.filter((l) => l === "NOT-EXECUTED-BY-THIS-RUNNER").length,
  };
}

export function parseRequireExtra(envValue = process.env.REQUIRE, argv = process.argv.slice(2)) {
  const extra = [];
  const take = (raw) => {
    if (!raw) return;
    for (const id of String(raw).split(",").map((s) => s.trim()).filter(Boolean)) extra.push(id);
  };
  take(envValue);
  for (const a of argv) if (a.startsWith("REQUIRE=")) take(a.slice("REQUIRE=".length));
  return [...new Set(extra)];
}

export function requiredIds(extra = []) {
  return [...new Set([...FLOOR_REQUIRE, ...extra])];
}

export function parseAllowSkip(argv = process.argv.slice(2)) {
  return argv.includes("--allow-skip");
}

export function evidenceOf(status, body) {
  const code = body?.error?.code ?? (body?.ok === true ? "ok" : undefined);
  const trace_id = body?.trace_id ?? body?.receipt?.trace_id;
  return { status, ...(code ? { code } : {}), ...(trace_id ? { trace_id } : {}) };
}

export function makeRow(id, verdict, note, evidence = {}) {
  return { id, verdict, note, evidence };
}

export function classifyD1(body, expectProvisioned, status = body?.ok ? 200 : 403) {
  const evidence = evidenceOf(status, body);
  if (!expectProvisioned) {
    return makeRow("D1", "SKIP", "unprovisioned principal → NOT_AUTHORIZED_AT_SCOPE (expected on DEV without seed)", evidence);
  }
  if (body?.ok === true) return makeRow("D1", "PASS", "workspace created (provisioned)", evidence);
  return makeRow("D1", "FAIL", `provisioning refused → ${body?.error?.code ?? status}`, evidence);
}

export function classifyJ6(body, status = body?.ok ? 200 : 404) {
  const evidence = evidenceOf(status, body);
  if (body?.ok === true) {
    return makeRow("J6", "FAIL", "ungranted read returned data — isolation broken or fixture wrong", evidence);
  }
  if (body?.ok === false && body?.error?.code === "NOT_FOUND_OR_NOT_VISIBLE") {
    return makeRow("J6", "PASS", "results for ungranted → NOT_FOUND_OR_NOT_VISIBLE (existence hidden)", evidence);
  }
  return makeRow("J6", "FAIL", `results for ungranted → ${body?.error?.code ?? status}`, evidence);
}

export function classifyJ6plus(summaryBody, listBody, viewerPresent, summaryStatus = 0, listStatus = 0) {
  if (!viewerPresent) {
    return makeRow("J6+", "SKIP", "viewer positive: no viewer credential supplied", {});
  }
  const evidence = evidenceOf(listStatus || summaryStatus, listBody ?? summaryBody);
  const summaryOk = summaryBody?.ok === true;
  const listRefused = listBody?.ok === false && listBody?.error?.code === "NOT_AUTHORIZED_AT_SCOPE";
  if (summaryOk && listRefused) {
    const suppressed = summaryBody?.result?.suppressed === true ? " suppressed:true" : "";
    return makeRow("J6+", "PASS", `granted viewer summary ok:true${suppressed}; response.list → NOT_AUTHORIZED_AT_SCOPE`, evidence);
  }
  return makeRow("J6+", "FAIL", `viewer positive failed summary=${summaryBody?.error?.code ?? (summaryBody?.ok ? "ok" : "?")} list=${listBody?.error?.code ?? (listBody?.ok ? "ok" : "?")}`, evidence);
}

export function classifyJ2neg(status, body) {
  const evidence = evidenceOf(status, body);
  if (status === 501 || body?.error?.code === "RESERVED_NOT_BUILT") {
    return makeRow("J2-neg", "FAIL", "redeem route reserved — J2 cannot be credited", evidence);
  }
  const code = body?.error?.code;
  if (body?.ok === false && (code === "INVALID_PARAMS" || code === "NOT_FOUND_OR_NOT_VISIBLE")) {
    return makeRow("J2-neg", "PASS", `redeem bad code → ${code}`, evidence);
  }
  return makeRow("J2-neg", "FAIL", `redeem bad code → ${code ?? status}`, evidence);
}

export function classifyReservedOrPositive(id, status, body, passNote) {
  const evidence = evidenceOf(status, body);
  if (status === 501 || body?.error?.code === "RESERVED_NOT_BUILT") {
    return makeRow(id, "RESERVED_501", `${passNote} → RESERVED_NOT_BUILT`, evidence);
  }
  if (body?.ok === true) return makeRow(id, "PASS", passNote, evidence);
  return makeRow(id, "FAIL", `${passNote} → ${body?.error?.code ?? status}`, evidence);
}

export function classifyJ1(status, body) {
  const evidence = evidenceOf(status, body);
  if (status === 501 || body?.error?.code === "RESERVED_NOT_BUILT") {
    return makeRow("J1", "RESERVED_501", "issue_codes (seeded) → RESERVED_NOT_BUILT", evidence);
  }
  if (body?.ok === true) return makeRow("J1", "PASS", "issue_codes (seeded)", evidence);
  if (body?.ok === false && body?.error?.code === "NOT_FOUND_OR_NOT_VISIBLE") {
    return makeRow("J1", "SKIP", "issue_codes (seeded) → NOT_FOUND_OR_NOT_VISIBLE (ungranted principal)", evidence);
  }
  return makeRow("J1", "FAIL", `issue_codes (seeded) → ${body?.error?.code ?? status}`, evidence);
}

export function classifyJ1g(issueStatus, issueBody, undoBody) {
  const evidence = evidenceOf(undoBody ? 200 : issueStatus, undoBody ?? issueBody);
  if (issueStatus === 501 || issueBody?.error?.code === "RESERVED_NOT_BUILT") {
    return makeRow("J1g", "SKIP", "issue_codes reserved — undo not credited", evidence);
  }
  if (issueBody?.ok === true || issueStatus === 200) {
    if (!issueBody?.receipt?.undo_token) return makeRow("J1g", "FAIL", "no undo token after 200", evidence);
    if (undoBody?.ok === true && undoBody?.result?.count === 2) {
      return makeRow("J1g", "PASS", `undo issue_codes batch → revoked ${undoBody.result.count}`, evidence);
    }
    return makeRow("J1g", "FAIL", `undo issue_codes batch → ${undoBody?.error?.code ?? "count not 2"}`, evidence);
  }
  return makeRow("J1g", "FAIL", `issue_codes not ok → ${issueBody?.error?.code ?? issueStatus}`, evidence);
}

export function classifyJ14a(reads) {
  const failed = reads.filter((r) => r.ok !== true).map((r) => r.name);
  const evidence = { status: failed.length ? 0 : 200, code: failed.length ? failed.join(",") : "ok" };
  if (!failed.length) return makeRow("J14a", "PASS", `public reads ${reads.length}/${reads.length}`, evidence);
  return makeRow("J14a", "FAIL", `public reads failed: ${failed.join(", ")} (${reads.length - failed.length}/${reads.length})`, evidence);
}

export function classifyJ14b(status, body) {
  const evidence = evidenceOf(status, body);
  if (status === 501 && body?.error?.code === "RESERVED_NOT_BUILT") {
    return makeRow("J14b", "RESERVED_501", "rollup → RESERVED_NOT_BUILT (v2.1-oct; flip when that row is built — klappy/3d-review-app#28 landed attestation, not this row)", evidence);
  }
  return makeRow("J14b", "FAIL", `rollup → ${body?.error?.code ?? status}`, evidence);
}

export function classifyJ11live(opts) {
  const { allowWrites, localBase, before, after, opened, submitted, receipt, form, issued } = opts;
  if (!allowWrites) return makeRow("J11-live", "SKIP", "shared-link write-gated: set ALLOW_WRITES=1 (local only)", {});
  if (!localBase) return makeRow("J11-live", "SKIP", "J11-live local-only; refused remote/DEV target", {});
  if (issued?.body?.ok === false && issued.body.error?.code === "NOT_FOUND_OR_NOT_VISIBLE") {
    return makeRow("J11-live", "SKIP", "shared-link seeded write → NOT_FOUND_OR_NOT_VISIBLE (ungranted principal)", evidenceOf(issued.status, issued.body));
  }
  const evidence = evidenceOf(submitted?.status ?? 0, submitted?.body ?? receipt?.body);
  const delta = (after ?? 0) - (before ?? 0);
  if (opened?.body?.ok === true && form?.body?.ok === true && submitted?.body?.ok === true && receipt?.body?.ok === true && delta === 1) {
    return makeRow("J11-live", "PASS", "shared link issue→open→form→submit→receipt; owner counts +1", evidence);
  }
  return makeRow("J11-live", "FAIL", `shared-link live failed countsΔ=${Number.isFinite(delta) ? delta : "?"} open=${opened?.body?.error?.code ?? (opened?.body?.ok ? "ok" : "?")} form=${form?.body?.error?.code ?? (form?.body?.ok ? "ok" : "?")}`, evidence);
}

export function countVerdicts(rows) {
  const n = { PASS: 0, FAIL: 0, RESERVED: 0, SKIP: 0 };
  for (const r of rows) {
    if (r.verdict === "RESERVED_501") n.RESERVED++;
    else if (n[r.verdict] !== undefined) n[r.verdict]++;
  }
  return n;
}

export function exitCode(rows, { allowSkip = false, extraRequire = [] } = {}) {
  const n = countVerdicts(rows);
  if (n.FAIL > 0) return 1;
  const have = new Map(rows.map((r) => [r.id, r]));
  for (const id of requiredIds(extraRequire)) {
    if (have.get(id)?.verdict !== "PASS") return 1;
  }
  if (n.SKIP > 0 && !allowSkip) return 1;
  return 0;
}

export function formatJourneysSummary(rows, { allowSkip = false } = {}) {
  const n = countVerdicts(rows);
  const cov = coverageSummary();
  let line = `journeys PASS=${n.PASS} FAIL=${n.FAIL} RESERVED=${n.RESERVED} SKIP=${n.SKIP}`;
  if (allowSkip) {
    const skipped = rows.filter((r) => r.verdict === "SKIP").map((r) => r.id);
    if (skipped.length) line += ` skipped=${skipped.join(",")}`;
  }
  line += `\nspec journeys: ${cov.spec} · executed ${cov.executed} · partial ${cov.partial} · not executed ${cov.notExecuted}`;
  return line;
}

export function formatTable(rows) {
  return rows.map((r) => `${SYM[r.verdict] ?? "?"} ${String(r.id).padEnd(8)} ${r.note}`).join("\n");
}

export function redactText(text) {
  return String(text)
    .replace(/(st|pt)_[A-Za-z0-9_-]{32}/g, "$1_[REDACTED]")
    .replace(/Bearer [^\s"]+/g, "[REDACTED_BEARER]")
    .replace(/Bearer /g, "[REDACTED_BEARER] ");
}

export function redactRows(rows) {
  return JSON.parse(redactText(JSON.stringify(rows)));
}

export function scanLeaks(rows) {
  const s = JSON.stringify(rows);
  return { token: TOKEN_RE.test(s), bearer: s.includes(BEARER_MARK) };
}

export function applyInjectFail(rows, injectId = process.env.INJECT_FAIL) {
  if (!injectId) return rows;
  let hit = false;
  const next = rows.map((r) => {
    if (r.id !== injectId) return r;
    hit = true;
    return { ...r, verdict: "FAIL", note: `INJECT_FAIL=${injectId}` };
  });
  if (!hit) next.push(makeRow(injectId, "FAIL", `INJECT_FAIL=${injectId} matched no row`));
  return next;
}

export function isLocalBase(base) {
  try {
    const host = new URL(base).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export function isMainModule(metaUrl = import.meta.url, argv1 = process.argv[1]) {
  return Boolean(argv1) && metaUrl === pathToFileURL(argv1).href;
}

function cite(rowId) {
  const sid = specIdFor(rowId);
  const spec = sid && J.journeys.find((j) => j.id === sid);
  return spec?.source ? ` [${spec.source}]` : "";
}

export async function runJourneys({
  base = process.env.BASE ?? "http://localhost:8787",
  email = process.env.EMAIL ?? `demo.owner+${Date.now()}@example.invalid`,
  expectProvisioned = process.env.EXPECT_PROVISIONED === "1",
  viewerSess = process.env.VIEWER_SESS ?? "",
  allowWrites = process.env.ALLOW_WRITES === "1",
  injectFail = process.env.INJECT_FAIL,
  fetchImpl = fetch,
} = {}) {
  const gaps = coverageGaps();
  if (gaps.extras.length || gaps.missing.length || gaps.illegalExecuted.length) {
    throw new Error(`COVERAGE map invalid: ${JSON.stringify(gaps)}`);
  }
  let inFlight = "startup";
  const H = (sess) => ({ "content-type": "application/json", ...(sess ? { authorization: `Bearer ${sess}` } : {}) });
  const call = async (method, path, body, sess) => {
    try {
      const r = await fetchImpl(base + path, { method, headers: H(sess), body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    } catch (err) {
      return { status: 0, body: { ok: false, error: { code: "FETCH_FAILED", message: String(err) } } };
    }
  };
  const mcp = async (tool, args, sess) => (await call("POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } }, sess)).body.result?.structuredContent;
  const rows = [];
  const push = (row) => {
    inFlight = row.id;
    rows.push({ ...row, note: row.note + cite(row.id) });
  };

  try {
    inFlight = "AUTH";
    const link = await call("POST", "/v2/auth/link", { email });
    const code = link.body.result?.dev_only_code;
    const sessRes = await call("POST", "/v2/auth/session", { email, code });
    const sess = sessRes.body.result?.session;
    push(sess
      ? makeRow("AUTH", "PASS", "email-code → session", evidenceOf(sessRes.status, { ok: true, trace_id: sessRes.body.trace_id }))
      : makeRow("AUTH", "FAIL", `no session: ${JSON.stringify(link.body).slice(0, 120)}`, evidenceOf(link.status, link.body)));

    inFlight = "ME";
    const me = await call("GET", "/v2/me", null, sess);
    push(me.body.ok === true
      ? makeRow("ME", "PASS", `principal ${me.body.result?.principal?.kind}`, evidenceOf(me.status, me.body))
      : makeRow("ME", "FAIL", `principal ${me.body.error?.code ?? me.status}`, evidenceOf(me.status, me.body)));

    inFlight = "J8";
    const d = await mcp("docs", {}, sess);
    push(d?.ok === true && d.result?.tool_surface?.count === 4
      ? makeRow("J8", "PASS", "docs orientation, 4 tools", evidenceOf(200, d))
      : makeRow("J8", "FAIL", `docs orientation → ${d?.error?.code ?? "no docs"}`, evidenceOf(0, d ?? {})));

    inFlight = "D1";
    const ws = await call("POST", "/v2/workspaces", { name: "Runner WS" }, sess);
    push(classifyD1(ws.body, expectProvisioned, ws.status));

    inFlight = "J13";
    const rq = await call("POST", "/v2/requests", { kind: "workspace", target: "Runner WS" }, sess);
    push(rq.body.ok === true
      ? makeRow("J13", "PASS", `request ${rq.body.result?.request_id}`, evidenceOf(rq.status, rq.body))
      : makeRow("J13", "FAIL", `request ${rq.body.error?.code ?? rq.status}`, evidenceOf(rq.status, rq.body)));

    inFlight = "J14a";
    const pub = [
      { name: "entry", ...(await call("GET", "/v2/entry")) },
      { name: "example", ...(await call("GET", "/v2/example")) },
      { name: "health", ...(await call("GET", "/v2/health")) },
      { name: "template.render", ...(await call("GET", "/v2/templates/tpl_validation@1/render?lang=en")) },
      { name: "capabilities", ...(await call("GET", "/v2/capabilities.json")) },
    ];
    push(classifyJ14a(pub.map((p) => ({ name: p.name, ok: p.body.ok === true }))));

    inFlight = "J14b";
    const res = await call("GET", "/v2/projects/proj_rill/rollup", null, sess);
    push(classifyJ14b(res.status, res.body));

    inFlight = "TPL";
    const t = await call("GET", "/v2/templates", null, sess);
    push(t.body.ok === true
      ? makeRow("TPL", "PASS", `templates ${t.body.result?.templates?.length}`, evidenceOf(t.status, t.body))
      : makeRow("TPL", "FAIL", `templates ${t.body.error?.code ?? t.status}`, evidenceOf(t.status, t.body)));

    if (ws.body.ok) {
      const wsid = ws.body.result?.workspace?.id;
      inFlight = "J1a";
      const pj = await call("POST", "/v2/projects", { name: "Runner Project", workspace_id: wsid, organization: "Invented Field Lab" }, sess);
      push(pj.body.ok === true
        ? makeRow("J1a", "PASS", `project ${pj.body.result?.project?.id}`, evidenceOf(pj.status, pj.body))
        : makeRow("J1a", "FAIL", `project ${pj.body.error?.code ?? pj.status}`, evidenceOf(pj.status, pj.body)));
      const pid = pj.body.result?.project?.id;
      if (pid) {
        inFlight = "J1b0";
        const lg = await call("POST", `/v2/projects/${pid}/languages`, { name: "Kelo (invented)", code: "qak" }, sess);
        push(lg.body.ok === true
          ? makeRow("J1b0", "PASS", `language ${lg.body.result?.language?.id}`, evidenceOf(lg.status, lg.body))
          : makeRow("J1b0", "FAIL", `language ${lg.body.error?.code ?? lg.status}`, evidenceOf(lg.status, lg.body)));
        const lang = lg.body.result?.language?.id;
        inFlight = "J1b";
        const a = await call("POST", `/v2/projects/${pid}/assessments`, { name: "Kelo cycle 1", language_id: lang }, sess);
        push(a.body.ok === true
          ? makeRow("J1b", "PASS", `assessment ${a.body.result?.assessment?.id}`, evidenceOf(a.status, a.body))
          : makeRow("J1b", "FAIL", `assessment ${a.body.error?.code ?? a.status}`, evidenceOf(a.status, a.body)));
        const aid = a.body.result?.assessment?.id;
        if (aid) {
          inFlight = "J1c";
          const sel = await call("POST", `/v2/assessments/${aid}/surveys`, { template_id: "tpl_validation", version: 1 }, sess);
          push(sel.body.ok === true
            ? makeRow("J1c", "PASS", `select survey ${sel.body.result?.survey?.id ?? sel.body.result?.sid}`, evidenceOf(sel.status, sel.body))
            : makeRow("J1c", "FAIL", `select survey ${sel.body.error?.code ?? sel.status}`, evidenceOf(sel.status, sel.body)));
          inFlight = "J1d";
          const st = await call("POST", `/v2/assessments/${aid}/stage`, { stage: "collect" }, sess);
          push(st.body.ok === true
            ? makeRow("J1d", "PASS", `set_stage collect → ${st.body.result?.assessment?.stage ?? "ok"}`, evidenceOf(st.status, st.body))
            : makeRow("J1d", "FAIL", `set_stage collect → ${st.body.error?.code ?? st.status}`, evidenceOf(st.status, st.body)));
          const sid = sel.body.result?.survey?.id ?? sel.body.result?.sid;
          if (sid) {
            inFlight = "J1e";
            const ic2 = await call("POST", `/v2/assessments/${aid}/surveys/${sid}/codes`, { count: 2 }, sess);
            push(classifyReservedOrPositive("J1e", ic2.status, ic2.body, "issue_codes"));
            inFlight = "J1f";
            const pr = await call("GET", `/v2/assessments/${aid}/surveys/${sid}/print`, null, sess);
            push(pr.body.ok === true
              ? makeRow("J1f", "PASS", "print blank form → ok", evidenceOf(pr.status, pr.body))
              : makeRow("J1f", "FAIL", `print blank form → ${pr.body.error?.code ?? pr.status}`, evidenceOf(pr.status, pr.body)));
            const ut = ic2.body.receipt?.undo_token;
            const bu = ut ? await call("POST", `/v2/undo/${ut}`, null, sess) : null;
            inFlight = "J1g";
            push(classifyJ1g(ic2.status, ic2.body, bu?.body));
          }
          const undo = a.body.receipt?.undo_token;
          const un = undo ? await call("POST", `/v2/undo/${undo}`, null, sess) : null;
          inFlight = "J9";
          if (a.body.ok === true && !undo) push(makeRow("J9", "FAIL", "no undo token after 200", evidenceOf(a.status, a.body)));
          else if (un?.body.ok === true) push(makeRow("J9", "PASS", `undo assessment.create via ${un.body.result?.via ?? "ok"}`, evidenceOf(un.status, un.body)));
          else if (un) push(makeRow("J9", "FAIL", `undo assessment.create → ${un.body.error?.code ?? un.status}`, evidenceOf(un.status, un.body)));
        }
      }
    }

    inFlight = "J1";
    const ic = await call("POST", "/v2/assessments/assess_tavo_collect/surveys/survey_tavo/codes", { count: 2 }, sess);
    push(classifyJ1(ic.status, ic.body));

    inFlight = "J2-neg";
    const rd = await call("POST", "/v2/participate/code", { code: "NOPE-NOPE" });
    push(classifyJ2neg(rd.status, rd.body));

    inFlight = "J11-live";
    if (!allowWrites || !isLocalBase(base)) {
      push(classifyJ11live({ allowWrites, localBase: isLocalBase(base) }));
    } else {
      const aid = "assess_tavo_collect";
      const sid = "survey_tavo";
      const ownerGet = async () => {
        const g = await call("GET", `/v2/assessments/${aid}/surveys/${sid}`, null, sess);
        return g.body.result?.counts?.responses;
      };
      const before = await ownerGet();
      const dry = await call("POST", `/v2/assessments/${aid}/surveys/${sid}/links`, { params: {}, mode: "dry_run" }, sess);
      const issued = await call("POST", `/v2/assessments/${aid}/surveys/${sid}/links`, { params: {}, mode: "execute", confirm_token: dry.body.result?.confirm_token }, sess);
      const opened = await call("POST", "/v2/participate/link", { token: issued.body.result?.link_token });
      const pt = opened.body.result?.participant_token;
      const form = await call("GET", "/v2/participate/form", null, pt);
      const submitted = await call("POST", "/v2/participate/responses", { idempotency_key: `j11-${Date.now()}`, answers: { Q1: 4 } }, pt);
      const receipt = await call("GET", "/v2/participate/receipt", null, pt);
      const after = await ownerGet();
      push(classifyJ11live({ allowWrites, localBase: true, before, after, opened, submitted, receipt, form, issued }));
    }

    inFlight = "J6";
    const r6 = await call("GET", "/v2/assessments/assess_melo_understand/results", null, sess);
    push(classifyJ6(r6.body, r6.status));

    inFlight = "J6+";
    if (!viewerSess) {
      push(classifyJ6plus(null, null, false));
    } else {
      const vs = await call("GET", "/v2/assessments/assess_melo_understand/results", null, viewerSess);
      const vl = await call("GET", "/v2/assessments/assess_melo_understand/responses", null, viewerSess);
      push(classifyJ6plus(vs.body, vl.body, true, vs.status, vl.status));
    }

    inFlight = "J7";
    const tr = await call("GET", `/v2/ops/traces/${me.body.trace_id}`, null, sess);
    const tr2 = await call("GET", `/v2/ops/traces/${pub[2].body.trace_id}`, null, sess);
    push(tr.body.ok === true && tr2.body.error?.code === "NOT_FOUND_OR_NOT_VISIBLE"
      ? makeRow("J7", "PASS", `own trace ok; other → ${tr2.body.error.code}`, evidenceOf(tr.status, tr.body))
      : makeRow("J7", "FAIL", `own trace ${tr.body.ok ? "ok" : tr.body.error?.code}; other → ${tr2.body.error?.code ?? tr2.status}`, evidenceOf(tr2.status, tr2.body)));

    inFlight = "MCP";
    const wt = await mcp("read", { capability: "cap.workspace.create" }, sess);
    push(wt?.error?.code === "WRONG_TOOL_FOR_CLASS"
      ? makeRow("MCP", "PASS", `wrong tool → ${wt.error.code}`, evidenceOf(400, wt))
      : makeRow("MCP", "FAIL", `wrong tool → ${wt?.error?.code ?? "missing"}`, evidenceOf(0, wt ?? {})));

    inFlight = "OUT";
    const lo = await call("DELETE", "/v2/auth/session", null, sess);
    const after = await call("GET", "/v2/me", null, sess);
    push(lo.body.ok === true && after.body.error?.code === "NOT_AUTHENTICATED"
      ? makeRow("OUT", "PASS", "logout revokes session", evidenceOf(lo.status, lo.body))
      : makeRow("OUT", "FAIL", `logout → ${lo.body.error?.code ?? lo.status}; after → ${after.body.error?.code ?? after.status}`, evidenceOf(after.status, after.body)));
  } catch (err) {
    err.inFlight = inFlight;
    throw err;
  }

  return applyInjectFail(redactRows(rows), injectFail);
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const allowSkip = parseAllowSkip(argv);
  const extraRequire = parseRequireExtra(env.REQUIRE, argv);
  let rows;
  try {
    rows = await runJourneys({
      base: env.BASE ?? "http://localhost:8787",
      email: env.EMAIL,
      expectProvisioned: env.EXPECT_PROVISIONED === "1",
      viewerSess: env.VIEWER_SESS ?? "",
      allowWrites: env.ALLOW_WRITES === "1",
      injectFail: env.INJECT_FAIL,
    });
  } catch (err) {
    console.error(`uncaught exception in row ${err.inFlight ?? "unknown"}: ${err?.stack ?? err}`);
    process.exitCode = 2;
    return 2;
  }
  const leaks = scanLeaks(rows);
  if (leaks.token || leaks.bearer) {
    console.error("redaction failed: serialized rows still contain bearer material");
    process.exitCode = 1;
    return 1;
  }
  const base = env.BASE ?? "http://localhost:8787";
  console.log(`live journeys @ ${base}\n` + formatTable(rows));
  console.log(formatJourneysSummary(rows, { allowSkip }));
  const code = exitCode(rows, { allowSkip, extraRequire });
  process.exitCode = code;
  return code;
}

if (isMainModule()) {
  main().then((code) => process.exit(code));
}

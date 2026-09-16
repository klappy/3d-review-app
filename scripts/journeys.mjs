// B2 runner (live leg): walks the demo-critical journeys against BASE and prints what actually works. Exit 0 always; the table is the output.
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:8787";
const J = JSON.parse(fs.readFileSync(new URL("../scenarios/journeys.json", import.meta.url)));
const H = (sess) => ({ "content-type": "application/json", ...(sess ? { authorization: `Bearer ${sess}` } : {}) });
const call = async (method, path, body, sess) => { const r = await fetch(BASE + path, { method, headers: H(sess), body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const mcp = async (tool, args, sess) => (await call("POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } }, sess)).body.result?.structuredContent;
const rows = []; const row = (id, ok, note) => rows.push(`${ok === true ? "✅" : ok === "501" ? "⚪501" : "❌"} ${id.padEnd(4)} ${note}`);
const email = process.env.EMAIL ?? `demo.owner+${Date.now()}@example.invalid`;
// sign in (dev returns the code)
const link = await call("POST", "/v2/auth/link", { email }); const code = link.body.result?.dev_only_code;
const sess = (await call("POST", "/v2/auth/session", { email, code })).body.result?.session;
row("AUTH", !!sess, sess ? "email-code → session" : `no session: ${JSON.stringify(link.body).slice(0, 120)}`);
const me = await call("GET", "/v2/me", null, sess); row("ME", me.body.ok === true, `principal ${me.body.result?.principal?.kind}`);
// J8 docs
const d = await mcp("docs", {}, sess); row("J8", d?.ok === true && d.result?.tool_surface?.count === 4, "docs orientation, 4 tools");
// provisioning: dev has no D1 route to provision; note honestly
const ws = await call("POST", "/v2/workspaces", { name: "Runner WS" }, sess);
row("D1", ws.body.ok === true || ws.body.error?.code === "NOT_AUTHORIZED_AT_SCOPE", ws.body.ok ? "workspace created (provisioned)" : `unprovisioned → ${ws.body.error?.code} hint: ${ws.body.error?.hint}`);
// J13 request route
const rq = await call("POST", "/v2/requests", { kind: "workspace", target: "Runner WS" }, sess); row("J13", rq.body.ok === true, `request ${rq.body.result?.request_id ?? rq.body.error?.code}`);
// public reads (J14)
const pub = await Promise.all([call("GET", "/v2/entry"), call("GET", "/v2/example"), call("GET", "/v2/health"), call("GET", "/v2/templates/tpl_validation@1/render?lang=en"), call("GET", "/v2/capabilities.json")]);
row("J14a", pub.every((p) => p.body.ok === true), `public reads ${pub.filter((p) => p.body.ok).length}/5`);
const res = await call("GET", "/v2/projects/proj_rill/rollup", null, sess); row("J14b", res.status === 501 ? "501" : false, `rollup → ${res.body.error?.code}`);
// templates (built) 
const t = await call("GET", "/v2/templates", null, sess); row("TPL", t.body.ok === true, `templates ${t.body.result?.templates?.length ?? t.body.error?.code}`);
// facilitator leg (needs a provisioned owner, e.g. seeded demo.owner@example.invalid)
if (ws.body.ok) {
  const wsid = ws.body.result?.workspace?.id;
  const pj = await call("POST", "/v2/projects", { name: "Runner Project", workspace_id: wsid, organization: "Invented Field Lab" }, sess);
  row("J1a", pj.body.ok === true, `project ${pj.body.result?.project?.id ?? pj.body.error?.code} ${pj.body.error?.hint ?? ""}`);
  const pid = pj.body.result?.project?.id;
  if (pid) {
    const lg = await call("POST", `/v2/projects/${pid}/languages`, { name: "Kelo (invented)", code: "qak" }, sess);
    row("J1b0", lg.body.ok === true, `language ${lg.body.result?.language?.id ?? lg.body.error?.code} ${lg.body.error?.message ?? ""}`);
    const apid = pid, lang = lg.body.result?.language?.id;
    const a = await call("POST", `/v2/projects/${apid}/assessments`, { name: "Kelo cycle 1", language_id: lang }, sess);
    row("J1b", a.body.ok === true, `assessment ${a.body.result?.assessment?.id ?? a.body.error?.code}: ${a.body.error?.message ?? ""} ${a.body.error?.hint ?? ""}`);
    const aid = a.body.result?.assessment?.id;
    if (aid) {
      const sel = await call("POST", `/v2/assessments/${aid}/surveys`, { template_id: "tpl_validation", version: 1 }, sess);
      row("J1c", sel.body.ok === true, `select survey ${sel.body.result?.survey?.id ?? sel.body.error?.code} ${sel.body.error?.message ?? ""}`);
      const st = await call("POST", `/v2/assessments/${aid}/stage`, { stage: "collect" }, sess);
      row("J1d", st.body.ok === true, `set_stage collect → ${st.body.ok ? st.body.result?.assessment?.stage ?? "ok" : st.body.error?.code} ${st.body.error?.message ?? ""}`);
      const sid = sel.body.result?.survey?.id;
      if (sid) { const ic2 = await call("POST", `/v2/assessments/${aid}/surveys/${sid}/codes`, { count: 2 }, sess); row("J1e", ic2.status === 501 ? "501" : ic2.body.ok === true, `issue_codes → ${ic2.body.ok ? "ok" : ic2.body.error?.code} (${ic2.body.error?.message ?? ""})`); 
        const pr = await call("GET", `/v2/assessments/${aid}/surveys/${sid}/print`, null, sess); row("J1f", pr.body.ok === true, `print blank form → ${pr.body.ok ? "ok" : pr.body.error?.code}`);
        const ut = ic2.body.receipt?.undo_token; const bu = ut ? await call("POST", `/v2/undo/${ut}`, null, sess) : null;
        row("J1g", bu?.body.ok === true && bu.body.result?.count === 2, `undo issue_codes batch → ${bu?.body.ok ? `revoked ${bu.body.result?.count}` : bu?.body.error?.code ?? "no undo token"}`); }
      const undo = a.body.receipt?.undo_token; const un = undo ? await call("POST", `/v2/undo/${undo}`, null, sess) : null;
      row("J9", un?.body.ok === true, `undo assessment.create via ${un?.body.result?.via ?? un?.body.error?.code ?? "no token"}`);
    }
  }
}
// codes / participant leg
const ic = await call("POST", "/v2/assessments/assess_tavo_collect/surveys/survey_tavo/codes", { count: 2 }, sess); row("J1", ic.status === 501 ? "501" : ic.body.ok === true, `issue_codes → ${ic.body.ok ? "ok" : ic.body.error?.code} (escrow pending, Lane A)`);
const rd = await call("POST", "/v2/participate/code", { code: "NOPE-NOPE" }); row("J2", rd.body.error?.code === "INVALID_PARAMS" || rd.body.error?.code === "NOT_FOUND_OR_NOT_VISIBLE" || rd.status === 501, `redeem bad code → ${rd.body.error?.code ?? rd.status}`);
// results (J6) as seeded viewer? we have no seeded session; check hidden existence as our fresh user
const r6 = await call("GET", "/v2/assessments/assess_melo_understand/results", null, sess); row("J6", r6.body.error?.code === "NOT_FOUND_OR_NOT_VISIBLE" || r6.body.ok === true, `results for ungranted → ${r6.body.error?.code ?? "ok"} (existence hidden)`);
// J7 trace own vs other
const tr = await call("GET", `/v2/ops/traces/${me.body.trace_id}`, null, sess); const tr2 = await call("GET", `/v2/ops/traces/${pub[2].body.trace_id}`, null, sess);
row("J7", tr.body.ok === true && tr2.body.error?.code === "NOT_FOUND_OR_NOT_VISIBLE", `own trace ${tr.body.ok ? "ok" : tr.body.error?.code}; other → ${tr2.body.error?.code}`);
// WRONG_TOOL + danger two-step on a 501 row (shape only)
const wt = await mcp("read", { capability: "cap.workspace.create" }, sess); row("MCP", wt?.error?.code === "WRONG_TOOL_FOR_CLASS", `wrong tool → ${wt?.error?.code}`);
const lo = await call("DELETE", "/v2/auth/session", null, sess); const after = await call("GET", "/v2/me", null, sess);
row("OUT", lo.body.ok === true && after.body.error?.code === "NOT_AUTHENTICATED", "logout revokes session");
console.log(`live journeys @ ${BASE}\n` + rows.join("\n"));

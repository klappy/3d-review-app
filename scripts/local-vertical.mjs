// Synthetic local HTTP vertical. Never prints login codes, sessions, or access codes.
const base = process.env.DEMO_BASE ?? "http://127.0.0.1:8795";
const email = "demo.owner@example.invalid";
let ownerToken;
let participantToken;
async function call(method, path, body, actor = "owner") {
  const token = actor === "participant" ? participantToken : actor === "owner" ? ownerToken : undefined;
  const response = await fetch(base + path, { method, headers: {
    accept: "application/json", ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(`${method} ${path}: ${data.error?.code ?? response.status} ${data.error?.message ?? ""}`);
  return data;
}
const requested = await call("POST", "/v2/auth/link", { email }, "anonymous");
const code = requested.result.dev_only_code;
if (!code) throw new Error("local dev login code absent");
const loggedIn = await call("POST", "/v2/auth/session", { email, code }, "anonymous");
ownerToken = loggedIn.result.session;
const me = await call("GET", "/v2/me");
if (me.result.principal.id !== "person_mara" || !me.result.principal.provisioned) throw new Error("synthetic owner identity mismatch");
const created = await call("POST", "/v2/projects/proj_rill/assessments", { name: `HTTP vertical ${Date.now()}`, language_id: "lang_tavo" });
const aid = created.result.assessment.id;
const selected = await call("POST", `/v2/assessments/${aid}/surveys`, { template_id: "tpl_mid_level", version: 1 });
const sid = selected.result.survey.id;
if (selected.result.survey.collection_status !== "closed") throw new Error("new survey unexpectedly open");
await call("POST", `/v2/assessments/${aid}/stage`, { stage: "collect" });
const status = await call("GET", `/v2/assessments/${aid}/surveys/${sid}`);
if (status.result.survey.collection_status !== "open") throw new Error("Collect transition did not open survey");
const issued = await call("POST", `/v2/assessments/${aid}/surveys/${sid}/codes`, { count: 1 });
if ("codes" in issued.result || issued.result.ids?.length !== 1) throw new Error("issue response disclosed value or missed id");
const params = { ids: issued.result.ids };
const preview = await call("POST", `/v2/assessments/${aid}/surveys/${sid}/codes/export`, { params, mode: "dry_run" });
if (!preview.result.confirm_token || "codes" in preview.result) throw new Error("export preview invalid");
const released = await call("POST", `/v2/assessments/${aid}/surveys/${sid}/codes/export`, { params, mode: "execute", confirm_token: preview.result.confirm_token });
const accessCode = released.result.codes?.[0]?.code;
if (!accessCode) throw new Error("confirmed export returned no code");
const redeemed = await call("POST", "/v2/participate/code", { code: accessCode }, "anonymous");
participantToken = redeemed.result.participant_token;
if (redeemed.result.survey_id !== sid) throw new Error("redeemed wrong survey");
const form = await call("GET", "/v2/participate/form", undefined, "participant");
if (form.result.survey_id !== sid || form.result.items?.[0]?.id !== "Q1") throw new Error("participant form mismatch");
const idem = `http-vertical-${Date.now()}`;
const submitted = await call("POST", "/v2/participate/responses", { idempotency_key: idem, answers: { Q1: 4 } }, "participant");
const replay = await call("POST", "/v2/participate/responses", { idempotency_key: idem, answers: { Q1: 4 } }, "participant");
if (replay.result.response_id !== submitted.result.response_id || !replay.result.duplicate) throw new Error("response replay changed effect");
const receipt = await call("GET", "/v2/participate/receipt", undefined, "participant");
if (receipt.result.response_id !== submitted.result.response_id) throw new Error("receipt recovery mismatch");
const result = await call("GET", `/v2/assessments/${aid}/results`);
if (!result.result.suppressed || result.result.status !== "held") throw new Error("result hold missing");
const repeat = await fetch(base + `/v2/assessments/${aid}/surveys/${sid}/codes/export`, { method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${ownerToken}` },
  body: JSON.stringify({ params, mode: "execute", confirm_token: preview.result.confirm_token }) }).then(r => r.json());
if (repeat.ok || repeat.error?.code !== "STAGE_CONFLICT") throw new Error("one-time export repeated");
console.log(JSON.stringify({ ok: true, assessment_id: aid, survey_id: sid, response_id: submitted.result.response_id,
  checks: ["seeded email-code owner", "fresh assessment", "selected survey closed", "explicit Collect opens", "IDs-only issue", "confirm preview", "one-time export", "redeem", "form", "submit/replay", "receipt", "held result", "repeat export denied"] }));

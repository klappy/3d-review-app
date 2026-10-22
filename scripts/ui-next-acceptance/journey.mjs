// UI Next live acceptance (status: provisional; cookbook work/active/2026-10-21-ui-next-demo-wiring). Real-journey probe for /next/ against a running Worker (local or DEV). Signs in as a synthetic sandbox account, walks
// home -> project -> review -> collection room (real link + QR) -> participant journey in a second context (answers persist across
// reload, submit, receipt) -> results (real report). Prints one line per step; exits 1 on the first failure.
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://127.0.0.1:8787";
const EMAIL = process.env.EMAIL ?? "uinext.demo@example.invalid";
const SHOTS = process.env.SHOTS ?? "";
const PHONE = { width: 390, height: 844 };
const ok = (m) => console.log("✅", m);
const fail = (m) => { console.log("❌", m); process.exit(1); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }) // CHROMIUM: another machine's Chromium binary (README);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
const errors = [];
// A screen counts as loaded only when it is not the shell's Status card (app/Status.svelte: "Loading…", "Something went wrong", "Not found").
const loaded = async (page, what) => { await page.waitForTimeout(300); /* Status defers "Loading…" 180ms (app/Live.svelte), so a fresh load is briefly blank */ await page.waitForFunction(() => !/Loading…/.test(document.body.textContent ?? ""), null, { timeout: 30000 }).catch(() => {}); const t = (await page.textContent("body")) ?? ""; if (/Loading…|Something went wrong|Could not load|Try again/.test(t) && !/Question \d+ of/.test(t)) fail(`${what}: screen is the Status card, not the page: ${t.replace(/\s+/g, " ").slice(0, 160)}`); };
// Page exceptions and console errors fail the run. The one accepted line: the browser's own "Failed to load resource … 401" for the
// signed-out session probe (GET /v2/me before sign-in), which the app makes on purpose; any other failed request is recorded by URL.
const watch = (page, tag) => {
  page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`${tag} console: ${m.text()}`); });
  page.on("response", (r) => { const u = r.url().replace(BASE, ""); if (r.status() >= 400 && !(r.status() === 401 && u === "/v2/me")) errors.push(`${tag} HTTP ${r.status()} ${r.request().method()} ${u}`); });
};

// --- facilitator ---
const fac = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const f = await fac.newPage(); watch(f, "fac");
await f.goto(`${BASE}/next/?ui_next=on`); // the documented opt-in (route.js); the current UI's account menu links here
await f.waitForSelector("text=Sign in", { timeout: 15000 });
ok(`entry ${BASE}/next/ -> landing (signed out)`);
await f.click("text=Sign in");
await f.waitForURL(/#\/?signin/);
await f.fill("#si-email", EMAIL);
await f.click("button[type=submit]");
await f.waitForSelector("#si-code", { timeout: 15000 });
const code = await f.inputValue("#si-code");
if (!code) fail("no sandbox code filled in");
await f.click("button[type=submit]");
await f.waitForSelector("text=Your reviews", { timeout: 15000 });
ok("sign-in (sandbox code) -> home with real reviews");
await shot(f, "home");

// Seed: a project + review of our own if none exist (through the same /v2 the current UI uses; bearer this tab holds).
const token = await f.evaluate(() => sessionStorage.getItem("facilitatorToken"));
const api = async (path, body, method = body ? "POST" : "GET") => {
  const r = await fetch(`${BASE}${path}`, { method, headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json(); if (!r.ok || !j.ok) throw new Error(`${method} ${path}: ${j.error?.code} ${j.error?.message}`); return j.result;
};
let projects = (await api("/v2/projects")).projects;
let ws = (await api("/v2/workspaces")).workspaces;
if (!ws.length) { ws = [(await api("/v2/workspaces", { name: "UI Next demo workspace" })).workspace]; }
if (!projects.length) { projects = [(await api("/v2/projects", { workspace_id: ws[0].id, name: "UI Next demo project", organization: "Demo" })).project]; }
const pid = projects[0].id;
let as = (await api(`/v2/projects/${pid}/assessments`)).assessments.filter((a) => !a.archived_at);
let a = as.find((x) => x.stage === "collect") ?? as[0];
if (!a) {
  const langs = (await api(`/v2/projects/${pid}/languages`)).languages ?? [];
  const lang = langs[0] ?? (await api(`/v2/projects/${pid}/languages`, { name: "Demo language" })).language;
  a = (await api(`/v2/projects/${pid}/assessments`, { name: `UI Next demo ${new Date().toISOString().slice(0, 16)}`, language_id: lang.id })).assessment;
}
const { surveys } = await api(`/v2/assessments/${a.id}`);
if (!surveys.filter((s) => !s.archived_at).length) {
  const tpls = (await api("/v2/templates")).templates ?? [];
  const pick = ["tpl_written", "tpl_involved_pastor", "tpl_validation"].map((id) => tpls.find((t) => t.id === id)).filter(Boolean).slice(0, 2);
  for (const t of pick.length ? pick : tpls.slice(0, 2)) await api(`/v2/assessments/${a.id}/surveys`, { template_id: t.id, version: t.version ?? 1 });
}
ok(`data: project ${pid} · review ${a.id} (${a.stage})`);

await f.goto(`${BASE}/next/#/project/${pid}`);
await f.waitForSelector("h1", { timeout: 15000 }); await loaded(f, "project");
// The project's review link is stage-aware (collecting -> …/collect, results -> …/results, preparing -> the review page).
await f.click(`a[href^="#/review/${encodeURIComponent(a.id)}"]`);
await f.waitForURL(new RegExp(`#/review/${a.id}(/collect|/results)?$`));
await f.waitForSelector("h1"); await loaded(f, "review");
ok(`project -> review (in-app link, hash route): ${f.url().replace(/.*#/, "#")}`);
if ((await f.textContent("body")).includes("Open collection")) {
  await f.click("button:has-text('Open collection')"); // Setup5 launch (POST /stage) when the review is still preparing
  await f.waitForURL(/collect$/, { timeout: 15000 });
  ok("stage prepare -> collect (POST /stage) from the review page");
}
await f.goto(`${BASE}/next/#/review/${a.id}/collect`); await f.waitForSelector("h1", { timeout: 30000 }); await loaded(f, "collect");
const collectText = (await f.textContent("body")).replace(/\s+/g, " ");
if (!/#survey=/.test(await f.evaluate(() => [...document.querySelectorAll(".kbd")].map((e) => e.textContent).join(" ")))) fail("collect: no real survey link under a survey row");
ok(`collect page: real per-survey links; ${/Active until|Closed on/.test(collectText) ? "period shown" : "no period set on this review"}; language ${/Hindi|English|Demo language/.test(collectText) ? "shown" : "not shown (none on the review)"}`);
// Owner count before the participant submits (same /v2 the facilitator UI reads).
const openIds = (await api(`/v2/assessments/${a.id}`)).surveys.filter((s) => !s.archived_at && s.collection_status === "open").map((s) => s.id);
const countOf = async (sid) => Number((await api(`/v2/assessments/${a.id}/surveys/${sid}`)).counts?.responses ?? 0); // the same GET the UI reads (app/data.js surveyCounts)
const before = Object.fromEntries(await Promise.all(openIds.map(async (sid) => [sid, await countOf(sid)])));
// The collect page prints every open survey's full link (the row's .kbd); the participant opens the first one.
const firstLink = await f.evaluate(() => [...document.querySelectorAll(".kbd")].map((e) => e.textContent.trim()).find((t) => t.includes("#survey=")) ?? null);
if (!firstLink) fail("collect: no full survey link printed");
await f.goto(`${BASE}/next/#/review/${a.id}/collect/qr`); await f.waitForSelector(".qr", { timeout: 30000 });
await f.click("text=Meeting offline? Print and paper"); await f.waitForURL(/collect#offline$/); await f.waitForSelector("#offline", { timeout: 15000 }); await loaded(f, "collect#offline");
ok("QR room -> Meeting offline? lands on collect#offline (in-page anchor, not home)");
await f.goBack(); await f.waitForURL(/collect\/qr$/); await f.waitForSelector(".qr", { timeout: 30000 }); ok("browser back restores the QR room");
await f.goto(`${BASE}/next/#/review/${a.id}`); await f.waitForURL(/collect$/); await f.waitForSelector("h1"); await loaded(f, "review -> collect");
ok("review page redirects to Collect while collecting");
await f.click('[aria-label^="QR code for"], [aria-label^="QR for"]'); // the row's QR button (collect/SurveyGroups.svelte)
await f.waitForURL(/#\/review\/.*\/collect\/qr(\?state=\d+)?$/);
await f.waitForSelector(".qr", { timeout: 30000 });
// The room prints the host under each code; the full link is what the code encodes (app/data.js attachLinks). Take the first tile's.
const link = await f.evaluate(() => { const t = document.querySelector(".qr-tile, .qr-tile-phone"); return t?.__link ?? null; }) ?? await f.evaluate(() => [...document.querySelectorAll(".kbd")].map((e) => e.textContent).find((t) => t.includes("#survey=")) ?? null) ?? firstLink;
if (!link) fail("no survey link on the QR room");
ok(`QR room shows a real link + QR: ${link.replace(/#survey=.*/, "#survey=…")}`);
await shot(f, "qr-room");
await f.goBack(); await f.waitForURL(new RegExp(`#/review/${a.id}/collect$`)); await f.waitForSelector("h1"); await loaded(f, "back -> collect"); ok("browser back works (room -> collect)");
await f.goForward(); await f.waitForURL(/collect\/qr(\?state=\d+)?$/); await f.waitForSelector(".qr"); ok("browser forward works (collect -> room)");

// --- participant on a phone, new context (no facilitator cookie) ---
const part = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true });
const p = await part.newPage(); watch(p, "part");
await p.goto(link);
await p.waitForSelector("text=We'd like your perspective", { timeout: 20000 });
ok("participant: link opens -> welcome (real form)");
await shot(p, "p-welcome");
await p.click("text=Start"); await p.waitForURL(/#\/p\/passage/);
await p.click("text=I've read it"); await p.waitForURL(/#\/p\/(q\/1|about)/);
if (/#\/p\/about/.test(p.url())) { await p.click("text=Next"); await p.waitForURL(/#\/p\/q\/1/); }
ok("participant: passage -> question 1");
// answer the first question (choice or text), then the next
for (let n = 1; n <= 2; n++) {
  await p.waitForSelector(`text=Question ${n} of`, { timeout: 15000 }); await p.waitForSelector("fieldset.opts, textarea.in", { timeout: 15000 });
  const radio = p.locator("input.rd, input.cb").first();
  if (await radio.count()) await radio.check(); else await p.fill("textarea", `answer ${n}`);
  await p.waitForTimeout(300);
  await p.click("text=Next");
  await p.waitForURL(new RegExp(`#/p/(q/${n + 1}|review)`));
}
ok("participant: answered q1-q2, Next walks the questions");
await shot(p, "p-question");
await p.reload();
await p.waitForSelector("h1", { timeout: 15000 });
await p.goto(`${BASE}/next/#/p/q/1`); await p.waitForSelector("text=Question 1 of", { timeout: 15000 });
const kept = await p.$("input:checked, textarea:not(:placeholder-shown)");
if (!kept) fail("after reload the answer did not come back");
ok("participant: reload keeps the page and the draft (persisted)");
// answer the rest, then send from the review
for (let i = 0; i <= 40; i++) {
  if (/#\/p\/review/.test(p.url())) break;
  const n = Number(/q\/(\d+)/.exec(p.url())?.[1] ?? 1);
  await p.waitForSelector(`text=Question ${n} of`, { timeout: 15000 }); await p.waitForSelector("fieldset.opts, textarea.in", { timeout: 15000 });
  const radio = p.locator("input.rd, input.cb").first();
  if (await radio.count()) await radio.check(); else await p.locator("textarea.in").fill(`answer ${n}`);
  await p.waitForTimeout(200);
  await p.click("text=Next");
  await p.waitForURL(new RegExp(`#/p/(q/${n + 1}|review)`));
}
await p.goto(`${BASE}/next/#/p/review`);
await p.waitForSelector("text=Check your answers", { timeout: 15000 });
await shot(p, "p-review");
await p.click("text=Send my answers");
await p.waitForSelector("text=Thank you", { timeout: 20000 });
const receipt = await p.textContent(".receipt");
if (!receipt?.trim()) fail("no receipt code shown");
const shown = receipt.trim().replace(/\s+/g, "");
// Independent readback: exactly one open survey's owner count moved, by exactly one; the receipt the server stored for this
// submission is the one on the phone (the participant controller keeps it per device; /v2 shows the response count only).
const after = Object.fromEntries(await Promise.all(openIds.map(async (sid) => [sid, await countOf(sid)])));
const moved = openIds.filter((sid) => after[sid] !== before[sid]);
if (moved.length !== 1 || after[moved[0]] !== before[moved[0]] + 1) fail(`owner counts did not move by exactly +1 on exactly one survey: before ${JSON.stringify(before)} after ${JSON.stringify(after)}`);
ok(`participant: submitted -> receipt ${shown}; owner count for ${moved[0]} ${before[moved[0]]} -> ${after[moved[0]]} (exactly +1, read back from /v2 counts)`);
// Server/display receipt: a NEW tab has no tab storage, only the device's remembered session (ui/shared-link.js remember), so the
// receipt it shows comes from the server's session — it must be the same id.
const p2 = await part.newPage(); watch(p2, "part2"); await p2.goto(link); await p2.waitForSelector("text=Thank you", { timeout: 20000 });
const shown2 = ((await p2.textContent(".receipt")) ?? "").trim().replace(/\s+/g, "");
if (shown2 !== shown) fail(`new tab shows receipt ${shown2}, the submit showed ${shown}`);
await p2.close(); ok("participant: a new tab on the same link resumes the server's session and shows the same receipt id");
await shot(p, "p-receipt");
await p.reload(); await p.waitForSelector("text=Thank you", { timeout: 15000 }); ok("participant: reload after submit shows the receipt again (receipt per device)");
await p.goto(`${BASE}/next/#/p/code`); await p.waitForSelector("#p-code"); await p.fill("#p-code", "NOPE00");
const n0 = errors.length; await p.click("text=Open my survey");
await p.waitForSelector("[role=alert]", { timeout: 15000 });
const expected404 = errors.splice(n0).filter((e) => !/HTTP 404 POST \/v2\/participate\/code/.test(e)); errors.push(...expected404); // the bad code's 404 is the point
ok("participant: a bad code shows the inline error (server 404, expected)");

// --- facilitator: results ---
await f.goto(`${BASE}/next/#/review/${a.id}/results`);
await f.waitForSelector("h1", { timeout: 60000 }); await loaded(f, "results");
const body = await f.textContent("body");
ok(`results page rendered: ${/Nothing here yet|More input needed|results can/i.test(body) ? "held (too few responses)" : "report built from real answers"}`);
await shot(f, "results");
await f.goto(`${BASE}/next/#/review/${a.id}/report`); await f.waitForSelector("h1", { timeout: 60000 }); await loaded(f, "report"); ok("report page rendered");
await f.goto(`${BASE}/next/#/review/${a.id}/collect`); await f.waitForSelector("h1"); await loaded(f, "collect"); ok("collect page rendered");
await f.goto(`${BASE}/next/#/nowhere/at/all`); await f.waitForSelector("text=Your reviews"); ok("unknown deep link falls back to home");
// sign out from the account menu
await f.click("summary:has-text('Account menu'), #acct summary, [aria-label^='Account menu']").catch(() => {});
await browser.close();
if (errors.length) { console.log("❌ page errors (the run fails):"); for (const e of errors) console.log("  ", e.slice(0, 300)); process.exit(1); }
console.log("DONE clean");

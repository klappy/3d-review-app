// Rule 15 for the LIVE compositions: each /next/#/… screen (real data, signed in) vs its canvas board, 1280x800 and 390x844,
// light and dark, provenance off; changed-pixel % per pair. Usage: node measure-live.mjs <canvasDir> <base> <outDir> <aid> <pid> <linkFragment>
import { chromium } from "playwright";
import fs from "node:fs"; import path from "node:path";
import { PNG } from "pngjs"; import pixelmatch from "pixelmatch";
const [canvas, base, out, aid, pid, link] = process.argv.slice(2);
const EMAIL = "uinext.demo@example.invalid";
fs.mkdirSync(out, { recursive: true });
// [board, width, height, live hash]
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const PAIRS = [
  ["Landing", 1280, 800, "#/welcome"], ["LandingPhone", 390, 844, "#/welcome"],
  ["Home", 1280, 800, "#/"], ["HomePhone", 390, 844, "#/"],
  ["Project", 1280, 800, `#/project/${pid}`], ["ProjectPhone", 390, 844, `#/project/${pid}`],
  ["Collect", 1280, 800, `#/review/${aid}/collect`], ["CollectPhone", 390, 844, `#/review/${aid}/collect`],
  ["QRRoom", 1280, 800, `#/review/${aid}/collect/qr`], ["QRRoomPhone", 390, 844, `#/review/${aid}/collect/qr`],
  ["Results", 1280, 800, `#/review/${process.env.AID2 ?? aid}/results`], ["ResultsPhone", 390, 844, `#/review/${process.env.AID2 ?? aid}/results`],
  ["ResultsGaps", 1280, 800, `#/review/${process.env.AID2 ?? aid}/results/gaps`], ["Report", 1280, 800, `#/review/${process.env.AID2 ?? aid}/report`], ["ReportPhone", 390, 844, `#/review/${process.env.AID2 ?? aid}/report`],
  ["PCode", 390, 844, "#/p/code"], ["PWelcome", 390, 844, "P:#/p/welcome"], ["PPassage", 390, 844, "P:#/p/passage"], ["PQuestion", 390, 844, "P:#/p/q/3"], ["PReview", 390, 844, "P:#/p/review"], ["PReceipt", 390, 844, "P:#/p/receipt"],
];
const br = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }) // CHROMIUM: another machine's Chromium binary (README);
const rows = [];
async function board(b, w, h, theme) {
  const f = path.join(canvas, `${b}.dc.html`);
  if (!fs.existsSync(f)) return null;
  const src = fs.readFileSync(f, "utf8").replaceAll("{{theme}}", theme).replaceAll("{{imagery}}", "bars").replaceAll("{{prov}}", "");
  const tmp = path.join(out, `_board_${b}_${theme}.html`); fs.writeFileSync(tmp, src);
  const ctx = await br.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" }); const p = await ctx.newPage();
  await p.goto("file://" + tmp);
  await p.evaluate(() => { document.querySelectorAll("aside[aria-label=Provenance]").forEach((e) => e.remove()); const a = document.querySelector(".app"); if (a) { a.style.width = "100%"; a.style.minHeight = "100vh"; } });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  const file = path.join(out, `board-${b}-${w}x${h}-${theme}.png`); await p.screenshot({ path: file }); await ctx.close(); fs.unlinkSync(tmp);
  return file;
}
async function signIn(p) {
  await p.goto(`${base}/next/?ui_next=on#/signin`); await p.fill("#si-email", EMAIL); await p.click("button[type=submit]"); await p.waitForSelector("#si-code"); await p.click("button[type=submit]"); await p.waitForSelector("text=Your reviews", { timeout: 20000 });
}
for (const [b, w, h, hash] of PAIRS.filter((x) => !ONLY || ONLY.includes(x[0]))) {
  for (const theme of ["light", "dark"]) {
    const bf = await board(b, w, h, theme);
    const ctx = await br.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" }); const p = await ctx.newPage();
    const participant = hash.startsWith("P:"); const target = hash.replace(/^P:/, "");
    if (participant) {
      await p.goto(`${base}/next/?ui_next=on${link}`); await p.waitForSelector("text=Start", { timeout: 20000 });
      // Rule: every participant screen is reached by its real prerequisite — answers for q/n and review, a real submission for the receipt.
      if (target.includes("/p/q/") || target.includes("review") || target.includes("receipt")) {
        await p.click("text=Start"); await p.waitForURL(/#\/p\/passage/); await p.click("text=I've read it"); await p.waitForURL(/#\/p\/(q\/1|about)/); if (/#\/p\/about/.test(p.url())) { await p.click("text=Next"); await p.waitForURL(/#\/p\/q\/1/); }
        for (let i = 0; i <= 40; i++) { if (/#\/p\/review/.test(p.url())) break; const n = Number(/q\/(\d+)/.exec(p.url())?.[1] ?? 1); await p.waitForSelector(`text=Question ${n} of`, { timeout: 15000 }); await p.waitForSelector("fieldset.opts, textarea.in", { timeout: 15000 }); const r = p.locator("input.rd, input.cb").first(); if (await r.count()) await r.check(); else await p.locator("textarea.in").fill(`answer ${n}`); await p.waitForTimeout(150); await p.click("text=Next"); await p.waitForURL(new RegExp(`#/p/(q/${n + 1}|review)`)); if (target.includes("/p/q/") && /#\/p\/review/.test(p.url())) break; }
        if (target.includes("receipt")) { await p.goto(`${base}/next/#/p/review`); await p.waitForSelector("text=Send my answers", { timeout: 15000 }); await p.click("text=Send my answers"); await p.waitForSelector("text=Thank you", { timeout: 20000 }); }
      }
    }
    else if (!target.includes("welcome") && !target.includes("/p/")) await signIn(p);
    const sep = target.includes("?") ? "&" : "?";
    // theme rides the hash query (app/Live.svelte reads route.query)
    await p.goto(`${base}/next/?ui_next=on${target}${sep}theme=${theme}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
    await p.waitForFunction(() => !/Loading…/.test(document.body.textContent), null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(600);
    const af = path.join(out, `app-${b}-${w}x${h}-${theme}.png`); await p.screenshot({ path: af });
    let pct = null;
    if (bf) { const A = PNG.sync.read(fs.readFileSync(bf)), B = PNG.sync.read(fs.readFileSync(af)); const D = new PNG({ width: w, height: h }); const n = pixelmatch(A.data, B.data, D.data, w, h, { threshold: 0.1 }); fs.writeFileSync(path.join(out, `diff-${b}-${w}x${h}-${theme}.png`), PNG.sync.write(D)); pct = +(100 * n / (w * h)).toFixed(1); }
    rows.push({ board: b, w, h, theme, route: target, pct, boardFound: !!bf });
    console.log(`${b} ${w}x${h} ${theme}: ${pct === null ? "no board" : pct + "%"}`);
    await ctx.close();
  }
}
fs.writeFileSync(path.join(out, "measure-live.json"), JSON.stringify(rows, null, 1));
await br.close();
// Acceptance (playbook rule 15): every requested pair needs its board, and every pair must be <=5% changed pixels. Anything else fails.
const LIMIT = Number(process.env.LIMIT ?? 5);
const bad = rows.filter((r) => !r.boardFound || r.pct === null || r.pct > LIMIT);
if (bad.length) { console.log(`FAIL ${bad.length} of ${rows.length}: ` + bad.map((r) => `${r.board} ${r.w}x${r.h} ${r.theme} ${r.boardFound ? r.pct + "%" : "no board"}`).join("; ")); process.exit(1); }
console.log(`PASS ${rows.length} pairs <= ${LIMIT}%`);

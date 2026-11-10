// Rule 15 for the QR room, like-for-like (root plan step 5–6; design-system §8.7): capture the LIVE /next/#/review/<aid>/collect/qr
// at 1280x800 and 390x844, light + dark; read the tiles it drew (survey name, lens, n x n cells of the real links it issued); write that
// data identity to QR_DATA; regenerate the QRRoom/QRRoomPhone boards from it (python3 build.py, provenance off); diff full screens.
// Usage: node measure-qr.mjs <cookbookGeneratorDir> <base> <outDir> <aid>
import { chromium } from "playwright"; import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process";
import { PNG } from "pngjs"; import pixelmatch from "pixelmatch";
const [gen, base, out, aid] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const EMAIL = "uinext.demo@example.invalid";
const br = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const rows = [];
const LENS = { team: "team", community: "community", church: "church" };
for (const [b, w, h] of [["QRRoom", 1280, 800], ["QRRoomPhone", 390, 844]]) for (const theme of ["light", "dark"]) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" }); const p = await ctx.newPage();
  await p.goto(`${base}/next/?ui_next=on#/signin`); await p.fill("#si-email", EMAIL); await p.click("button[type=submit]"); await p.waitForSelector("#si-code"); await p.click("button[type=submit]"); await p.waitForSelector("text=Your reviews", { timeout: 20000 });
  await p.goto(`${base}/next/#/review/${aid}/collect/qr?theme=${theme}`); await p.waitForSelector(".qr", { timeout: 30000 }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(900);
  // data identity the live screen drew
  const tiles = await p.evaluate(() => [...document.querySelectorAll(".glass-hi[data-lens]")].map((t) => ({ lens: t.getAttribute("data-lens"), name: (t.querySelector(".h2")?.textContent ?? "").trim(), cells: [...t.querySelectorAll(".qr i")].map((i) => (i.classList.contains("o") ? "0" : "1")).join("") })));
  const phoneTile = tiles.length ? null : await p.evaluate(() => ({ lens: document.querySelector("[data-lens]")?.getAttribute("data-lens"), name: (document.querySelector("h1.h2")?.textContent ?? "").trim(), cells: [...document.querySelectorAll(".qr i")].map((i) => (i.classList.contains("o") ? "0" : "1")).join("") }));
  const af = path.join(out, `app-${b}-${w}x${h}-${theme}.png`); await p.screenshot({ path: af }); await ctx.close();
  // regenerate the board from the same identity (phone: the harness keeps the desktop capture's five surveys; the phone draws survey 3)
  if (tiles.length) fs.writeFileSync(path.join(out, "qr_data-runtime.json"), JSON.stringify({ encoder: "live screen (ui/assess/vendor-qrcode.js via app/data.js qrModules, qrcode(0,'M'))", host: new URL(base).host, review: "live", surveys: tiles.map((t) => ({ name: t.name, lens: LENS[t.lens] ?? t.lens, url: "(live link, not recorded)", n: Math.round(Math.sqrt(t.cells.length)), cells: t.cells })) }, null, 1));
  execSync(`cd ${gen} && QR_DATA=${path.join(out, "qr_data-runtime.json")} python3 build.py >/dev/null 2>&1`);
  const src = fs.readFileSync(path.join(gen, "project", `${b}.dc.html`), "utf8").replaceAll("{{theme}}", theme).replaceAll("{{imagery}}", "bars").replaceAll("{{prov}}", "");
  const tmp = path.join(out, `_b_${b}_${theme}.html`); fs.writeFileSync(tmp, src);
  const c2 = await br.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" }); const q = await c2.newPage();
  await q.goto("file://" + tmp); await q.evaluate(() => { document.querySelectorAll("aside[aria-label=Provenance]").forEach((e) => e.remove()); const a = document.querySelector(".app"); if (a) { a.style.width = "100%"; a.style.minHeight = "100vh"; } });
  await q.evaluate(() => document.fonts.ready); await q.waitForTimeout(400);
  const bf = path.join(out, `board-${b}-${w}x${h}-${theme}.png`); await q.screenshot({ path: bf }); await c2.close(); fs.unlinkSync(tmp);
  const A = PNG.sync.read(fs.readFileSync(bf)), B = PNG.sync.read(fs.readFileSync(af)); const D = new PNG({ width: w, height: h });
  const n = pixelmatch(A.data, B.data, D.data, w, h, { threshold: 0.1 }); fs.writeFileSync(path.join(out, `diff-${b}-${w}x${h}-${theme}.png`), PNG.sync.write(D));
  const pct = +(100 * n / (w * h)).toFixed(1); rows.push({ board: b, w, h, theme, pct, tiles: tiles.length || 1, n: tiles[0] ? Math.round(Math.sqrt(tiles[0].cells.length)) : null });
  console.log(`${b} ${w}x${h} ${theme}: ${pct}% (tiles ${tiles.length || 1}${tiles[0] ? `, n=${Math.round(Math.sqrt(tiles[0].cells.length))}` : ""})`);
}
fs.writeFileSync(path.join(out, "measure-qr.json"), JSON.stringify(rows, null, 1)); await br.close();

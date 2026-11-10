// Render boards at the shipping viewports, light + dark, provenance off (rule 15 reference renders; no app).
import { chromium } from "playwright"; import fs from "node:fs"; import path from "node:path";
const [canvas, out, ...names] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const br = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }) // CHROMIUM: another machine's Chromium binary (README);
for (const b of names) for (const theme of ["light", "dark"]) {
  const [w, h] = b.endsWith("Phone") || b.startsWith("P") && !b.startsWith("Pr") && !b.startsWith("Pe") && !b.startsWith("Pa") ? [390, 844] : [1280, 800];
  const src = fs.readFileSync(path.join(canvas, `${b}.dc.html`), "utf8").replaceAll("{{theme}}", theme).replaceAll("{{imagery}}", "bars").replaceAll("{{prov}}", "");
  const tmp = path.join(out, `_b_${b}_${theme}.html`); fs.writeFileSync(tmp, src);
  const ctx = await br.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" }); const p = await ctx.newPage();
  await p.goto("file://" + tmp); await p.evaluate(() => { document.querySelectorAll("aside[aria-label=Provenance]").forEach((e) => e.remove()); const a = document.querySelector(".app"); if (a) { a.style.width = "100%"; a.style.minHeight = "100vh"; } });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  const over = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }));
  await p.screenshot({ path: path.join(out, `board-${b}-${w}x${h}-${theme}.png`) }); fs.unlinkSync(tmp); await ctx.close();
  console.log(b, w + "x" + h, theme, "scroll", over.sw + "x" + over.sh);
}
await br.close();

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
// Screenshots and drive.json land in spike/mcp-ui/out/ (same tree as the committed artifacts).
const OUT = process.env.OUT ?? new URL("./out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const CASES = [
  ["overview-default", "assessment_overview", { fixture: "default" }],
  ["overview-empty", "assessment_overview", { fixture: "empty" }],
  ["overview-error", "assessment_overview", { fixture: "error" }],
  ["selector-default", "survey_selector", { fixture: "default" }],
  ["selector-viewer", "survey_selector", { fixture: "viewer" }],
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

const report = {};
for (const [name, tool, args] of CASES) {
  await page.goto("http://localhost:8080/index.html");
  await page.locator("select").first().waitFor({ state: "visible", timeout: 30000 });
  await page.locator('button:has-text("Call Tool")').waitFor({ timeout: 30000 });
  // tool select is the second select
  await page.locator("select").nth(1).selectOption(tool);
  const ta = page.locator("textarea").first();
  await ta.fill(JSON.stringify(args));
  await page.locator('button:has-text("Call Tool")').click();
  const outer = page.frameLocator("iframe").first();
  const app = outer.frameLocator("iframe").first();
  let state = "(none)";
  try {
    await app.locator("body[data-view-state]:not([data-view-state='loading'])").waitFor({ timeout: 20000 });
    state = await app.locator("body").getAttribute("data-view-state");
  } catch (e) {
    state = "TIMEOUT: " + e.message.split("\n")[0];
  }
  await app.locator("#root").waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const text = await app.locator("body").innerText().catch((e) => "(no text: " + e.message.split("\n")[0] + ")");
  // Overview default: exercise the Open in app button (openLinks capability)
  if (name === "overview-default") {
    const b = app.locator("#open-in-app");
    if (await b.count()) {
      await b.click();
      await page.waitForTimeout(500);
      report[name + ":openLinkOutcome"] = await app.locator(".view-footer").innerText().catch(() => null);
    }
  }
  // Selector cases: exercise the Preview selection button too
  let preview = null;
  if (tool === "survey_selector") {
    const btn = app.locator("#preview-selection");
    const disabled = await btn.isDisabled().catch(() => null);
    if (disabled === false) {
      await btn.click();
      await app.locator("#preview-output").waitFor({ timeout: 5000 }).catch(() => {});
      preview = await app.locator("#preview-output").innerText().catch(() => null);
      await page.waitForTimeout(300);
    }
    report[name + ":previewDisabled"] = disabled;
    report[name + ":resetDisabled"] = await app.locator("#reset-pending").isDisabled().catch(() => null);
  }
  await page.screenshot({ path: `${OUT}/${name}.png` });
  // record sandbox attributes as the host applied them
  const sandboxAttrs = await page.evaluate(() => {
    const outerIframe = document.querySelector("iframe");
    return { outer: { sandbox: outerIframe?.getAttribute("sandbox"), allow: outerIframe?.getAttribute("allow"), src: outerIframe?.getAttribute("src") } };
  });
  const innerAttrs = await outer.locator("iframe").first().evaluate((el) => ({
    sandbox: el.getAttribute("sandbox"), allow: el.getAttribute("allow"), hasSrcdoc: el.hasAttribute("srcdoc"),
  })).catch((e) => "(unreadable: " + e.message.split("\n")[0] + ")");
  report[name] = { state, textHead: text.slice(0, 700), preview, sandboxAttrs, innerAttrs };
}
const caps = logs.filter((l) => l.includes("host capabilities"));
console.log(JSON.stringify({ report, caps, logs: logs.slice(-40) }, null, 2));
await browser.close();

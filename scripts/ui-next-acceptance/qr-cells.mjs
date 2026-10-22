// Emit the QR module grid the app draws for each survey link, with the app's own encoder and settings (ui/assess/vendor-qrcode.js,
// typeNumber 0 = auto, error correction M — the same call as ui-next/src/app/data.js qrModules), so the cookbook boards can be
// generated from the SAME cells for the same seeded URLs (design-system §8.7 QR module grid; parity-loop debt 7).
//   node scripts/ui-next-acceptance/qr-cells.mjs <identity.json>   → prints JSON { encoder, host, surveys:[{name, lens, url, n, cells}] }
// identity.json: { host, surveys: [{ name, lens, url }] } — the real seeded links (local throwaway tokens are fine to commit; DEV tokens are not:
// generate at measure time and pass the file to build.py through QR_DATA instead).
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import qrcode from "../../ui/assess/vendor-qrcode.js";
const id = JSON.parse(readFileSync(process.argv[2], "utf8"));
const sha = (() => { try { return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim(); } catch { return "unknown"; } })();
const out = { encoder: `klappy/3d-review-app ui/assess/vendor-qrcode.js @${sha} · qrcode(0, "M") · typeNumber auto · error correction M`, host: id.host, surveys: id.surveys.map((s) => { const q = qrcode(0, "M"); q.addData(s.url); q.make(); const n = q.getModuleCount(); let cells = ""; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells += q.isDark(r, c) ? "1" : "0"; return { ...s, n, cells }; }) };
process.stdout.write(JSON.stringify(out, null, 1) + "\n");

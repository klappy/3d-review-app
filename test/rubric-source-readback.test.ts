import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
// seed/source/rubric_csv must be byte-identical to klappy/3d-quality-review@f042cde rubric_csv (Astra 5706308285).
describe("pinned rubric source readback", () => {
  it("every committed CSV matches the recorded sha256 and the manifest counts", () => {
    const dir = new URL("../seed/source/rubric_csv/", import.meta.url);
    const recorded = Object.fromEntries(readFileSync(new URL("../seed/source/rubric_csv.sha256", import.meta.url), "utf8").trim().split("\n").map((l) => { const [h, f] = l.split(/\s+/); return [f, h]; }));
    const files = readdirSync(dir).filter((f) => f.endsWith(".csv")).sort();
    expect(files).toEqual(Object.keys(recorded).sort());
    for (const f of files) expect(createHash("sha256").update(readFileSync(new URL(f, dir))).digest("hex"), f).toBe(recorded[f]);
    const items = readFileSync(new URL("Items.csv", dir), "utf8").trim().split("\n").length - 1;
    const options = readFileSync(new URL("Options.csv", dir), "utf8").trim().split("\n").length - 1;
    expect(items).toBe(111); expect(options).toBe(498);
    const manifest = JSON.parse(readFileSync(new URL("../seed/synthetic/manifest.json", import.meta.url), "utf8"));
    expect(manifest.rubric.items).toBe(111); expect(manifest.rubric.options).toBe(498); expect(manifest.source.reads_real_exports).toBe(false);
  });
});

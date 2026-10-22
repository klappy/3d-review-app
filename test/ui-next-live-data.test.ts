// UI Next (v4) live data helpers (status: provisional): QR modules for a real survey link, gap names from a built report, stage words.
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .js module, no type declarations
import { qrModules, gapsOf, radarOf, STAGE_OF, lensKeyOf, shortDate } from "../ui-next/src/app/data.js";

describe("live data helpers", () => {
  it("a date-only period day is read as that calendar day in every timezone, never shifted through UTC (captain CUA: Oct 22 showed as Oct 21 in America/New_York)", () => {
    const tz = process.env.TZ; process.env.TZ = "America/New_York";
    try { expect(shortDate("2026-10-22")).toBe("Oct 22"); expect(shortDate("2026-11-22")).toBe("Nov 22"); } finally { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz; }
    expect(shortDate("not a date")).toBe("");
  });
  it("encodes a survey link as a square module grid larger than the boards' 21x21", () => {
    const { n, cells } = qrModules("https://dev.3dreview.app/next/#survey=link_GbXohvv-fTJm2GksjCwoFsuTza5vXqxl");
    expect(n).toBeGreaterThan(21);
    expect(cells).toMatch(/^[01]+$/);
    expect(cells.length).toBe(n * n);
  });
  it("names the widest gaps and the narrowest agreement from cross_lens_multi", () => {
    const payload = { cross_lens_multi: [{ construct_name: "A", agreement_range: 5 }, { construct_name: "B", agreement_range: 25 }, { construct_name: "C", agreement_range: 17 }, { construct_name: "D", agreement_range: 1 }, { construct_name: "E", agreement_range: 9 }] };
    expect(gapsOf(payload)).toEqual({ biggest: ["B", "C", "E"], agree: ["D"] });
    expect(radarOf(payload)).toEqual(["A", "B", "C", "D", "E"]);
    expect(gapsOf(null)).toEqual({ biggest: [], agree: [] });
  });
  it("maps server stages and perspectives to the lanes' words", () => {
    expect(STAGE_OF.prepare).toBe("setup"); expect(STAGE_OF.collect).toBe("collecting"); expect(STAGE_OF.understand).toBe("results");
    expect(lensKeyOf("Translation Team")).toBe("team"); expect(lensKeyOf("Church")).toBe("church"); expect(lensKeyOf("Other")).toBeNull();
  });
});

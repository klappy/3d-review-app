// UI Next (v4) live data helpers (status: provisional): QR modules for a real survey link, gap names from a built report, stage words.
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .js module, no type declarations
import { qrModules, gapsOf, radarOf, STAGE_OF, lensKeyOf, shortDate } from "../ui-next/src/app/data.js";
import { qrPrintHtml, openQrPrint } from "../ui-next/src/app/print.js";

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
  it("Print QR pages: the print document carries each chosen survey's real link and QR (ui/assess/share.js sheets), one page per survey or all on one, prints itself, and reports a blocked tab", () => {
    const surveys = [{ name: "Written", fullLink: "http://x/next/?ui_next=on#survey=link_1" }, { name: "Involved-Pastor", fullLink: "http://x/next/?ui_next=on#survey=link_2" }, { name: "held", fullLink: null }];
    const one = qrPrintHtml({ title: "Mark 1–4 draft", surveys, per: "survey", paper: "A4", autoPrint: true });
    expect(one.match(/class="share-sheet-print"/g)).toHaveLength(2); expect(one).toContain("link_1"); expect(one).toContain("link_2"); expect(one).toContain("<svg"); expect(one).toContain("@page{size:A4}"); expect(one).toContain("print()},300)");
    const all = qrPrintHtml({ title: "Mark 1–4 draft", surveys, per: "one", paper: "Letter" });
    expect(all).toContain("data-print-all-sheet"); expect(all.match(/<li class="share-all-item"/g)).toHaveLength(2); expect(all).not.toContain("print()},300)");
    expect(qrPrintHtml({ title: "t", surveys: [{ name: "x", fullLink: null }] })).toBe("");
    const sheet = qrPrintHtml({ title: "Mark 1–4 draft", surveys, per: "sheet", paper: "Letter" }); // hand-out cards: one page per survey, six cards each
    expect(sheet.match(/class="share-sheet-print share-all share-cards"/g)).toHaveLength(2); expect(sheet.match(/<li class="share-all-item"/g)).toHaveLength(12); expect(sheet.match(/link_1/g)!.length).toBe(6);
    const written: string[] = []; const fake = { open: () => ({ document: { open() {}, write: (h: string) => written.push(h), close() {} } }) };
    expect(openQrPrint(fake as never, { title: "t", surveys, per: "survey", paper: "Letter" })).toBe(true); expect(written[0]).toContain("link_1");
    expect(openQrPrint({ open: () => null } as never, { title: "t", surveys, per: "survey", paper: "Letter" })).toBe(false);
  });
});

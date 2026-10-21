// UI Next (v4) board glyph set in the shared icons.js (status: provisional). Cookbook unit work/active/2026-10-21-ui-next-screens-fanout/
// (VALIDATION-explore-r3.md R3-3, VALIDATION-participant.md F13): lanes redefined pen, people, globe, clock and mail with their own
// path data; icons.js G carries the canvas's icon set (generator/gen.py ICONS) so lanes import one glyph per name.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error -- plain .mjs script, no type declarations
import { boardGlyphs, toPath } from "../scripts/ui-next-glyphs.mjs";
// @ts-expect-error -- plain .js module, no type declarations
import { G, I } from "../ui-next/src/icons.js";

const genPy = readFileSync(resolve(process.cwd(), "ui-next/design-source/gen.py"), "utf8");

describe("icons.js G = the board glyph set (gen.py ICONS at the PIN)", () => {
  it("equals the conversion of the vendored gen.py ICONS, name for name and in gen.py order", () => {
    const want = boardGlyphs(genPy);
    expect(Object.keys(want).length).toBe(34);
    expect(Object.keys(G)).toEqual(Object.keys(want));
    expect({ ...G }).toEqual(want);
    expect(Object.isFrozen(G)).toBe(true);
  });
  it("each glyph is one path d (no markup), so the shared Icon and the lanes' glyph components draw it", () => {
    for (const [k, d] of Object.entries(G)) expect(d, k).toMatch(/^M[-\d.\s,a-zA-Z]+$/);
  });
  it("the converter keeps the geometry: circle -> two arcs, rounded rect -> lines + arcs, plain rect -> closed box", () => {
    expect(toPath('<circle cx="12" cy="12" r="8.5"></circle>')).toBe("M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17");
    expect(toPath('<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"></rect>')).toBe("M7.5 10.5h9a2.5 2.5 0 0 1 2.5 2.5v4.5a2.5 2.5 0 0 1-2.5 2.5h-9a2.5 2.5 0 0 1-2.5-2.5v-4.5a2.5 2.5 0 0 1 2.5-2.5z");
    expect(toPath('<rect x="4" y="4" width="6" height="6"></rect>')).toBe("M4 4h6v6h-6z");
    expect(toPath('<path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>')).toBe("M5 12h14M13 6l6 6-6 6");
    expect(() => toPath('<line x1="0" y1="0" x2="1" y2="1"></line>')).toThrow(/unsupported/);
  });
  it("carries every name the lanes drew locally (aliases: download=down, doc=file, calendar=cal, mic=audio, open/share=out, more=dots, edit=pen, printer=print, reviews=clipboard)", () => {
    for (const k of ["pen", "people", "globe", "clock", "mail", "down", "file", "cal", "audio", "out", "dots", "print", "clipboard", "qr", "lock", "search", "list", "refresh", "warn", "link", "copy", "video", "church", "upload", "eye", "play", "sparkle", "help", "check", "x", "plus", "chev", "back", "arrow"])
      expect(Object.hasOwn(G, k), k).toBe(true);
  });
  it("I (the Home port's set) is unchanged by this slice; the shared arrows and marks are the board's", () => {
    expect(Object.keys(I)).toEqual(["help", "chev", "arrow", "play", "back", "x", "mail", "sparkle", "pen", "people", "out", "check", "clock", "eye", "plus", "globe"]);
    for (const k of ["chev", "arrow", "play", "back", "x", "plus"]) expect(I[k], k).toBe(G[k]);
  });
});

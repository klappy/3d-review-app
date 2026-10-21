// UI Next base.css is the design system's helmet, generated (scripts/ui-next-base.mjs); CI fails when it drifts from the pinned source.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { generate, OUTPUT } from "../scripts/ui-next-base.mjs";

describe("base.css", () => {
  it("is exactly what the pinned helmet generates (--check)", () => {
    expect(readFileSync(OUTPUT, "utf8")).toBe(generate());
  });
  it("pins the cookbook sha in its header", () => {
    expect(readFileSync(OUTPUT, "utf8")).toMatch(/3d-review-cookbook @[0-9a-f]{40}/);
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { groupByLens, LENSES } from "./lens.mjs";

const fixture = JSON.parse(readFileSync(path.join(import.meta.dirname, "fixture", "assessment.json"), "utf8"));

test("groupByLens on the default fixture yields 2 / 4 / 2 included", () => {
  const groups = groupByLens(fixture.variants.default);
  assert.deepEqual(groups.map(g => g.lens), LENSES);
  assert.deepEqual(groups.map(g => g.included.length), [2, 4, 2]);
});

test("every included survey has a counts entry keyed by survey id", () => {
  const { surveys, counts } = fixture.variants.default;
  for (const s of surveys) {
    assert.ok(counts[s.id], `no counts for ${s.id}`);
    assert.equal(typeof counts[s.id].responses, "number");
    assert.equal(typeof counts[s.id].respondents, "number");
  }
});

test("the empty fixture groups to three empty lenses", () => {
  const groups = groupByLens({ ...fixture.variants.empty, templates: [] });
  assert.deepEqual(groups.map(g => g.included.length), [0, 0, 0]);
});

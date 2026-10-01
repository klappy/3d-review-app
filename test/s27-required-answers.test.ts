/** S27 (0.24.1 persona B): required answers were refused one at a time ("answer required for CW-Q4"). */
import { describe, expect, it } from "vitest";
import { validateAnswers } from "../src/handlers/response";
import { CapError } from "../src/handlers/errors";

const items: any[] = [
  { id: "CW-Q1", type: "scale", scale: { min: 1, max: 5 } },
  { id: "CW-Q2", type: "text", required: false },
  { id: "CW-Q4", type: "single", options: [{ code: "a" }] },
  { id: "CW-Q5", type: "multi", options: [{ code: "x" }] },
  { id: "CW-Q7", type: "text" },
];
const refusal = (answers: unknown) => { try { validateAnswers(items, answers); } catch (e) { return e as CapError; } throw new Error("accepted"); };

describe("every missing required answer in one refusal", () => {
  it("names all missing required answers at once, in form order, with a hint", () => {
    const e = refusal({ "CW-Q1": 3, "CW-Q5": [] });
    expect(e.code).toBe("INVALID_PARAMS");
    expect(e.message).toBe("answers required for CW-Q4, CW-Q5, CW-Q7");
    expect(e.hint).toBe("answer all 3, then submit again");
  });
  it("one missing answer keeps the old wording", () => {
    expect(refusal({ "CW-Q1": 3, "CW-Q4": "a", "CW-Q5": ["x"] }).message).toBe("answer required for CW-Q7");
  });
  it("missing answers are named before an invalid one; a full answer set still passes, optional blanks become null", () => {
    expect(refusal({ "CW-Q1": 9 }).message).toBe("answers required for CW-Q4, CW-Q5, CW-Q7");
    expect(refusal({ "CW-Q1": 9, "CW-Q4": "a", "CW-Q5": ["x"], "CW-Q7": "ok" }).message).toBe("invalid scale answer for CW-Q1");
    expect(validateAnswers(items, { "CW-Q1": 4, "CW-Q4": "a", "CW-Q5": ["x"], "CW-Q7": "ok" })).toEqual({ "CW-Q1": 4, "CW-Q2": null, "CW-Q4": "a", "CW-Q5": ["x"], "CW-Q7": "ok" });
  });
});

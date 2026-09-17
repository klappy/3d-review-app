import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COVERAGE,
  FLOOR_REQUIRE,
  TOKEN_RE,
  applyInjectFail,
  classifyD1,
  classifyJ1g,
  classifyJ2neg,
  classifyJ6,
  classifyJ6plus,
  coverageGaps,
  exitCode,
  formatJourneysSummary,
  parseRequireExtra,
  redactRows,
  requiredIds,
  scanLeaks,
} from "../scripts/journeys.mjs";
import { compare, summarizeParity } from "../scripts/parity.mjs";

const spec = JSON.parse(readFileSync(new URL("../scenarios/journeys.json", import.meta.url), "utf8"));

function pass(id: string) {
  return { id, verdict: "PASS" as const, note: "ok", evidence: { status: 200, code: "ok" } };
}
function fail(id: string) {
  return { id, verdict: "FAIL" as const, note: "no", evidence: { status: 500, code: "no" } };
}
function skip(id: string) {
  return { id, verdict: "SKIP" as const, note: "skip", evidence: { status: 0 } };
}
function reserved(id: string) {
  return { id, verdict: "RESERVED_501" as const, note: "501", evidence: { status: 501, code: "RESERVED_NOT_BUILT" } };
}
function floorPass(extra: ReturnType<typeof pass>[] = []) {
  return [...FLOOR_REQUIRE.map(pass), ...extra];
}

describe("NC-1 J6 polarity (falsifies D3)", () => {
  it("FAIL on ok:true data for an ungranted read", () => {
    const row = classifyJ6({ ok: true, result: { scores: [1] } });
    expect(row.verdict).toBe("FAIL");
    expect(row.note).toMatch(/isolation broken/);
  });
  it("PASS only on NOT_FOUND_OR_NOT_VISIBLE with ok:false", () => {
    const row = classifyJ6({ ok: false, error: { code: "NOT_FOUND_OR_NOT_VISIBLE" } });
    expect(row.verdict).toBe("PASS");
  });
  it("does not mix ok:true with a refusal as PASS", () => {
    expect(classifyJ6({ ok: true, error: { code: "NOT_FOUND_OR_NOT_VISIBLE" } }).verdict).toBe("FAIL");
  });
});

describe("NC-2 exit codes (falsifies D1)", () => {
  it("one FAIL → exit 1; all floor PASS → 0", () => {
    expect(exitCode([...floorPass(), fail("J13")])).toBe(1);
    expect(exitCode(floorPass())).toBe(0);
  });
  it("PASS + SKIP exits 1 under default --strict; 0 only with --allow-skip when floor is met", () => {
    const rows = [...floorPass(), skip("D1")];
    expect(exitCode(rows)).toBe(1);
    expect(exitCode(rows, { allowSkip: true })).toBe(0);
  });
});

describe("NC-3 J2-neg / D1 polarity (falsifies D4/D5)", () => {
  it("J2 501 is FAIL not PASS", () => {
    expect(classifyJ2neg(501, { ok: false, error: { code: "RESERVED_NOT_BUILT" } }).verdict).toBe("FAIL");
    expect(classifyJ2neg(400, { ok: false, error: { code: "INVALID_PARAMS" } }).verdict).toBe("PASS");
    expect(classifyJ2neg(404, { ok: false, error: { code: "NOT_FOUND_OR_NOT_VISIBLE" } }).verdict).toBe("PASS");
  });
  it("D1 refusal without EXPECT_PROVISIONED is SKIP not PASS", () => {
    expect(classifyD1({ ok: false, error: { code: "NOT_AUTHORIZED_AT_SCOPE" } }, false).verdict).toBe("SKIP");
    expect(classifyD1({ ok: false, error: { code: "NOT_AUTHORIZED_AT_SCOPE" } }, true).verdict).toBe("FAIL");
    expect(classifyD1({ ok: true, result: { workspace: { id: "ws_1" } } }, true).verdict).toBe("PASS");
  });
  it("J1g fails when a 200 has no undo token", () => {
    expect(classifyJ1g(200, { ok: true, result: { count: 2 } }, null).verdict).toBe("FAIL");
  });
});

describe("NC-4 parity totals (falsifies D6/D8)", () => {
  it("81 same + 2 excluded never prints 83/83", () => {
    const entries = [
      ...Array.from({ length: 81 }, (_, i) => ({ id: `cap.x.${i}`, eq: true, tag: "REFUSAL-PARITY" as const })),
      { id: "cap.docs.openapi", excluded: true },
      { id: "cap.auth.logout", excluded: true },
    ];
    const s = summarizeParity(entries, 83);
    expect(s).toMatchObject({ same: 81, compared: 81, excluded: 2, differ: 0, contract: 83 });
    expect(s.line).toBe("parity same=81/compared=81 · excluded=2 (docs.openapi, auth.logout) · contract=83");
    expect(s.text).not.toContain("83/83");
    expect(s.exitCode).toBe(0);
  });
  it("one differing pair → differ=1 and exit 1", () => {
    const entries = [
      { id: "a", eq: true, tag: "RESULT-PARITY" as const },
      { id: "b", eq: false, tag: "DIFFER" as const },
      { id: "cap.docs.openapi", excluded: true },
    ];
    const s = summarizeParity(entries, 83);
    expect(s.differ).toBe(1);
    expect(s.same).toBe(1);
    expect(s.compared).toBe(2);
    expect(s.excluded).toBe(1);
    expect(s.exitCode).toBe(1);
  });
});

describe("NC-5 parity class tags (falsifies D7 mislabelling)", () => {
  it("two identical refusals are REFUSAL-PARITY", () => {
    const env = { ok: false, error: { code: "NOT_FOUND_OR_NOT_VISIBLE" } };
    const c = compare(env, env);
    expect(c.eq).toBe(true);
    expect(c.tag).toBe("REFUSAL-PARITY");
  });
  it("two identical ok:true results are RESULT-PARITY", () => {
    const env = { ok: true, result: { n: 1 } };
    const c = compare(env, env);
    expect(c.eq).toBe(true);
    expect(c.tag).toBe("RESULT-PARITY");
  });
  it("ok:true vs ok:false is a differ", () => {
    const c = compare({ ok: true, result: {} }, { ok: false, error: { code: "NOT_FOUND_OR_NOT_VISIBLE" } });
    expect(c.eq).toBe(false);
    expect(c.tag).toBe("DIFFER");
  });
  it("both RESERVED_NOT_BUILT stay REFUSAL-PARITY reserved", () => {
    const env = { ok: false, error: { code: "RESERVED_NOT_BUILT" } };
    const c = compare(env, env);
    expect(c.tag).toBe("REFUSAL-PARITY");
    expect(c.reserved).toBe(true);
  });
});

describe("NC-6 hand-maintained coverage (falsifies D2 as execution claim)", () => {
  it("names exactly the 14 spec ids and forbids EXECUTED unless every spec capability is asserted", () => {
    const gaps = coverageGaps(spec.journeys);
    expect(Object.keys(COVERAGE).sort()).toEqual(spec.journeys.map((j: { id: string }) => j.id).sort());
    expect(gaps.extras).toEqual([]);
    expect(gaps.missing).toEqual([]);
    expect(gaps.illegalExecuted).toEqual([]);
    expect(COVERAGE.J1.label).toBe("PARTIAL");
    expect(COVERAGE.J1.capabilities).not.toContain("cap.survey.issue_codes");
    expect(COVERAGE.J1.capabilities).not.toContain("cap.survey.export_codes");
    const j1 = spec.journeys.find((j: { id: string }) => j.id === "J1");
    expect(j1.steps.map((s: { capability: string }) => s.capability)).toEqual([
      "cap.assessment.create",
      "cap.survey.select",
      "cap.survey.select",
      "cap.survey.issue_codes",
      "cap.survey.export_codes",
      "cap.survey.export_codes",
    ]);
  });
});

describe("NC-7 floor, SKIP/RESERVED, --allow-skip, redaction (rev3)", () => {
  it("all RESERVED_501 exits 1 (floor unmet)", () => {
    expect(exitCode(FLOOR_REQUIRE.map(reserved))).toBe(1);
  });
  it("all PASS missing one default REQUIRE id exits 1", () => {
    expect(exitCode(FLOOR_REQUIRE.filter((id) => id !== "J6").map(pass))).toBe(1);
  });
  it("--allow-skip with SKIPs exits 0 only when the floor still PASSes", () => {
    expect(exitCode([...floorPass(), skip("D1"), skip("J6+")], { allowSkip: true })).toBe(0);
    expect(exitCode([...FLOOR_REQUIRE.filter((id) => id !== "OUT").map(pass), skip("OUT")], { allowSkip: true })).toBe(1);
  });
  it("REQUIRE= may only add; it cannot drop the floor", () => {
    expect(requiredIds(["J9"])).toEqual([...FLOOR_REQUIRE, "J9"]);
    expect(requiredIds(["AUTH"])).toEqual([...FLOOR_REQUIRE]);
    expect(parseRequireExtra("J13", ["REQUIRE=J9"])).toEqual(["J13", "J9"]);
    expect(exitCode(floorPass(), { extraRequire: ["J13"] })).toBe(1);
  });
  it("unanchored token + Bearer scan over JSON.stringify(rows) redacts evidence", () => {
    const token = "st_" + "A".repeat(32);
    const nested = `prefix ${token} suffix`;
    const dirty = [{
      id: "AUTH",
      verdict: "PASS",
      note: `Authorization: Bearer ${token}`,
      evidence: { status: 200, code: "ok", planted: nested },
    }];
    expect(TOKEN_RE.test(JSON.stringify(dirty))).toBe(true);
    expect(JSON.stringify(dirty)).toContain("Bearer ");
    const clean = redactRows(dirty);
    const leaked = scanLeaks(clean);
    expect(leaked.token).toBe(false);
    expect(leaked.bearer).toBe(false);
    expect(JSON.stringify(clean)).not.toMatch(TOKEN_RE);
    expect(JSON.stringify(clean)).not.toContain("Bearer ");
  });
  it("J6+ without VIEWER_SESS is SKIP; INJECT_FAIL forces that row FAIL", () => {
    expect(classifyJ6plus(null, null, false).verdict).toBe("SKIP");
    const injected = applyInjectFail([classifyJ6({ ok: false, error: { code: "NOT_FOUND_OR_NOT_VISIBLE" } })], "J6");
    expect(injected[0].verdict).toBe("FAIL");
    expect(injected[0].note).toBe("INJECT_FAIL=J6");
  });
  it("summary cites PASS/FAIL/RESERVED/SKIP and never a bare table as acceptance", () => {
    const line = formatJourneysSummary(floorPass(), { allowSkip: true });
    expect(line).toMatch(/^journeys PASS=\d+ FAIL=\d+ RESERVED=\d+ SKIP=\d+/);
    expect(line).toContain("spec journeys: 14");
  });
});

/*
  Injected-FAIL local proof (disposable fixture, never DEV):

    node --input-type=module <<'EOF'
    // see PR body for the exact /tmp fixture used in this cloud-agent VM
    EOF

    INJECT_FAIL=J6 BASE=http://127.0.0.1:<port> node scripts/journeys.mjs --allow-skip
    # expect: J6 verdict FAIL, process exit 1

  Auditor acceptance of that live receipt is a separate gate.
*/

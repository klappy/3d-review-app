import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// S37 offline contract parity: contract/openapi.yaml ↔ contract/capabilities.json, row by row, no server and no SESS bearer.
// Row ↔ route mapping is borrowed from scripts/parity.mjs: each capability row's HTTP twin is c.http.{method,path}, and path
// placeholders ({aid}, {sid}, …) are carried as params. Every route (c.http plus c.http_alt) must exist in openapi.yaml, but
// schemas are compared on c.http only, as scripts/parity.mjs does. Schema agreement is judged only on what both files declare:
// property names, the `required` list and `additionalProperties` (compared when both sides state it), recursing into nested
// `properties`, array `items` and `oneOf` branches wherever both sides declare a nested shape.

type Json = any;
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const catalog = JSON.parse(read("../contract/capabilities.json"));
const caps: Json[] = catalog.capabilities;

// Minimal YAML reader for the subset contract/openapi.yaml uses: block maps and sequences, plain/quoted scalars with
// indented continuation lines, and inline JSON flow values (single- or multi-line). No YAML dependency is in package.json.
function parseYaml(src: string): Json {
  const P = src.split("\n");
  let i = 0;
  const ind = (l: string) => l.length - l.trimStart().length;
  const skip = () => { while (i < P.length && (P[i].trim() === "" || P[i].trimStart().startsWith("#"))) i++; };
  const depth = (t: string) => {
    let d = 0, q = "";
    for (let k = 0; k < t.length; k++) {
      const c = t[k];
      if (q) { if (c === "\\") k++; else if (c === q) q = ""; }
      else if (c === '"') q = c;
      else if (c === "{" || c === "[") d++;
      else if (c === "}" || c === "]") d--;
    }
    return d;
  };
  const flow = (first: string): Json => {
    let t = first;
    while (depth(t) > 0) { if (i >= P.length) throw new Error(`unterminated flow value: ${first.slice(0, 60)}`); t += "\n" + P[i++]; }
    try { return JSON.parse(t); } catch { /* YAML flow map, below */ }
    const m = t.trim().match(/^\{(.*)\}$/s);
    if (!m || /[{}\[\]"]/.test(m[1])) throw new Error(`unsupported flow value: ${t.slice(0, 80)}`);
    const o: Json = {};
    for (const part of m[1].split(",")) { const [k, ...v] = part.split(":"); o[k.trim()] = scalar(v.join(":").trim(), Infinity); }
    return o;
  };
  const scalar = (v: string, keyInd: number): Json => {
    if (v.startsWith("{") || v.startsWith("[")) return flow(v);
    while (i < P.length && P[i].trim() !== "" && ind(P[i]) > keyInd) { v += " " + P[i].trim(); i++; }
    if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
    if (v.startsWith('"') && v.endsWith('"')) return JSON.parse(v);
    if (v === "true") return true;
    if (v === "false") return false;
    if (v === "null" || v === "~") return null;
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
  };
  const splitKey = (s: string): [string, string] => {
    if (s.startsWith("'") || s.startsWith('"')) { const e = s.indexOf(s[0], 1); return [s.slice(1, e), s.slice(e + 1).replace(/^:\s?/, "").trim()]; }
    const m = s.match(/^([^\s][^:]*?):(?:\s+(.*))?$/);
    if (!m) throw new Error(`not a mapping line: ${s.slice(0, 80)}`);
    return [m[1], (m[2] ?? "").trim()];
  };
  const value = (v: string, keyInd: number): Json => {
    if (v !== "") return scalar(v, keyInd);
    skip();
    if (i >= P.length) return null;
    const n = ind(P[i]), t = P[i].trimStart();
    if (n > keyInd && (t.startsWith("{") || t.startsWith("["))) { i++; return flow(t); }
    if (n > keyInd) return t.startsWith("- ") || t === "-" ? seq(n) : map(n);
    if (n === keyInd && (t.startsWith("- ") || t === "-")) return seq(n);
    return null;
  };
  const map = (n: number, o: Json = {}): Json => {
    for (;;) {
      skip();
      if (i >= P.length || ind(P[i]) !== n || P[i].trimStart().startsWith("- ")) return o;
      const [k, v] = splitKey(P[i].trim());
      i++;
      o[k] = value(v, n);
    }
  };
  const seq = (n: number): Json[] => {
    const a: Json[] = [];
    for (;;) {
      skip();
      if (i >= P.length || ind(P[i]) !== n || !P[i].trimStart().startsWith("-")) return a;
      const rest = P[i].trimStart().slice(1).trimStart();
      const itemInd = n + (P[i].trimStart().length - rest.length);
      i++;
      if (rest === "") { a.push(value("", n)); continue; }
      if (rest.startsWith("{") || rest.startsWith("[") || !/^('[^']*'|"[^"]*"|[^\s'"{[][^:]*?):(\s|$)/.test(rest)) { a.push(scalar(rest, n)); continue; }
      const [k, v] = splitKey(rest);
      a.push(map(itemInd, { [k]: value(v, itemInd) }));
    }
  };
  skip();
  return map(ind(P[i]));
}

const oas = parseYaml(read("../contract/openapi.yaml"));
const ENVELOPE = "#/components/schemas/Envelope";
const deref = (s: Json): Json => {
  for (let n = 0; s && s.$ref; n++) {
    if (n > 10) throw new Error(`$ref loop at ${s.$ref}`);
    s = oas.components.schemas[String(s.$ref).replace("#/components/schemas/", "")];
  }
  return s;
};
const routes = (c: Json): { method: string; path: string }[] => [c.http, ...(c.http_alt ?? [])];
const op = (r: { method: string; path: string }): Json | null => oas.paths?.[r.path]?.[r.method.toLowerCase()] ?? null;
const pathParams = (path: string) => [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

type Shape = { props: string[]; required: string[]; additionalProperties?: Json; nested?: Record<string, Shape> } | { oneOf: Shape[] };
const sorted = (a: string[]) => [...new Set(a)].sort();
// A schema declares fields when it carries `properties` (or a oneOf of such branches); an open generic object does not.
// Nested shapes are kept per property (`name`, or `name[]` for an array's items) so diff() can recurse into them.
function shape(s: Json, level = 0): Shape | null {
  s = deref(s);
  if (!s || level > 20) return null;
  if (Array.isArray(s.oneOf)) {
    // A branch with no fields (e.g. {type: "null"}) stays as an empty placeholder so the object branches still line up.
    const b = s.oneOf.map((x: Json) => shape(x, level + 1));
    return b.some(Boolean) ? { oneOf: b.map((x: Shape | null) => x ?? { props: [], required: [] }) } : null;
  }
  if (!s.properties) return null;
  const props = Object.keys(s.properties);
  if (props.length === 0 && s.additionalProperties === true) return null;
  const out: Shape = { props: sorted(props), required: sorted(s.required ?? []) };
  if ("additionalProperties" in s) out.additionalProperties = s.additionalProperties;
  const nested: Record<string, Shape> = {};
  for (const k of props) {
    const v = deref(s.properties[k]);
    const sub = shape(v, level + 1);
    if (sub) nested[k] = sub;
    const items = v?.items ? shape(v.items, level + 1) : null;
    if (items) nested[`${k}[]`] = items;
  }
  if (Object.keys(nested).length) out.nested = nested;
  return out;
}
// OpenAPI request side for one route: JSON body (unwrapping a {params} envelope the capability itself does not name),
// plus path placeholders carried as params as scripts/parity.mjs does; a body-less route declares its path/query parameters.
function oasRequest(c: Json, route: { method: string; path: string }): Shape | null {
  const o = op(route);
  if (!o) return null; // the per-route existence test names the missing route
  let body = deref(o.requestBody?.content?.["application/json"]?.schema);
  if (body?.properties?.params && !c.params_schema?.properties?.params) body = body.properties.params;
  if (body) {
    const b = shape(body);
    const pp = pathParams(route.path);
    if (!b && pp.length === 0) return null;
    if (b && "oneOf" in b) return b;
    return { ...(b ?? {}), props: sorted([...(b?.props ?? []), ...pp]), required: sorted([...(b?.required ?? []), ...pp]) } as Shape;
  }
  const ps = (o.parameters ?? []).map(deref).filter((p: Json) => p.in === "path" || p.in === "query");
  return { props: sorted(ps.map((p: Json) => p.name)), required: sorted(ps.filter((p: Json) => p.required).map((p: Json) => p.name)) };
}
// OpenAPI 200 result: the per-capability `result` beside the shared Envelope (allOf), or a fully spelled envelope's result.
// The shared Envelope's generic result ({suppressed}, additionalProperties: true) is not a per-capability declaration.
function oasResult(route: { method: string; path: string }): Shape | null {
  const o = op(route);
  if (!o) return null; // the per-route existence test names the missing route
  const raw = o.responses?.["200"]?.content?.["application/json"]?.schema;
  if (!raw || raw.$ref === ENVELOPE) return null;
  const parts = Array.isArray(raw.allOf) ? raw.allOf.filter((p: Json) => p.$ref !== ENVELOPE).map(deref) : [deref(raw)];
  const holder = parts.find((p: Json) => p?.properties?.result);
  return holder ? shape(holder.properties.result) : null;
}
// Compare on what both declare: names and required always; additionalProperties only when both sides state it.
function diff(a: Shape, b: Shape, at = ""): string[] {
  if ("oneOf" in a || "oneOf" in b) {
    if (!("oneOf" in a) || !("oneOf" in b)) return [`${at}oneOf on one side only`];
    if (a.oneOf.length !== b.oneOf.length) return [`${at}oneOf ${a.oneOf.length} vs ${b.oneOf.length} branches`];
    return a.oneOf.flatMap((x, k) => diff(x, b.oneOf[k], `${at}oneOf[${k}].`));
  }
  const out: string[] = [];
  if (a.props.join() !== b.props.join()) out.push(`${at}properties capabilities=[${a.props}] openapi=[${b.props}]`);
  if (a.required.join() !== b.required.join()) out.push(`${at}required capabilities=[${a.required}] openapi=[${b.required}]`);
  if ("additionalProperties" in a && "additionalProperties" in b && JSON.stringify(a.additionalProperties) !== JSON.stringify(b.additionalProperties))
    out.push(`${at}additionalProperties capabilities=${JSON.stringify(a.additionalProperties)} openapi=${JSON.stringify(b.additionalProperties)}`);
  for (const k of Object.keys(a.nested ?? {}).sort()) if (b.nested?.[k]) out.push(...diff(a.nested![k], b.nested[k], `${at}${k}.`));
  return out;
}

type Check = { key: string; problems: string[] };
const checks: Check[] = [];
const oneSided: string[] = []; // rows where exactly one file declares a field shape, so nothing is compared
const record = (key: string, a: Shape | null, b: Shape | null) => {
  if (a && b) checks.push({ key, problems: diff(a, b) });
  else if (a || b) oneSided.push(`${key} (${a ? "capabilities" : "openapi"} only)`);
};
for (const c of caps) {
  if (c.params_schema) record(`${c.id} request`, shape(c.params_schema), oasRequest(c, c.http));
  if (c.result_schema) record(`${c.id} result`, shape(c.result_schema), oasResult(c.http));
}

// Rows compared today (both files declare a field shape). A row that stops being compared, for example because one side
// loses its `properties`, fails the exact-set test below by name. Add or remove a key here when the contract changes.
const COMPARED = [
  "cap.participant.open_link request",
  "cap.participant.open_link result",
  "cap.survey.issue_link request",
  "cap.survey.issue_link result",
  "cap.grant.accept request",
  "cap.me.invitations request",
  "cap.response.form request",
  "cap.response.form result",
  "cap.response.submit request",
  "cap.response.submit result",
  "cap.response.receipt request",
  "cap.response.receipt result",
  "cap.report.build request",
  "cap.report.build result",
  "cap.report.get request",
  "cap.report.get result",
  "cap.report.list request",
  "cap.report.list result",
  "cap.ops.feedback request",
  "cap.ops.feedback result",
  "cap.ops.feedback_get request",
  "cap.ops.roadmap_read request",
  "cap.ops.roadmap_publish request",
  "cap.ops.roadmap_summary request",
  "cap.ops.roadmap_verify request",
  "cap.ops.roadmap_redact request",
  "cap.ops.roadmap_history request",
];
// Rows where only one file declares a field shape, so there is nothing to compare. Kept exact for the same reason.
const ONE_SIDED = ["cap.me.invitations result (capabilities only)"];

// Rows where the two files disagree today (S37 findings; the contract is not edited here). Remove a line once fixed upstream.
const KNOWN_DISAGREEMENTS: Record<string, string> = {
  "cap.grant.accept request":
    "capabilities declares params {token, invitation_id} with x-exactly-one-of across http + http_alt and no required; openapi's primary route takes only {token} as a required path param and its DangerBody params are an open object",
};

describe("contract parity: capabilities.json ↔ openapi.yaml (offline)", () => {
  it("parses openapi.yaml with one operation per capability route", () => {
    const methods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
    const ops = Object.values(oas.paths as Record<string, Json>).reduce((n, p) => n + Object.keys(p).filter((k) => methods.has(k)).length, 0);
    expect(ops).toBe(caps.reduce((n, c) => n + routes(c).length, 0));
  });

  describe("every capability route exists in openapi.yaml with the same method", () => {
    for (const c of caps) for (const r of routes(c)) {
      it(`${c.id} ${r.method} ${r.path}`, () => {
        const o = op(r);
        expect(o, `${r.method} ${r.path} missing from openapi.yaml`).toBeTruthy();
        expect(o["x-capability"]).toBe(c.id);
      });
    }
  });

  describe("request/result schemas agree on fields both files declare", () => {
    for (const ch of checks) {
      if (KNOWN_DISAGREEMENTS[ch.key]) it.todo(`${ch.key} — ${KNOWN_DISAGREEMENTS[ch.key]}`);
      else it(ch.key, () => expect(ch.problems).toEqual([]));
    }
    it("the compared set is exactly COMPARED (a row that drops out of comparison fails here by name)", () => {
      const got = sorted(checks.map((ch) => ch.key)), want = sorted(COMPARED);
      const dropped = want.filter((k) => !got.includes(k)), added = got.filter((k) => !want.includes(k));
      expect({ dropped, added }, "add/remove the key in COMPARED (and ONE_SIDED) when the contract changes").toEqual({ dropped: [], added: [] });
    });
    it("the one-sided set is exactly ONE_SIDED", () => {
      expect(sorted(oneSided), "add/remove the key in ONE_SIDED when the contract changes").toEqual(sorted(ONE_SIDED));
    });
    it("the known-disagreement table names exactly the rows that disagree today", () => {
      const live = checks.filter((ch) => ch.problems.length).map((ch) => `${ch.key}: ${ch.problems.join("; ")}`);
      expect(sorted(checks.filter((ch) => ch.problems.length).map((ch) => ch.key)), live.join("\n")).toEqual(sorted(Object.keys(KNOWN_DISAGREEMENTS)));
    });
  });
});

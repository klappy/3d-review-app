// Release identity consistency (ticket 2026-09-17-3d-release-identity): one authority (cookbook release record at an
// immutable commit) → release/release-manifest.json (pinned copy) → package.json/package-lock.json (validated) →
// generated src/version.generated.ts → health / MCP serverInfo / ui/changelog.json. Every hop is asserted equal here.
// The generated file is produced by the pretest hook (scripts/stamp-version.mjs); it is git-ignored, never tracked.
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { APP_VERSION, APP_COMMIT, APP_STAMP, BUILD_UUID, RELEASE_SOURCE } from "../src/version";

const root = new URL("../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root));
const readJson = (p: string) => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
const manifest = readJson("release/release-manifest.json");
const releases = readJson("release/cookbook/releases.json");
const HEX40 = /^[0-9a-f]{40}$/;
const gitBlobId = (bytes: Buffer) => createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest("hex");
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

describe("version authority chain: package == lock == manifest == generated", () => {
  it("package.json, both package-lock.json version fields and the manifest agree with the generated APP_VERSION", () => {
    expect(manifest.version).toBe("0.7.1");
    expect(pkg.version).toBe(manifest.version);
    expect(lock.version).toBe(manifest.version);
    expect(lock.packages[""].version).toBe(manifest.version);
    expect(APP_VERSION).toBe(manifest.version);
  });
  it("APP_COMMIT is a real 40-hex sha; APP_STAMP = version+sha7; RELEASE_SOURCE = manifest cookbook_commit (40-hex)", () => {
    expect(APP_COMMIT).toMatch(HEX40);
    expect(APP_STAMP).toBe(`${APP_VERSION}+${APP_COMMIT.slice(0, 7)}`);
    expect(manifest.cookbook_commit).toMatch(HEX40);
    expect(RELEASE_SOURCE).toBe(manifest.cookbook_commit);
    expect(manifest.cookbook_repo).toBe("klappy/3d-review-cookbook");
    expect(BUILD_UUID === null || typeof BUILD_UUID === "string").toBe(true);
  });
  it("in Workers CI the stamped commit is exactly WORKERS_CI_COMMIT_SHA", () => {
    if (process.env.WORKERS_CI === "1") expect(APP_COMMIT).toBe(process.env.WORKERS_CI_COMMIT_SHA);
    else expect(true).toBe(true);
  });
});

describe("manifest records pin the cookbook byte copies (git blob id + sha256)", () => {
  const expectedPaths = ["planning/2026-09-16-parity-build/releases/0.7.1.md", "planning/2026-09-16-parity-build/releases/releases.json"];
  it("has exactly the two records", () => {
    expect(manifest.records.map((r: any) => r.path)).toEqual(expectedPaths);
  });
  for (const rec of manifest.records as { path: string; blob_sha: string; sha256: string }[]) {
    it(`${rec.path}: blob_sha and sha256 recompute from release/cookbook/<file>`, () => {
      const bytes = read(`release/cookbook/${rec.path.split("/").pop()}`);
      expect(rec.blob_sha).toMatch(HEX40);
      expect(gitBlobId(bytes)).toBe(rec.blob_sha);
      expect(sha256(bytes)).toBe(rec.sha256);
    });
  }
  it("manifest.changelog.sections deep-equal the pinned releases.json 0.7.1 sections; markdown bullets equal the json verbatim", () => {
    const entry = releases.versions.find((v: any) => v.version === "0.7.1");
    expect(entry.status).toBe("candidate");
    expect(entry.tag).toBeUndefined(); expect(entry.date).toBeUndefined();
    expect(manifest.changelog).toEqual({ sections: entry.sections });
    expect(Object.keys(entry.sections)).toEqual(["added", "changed", "fixed", "security"]);
    const md = read("release/cookbook/0.7.1.md").toString("utf8");
    for (const [key, heading] of [["added", "Added"], ["changed", "Changed"], ["fixed", "Fixed"], ["security", "Security"]]) {
      const m = md.match(new RegExp(`### ${heading}\\n([\\s\\S]*?)(?=\\n### |\\n## )`));
      expect(m, `### ${heading} section present`).toBeTruthy();
      const bullets = m![1].trim().split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim());
      expect(bullets).toEqual(entry.sections[key]);
    }
    expect(md).toContain("## [0.7.1] — candidate");
  });
});

describe("generated ui/changelog.json", () => {
  it("deep-equals the derived shape: current, newest-first, 0.7.1 candidate with no tag/date, four section keys, no HTML", () => {
    const gen = readJson("ui/changelog.json");
    const derived = { current: releases.current, versions: [...releases.versions]
      .sort((a: any, b: any) => { const pa = a.version.split(".").map(Number), pb = b.version.split(".").map(Number); for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i]; return 0; })
      .map((v: any) => ({ version: v.version, status: v.status, sections: { added: v.sections.added ?? [], changed: v.sections.changed ?? [], fixed: v.sections.fixed ?? [], security: v.sections.security ?? [] }, ...(v.date ? { date: v.date } : {}), ...(v.tag ? { tag: v.tag } : {}) })) };
    expect(gen).toEqual(derived);
    expect(gen.current).toBe(APP_VERSION);
    expect(gen.versions[0].version).toBe("0.7.1");
    expect(gen.versions[0].status).toBe("candidate");
    expect(gen.versions[0]).not.toHaveProperty("tag"); expect(gen.versions[0]).not.toHaveProperty("date");
    for (const v of gen.versions) for (const k of Object.keys(v.sections)) for (const line of v.sections[k]) expect(line).not.toMatch(/<\/?(script|a|img|div|span|p|b|i)[\s>/]/i);
  });
});

describe("runtime surfaces: health and MCP serverInfo", () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "vs", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "vs-test-db" } }] }));
  afterAll(() => mf.dispose());
  const limiter = () => ({ limit: async () => ({ success: true }) });
  let env: any;
  beforeAll(async () => {
    const db = await mf.getD1Database("DB");
    const sql = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
    env = { DB: db, SESSION_SECRET: "synthetic-test-secret", ENVIRONMENT: "dev", RL_MCP_ANON: limiter(), RL_HTTP_ANON: limiter(), RL_AUTH: limiter(), RL_REDEEM: limiter(), RL_MCP_CEILING: limiter() };
  }, 60_000);
  const req = (method: string, path: string, body?: unknown) => app.fetch(new Request("https://t.invalid" + path, { method, headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.77" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);

  it("GET /v2/health carries version/build/commit/release_source and keeps contract/source_sha/deps/capabilities(84)/ok", async () => {
    const r = await req("GET", "/v2/health");
    expect(r.status).toBe(200);
    const body: any = await r.json();
    const h = body.result;
    expect(h.ok).toBe(true);
    expect(h.version).toBe(APP_VERSION);
    expect(h.build).toBe(APP_STAMP);
    expect(h.build).toBe(`0.7.1+${APP_COMMIT.slice(0, 7)}`);
    expect(h.commit).toBe(APP_COMMIT);
    expect(h.release_source).toBe(manifest.cookbook_commit);
    if (BUILD_UUID === null) expect(h).not.toHaveProperty("build_uuid"); else expect(h.build_uuid).toBe(BUILD_UUID);
    expect(h.source_sha).not.toBe(h.release_source);
    const contract = readJson("contract/capabilities.json");
    expect(h.contract).toEqual(contract.contract);
    expect(h.source_sha).toBe(contract.source.sha);
    expect(h.deps).toEqual({ d1: "ok" });
    expect(h.capabilities).toBe(84);
  });
  it("MCP initialize → serverInfo.version === APP_VERSION", async () => {
    const r = await req("POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(r.status).toBe(200);
    const body: any = await r.json();
    expect(body.result.serverInfo).toEqual({ name: "3d-review", version: APP_VERSION });
    expect(body.result.serverInfo.version).toBe("0.7.1");
  });
});

describe("stamp script (subprocess): CI without WORKERS_CI_COMMIT_SHA fails, never fabricates", () => {
  // Every run writes to a temp dir via STAMP_OUT_DIR — the real src/version.generated.ts and ui/changelog.json produced by
  // the pretest hook are never rewritten mid-run (review 5710626841 finding 2).
  const script = new URL("scripts/stamp-version.mjs", root).pathname;
  const cwd = root.pathname;
  const out = mkdtempSync(join(tmpdir(), "stamp-out-"));
  afterAll(() => rmSync(out, { recursive: true, force: true }));
  const clean = { ...process.env } as Record<string, string | undefined>;
  delete clean.CI; delete clean.WORKERS_CI; delete clean.WORKERS_CI_COMMIT_SHA; delete clean.WORKERS_CI_BUILD_UUID; delete clean.STAMP_OUT_DIR;
  const realGen = readFileSync(new URL("src/version.generated.ts", root), "utf8");
  const realChangelog = readFileSync(new URL("ui/changelog.json", root), "utf8");
  const run = (env: Record<string, string>) => spawnSync(process.execPath, [script], { cwd, env: { ...clean, STAMP_OUT_DIR: out, ...env } as any, encoding: "utf8" });
  it("CI=true with no WORKERS_CI_COMMIT_SHA → exit 1 with a clear message; WORKERS_CI=1 likewise", () => {
    const r1 = run({ CI: "true" });
    expect(r1.status).toBe(1); expect(r1.stderr).toMatch(/WORKERS_CI_COMMIT_SHA/);
    const r2 = run({ WORKERS_CI: "1", WORKERS_CI_COMMIT_SHA: "" });
    expect(r2.status).toBe(1); expect(r2.stderr).toMatch(/WORKERS_CI_COMMIT_SHA/);
    const r3 = run({ WORKERS_CI: "1", WORKERS_CI_COMMIT_SHA: "not-a-sha" });
    expect(r3.status).toBe(1);
    expect(existsSync(join(out, "src/version.generated.ts"))).toBe(false);
  });
  it("CI=true with a 40-hex WORKERS_CI_COMMIT_SHA → exit 0 and the generated file (in the temp dir) carries that sha and build uuid", () => {
    const sha = "a".repeat(40);
    const r = run({ CI: "true", WORKERS_CI_COMMIT_SHA: sha, WORKERS_CI_BUILD_UUID: "11111111-2222-3333-4444-555555555555" });
    expect(r.status, r.stderr).toBe(0);
    const gen = readFileSync(join(out, "src/version.generated.ts"), "utf8");
    expect(gen).toContain(`export const APP_COMMIT = "${sha}";`);
    expect(gen).toContain(`export const APP_STAMP = "0.7.1+aaaaaaa";`);
    expect(gen).toContain(`export const BUILD_UUID: string | null = "11111111-2222-3333-4444-555555555555";`);
    expect(r.stdout).toContain("0.7.1+aaaaaaa");
    expect(readFileSync(join(out, "ui/changelog.json"), "utf8")).toBe(realChangelog);
  });
  it("--out <dir> works like STAMP_OUT_DIR; local run is idempotent and fast (second run unchanged, under 1s)", () => {
    const out2 = mkdtempSync(join(tmpdir(), "stamp-out2-"));
    try {
      const first = spawnSync(process.execPath, [script, "--out", out2], { cwd, env: clean as any, encoding: "utf8" });
      expect(first.status).toBe(0); expect(existsSync(join(out2, "ui/changelog.json"))).toBe(true);
      const t0 = Date.now(); const r = spawnSync(process.execPath, [script, "--out", out2], { cwd, env: clean as any, encoding: "utf8" }); const dt = Date.now() - t0;
      expect(r.status).toBe(0); expect(r.stdout).toContain("unchanged"); expect(dt).toBeLessThan(1000);
    } finally { rmSync(out2, { recursive: true, force: true }); }
  });
  it("the real generated files are byte-identical after the subprocess runs", () => {
    expect(readFileSync(new URL("src/version.generated.ts", root), "utf8")).toBe(realGen);
    expect(readFileSync(new URL("ui/changelog.json", root), "utf8")).toBe(realChangelog);
  });
  it("git ignores both generated files", () => {
    const r = spawnSync("git", ["check-ignore", "src/version.generated.ts", "ui/changelog.json"], { cwd, encoding: "utf8" });
    expect(r.status).toBe(0); expect(r.stdout.trim().split("\n").sort()).toEqual(["src/version.generated.ts", "ui/changelog.json"]);
  });
});

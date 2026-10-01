// Audit E7 (train 22): src/crypto.ts replaced nine copied sha256/HMAC helpers. These vectors were computed from the
// old copies before they were removed (src/receipt.ts, src/translate.ts, src/handlers/common.ts, src/handlers/types.ts,
// src/ptxprint.ts, src/report-canonical-json.ts, and the private HMACs in src/oauth.ts and src/passages.ts), so the
// shared module and every re-exported name must keep producing exactly these strings.
import { describe, expect, it } from "vitest";
import { hmacSha256Base64Url, hmacSha256Key, sha256Hex, sha256HexBytes } from "../src/crypto";
import { mintTicket, readTicket } from "../src/oauth";
import { signedHref } from "../src/passages";
import { sha256Hex as receiptSha, sign, verify } from "../src/receipt";
import { sha256Hex as translateSha } from "../src/translate";
import { sha256 as commonSha } from "../src/handlers/common";
import { sha256 as typesSha } from "../src/handlers/types";
import { sha256Hex as ptxSha } from "../src/ptxprint";
import { sha256Bytes } from "../src/report-canonical-json";

const TEXT: Record<string, string> = {
  abc: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  "": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "Ŋ ລາວ ✓": "c59085afc5f4227043637aca8135baa25e5ff7c52434de60a7b5d87a5c771ac3",
};
const BYTES = new Uint8Array([0, 1, 2, 250, 255, 128]);
const BYTES_HEX = "4b673f16e500cedb8bf74dc862ab6c430817ecd0a0e0eec051fa1bb9d6476827";
const SECRET = "s3cret-é";

describe("src/crypto.ts — byte-identical to the copies it replaced", () => {
  it("sha256 of a string: lowercase hex, UTF-8, every re-exported name", async () => {
    for (const [text, want] of Object.entries(TEXT)) {
      for (const f of [sha256Hex, receiptSha, translateSha, commonSha, typesSha]) expect(await f(text)).toBe(want);
    }
  });
  it("sha256 of bytes: lowercase hex, every re-exported name", async () => {
    for (const f of [sha256HexBytes, ptxSha, sha256Bytes]) {
      expect(await f(BYTES)).toBe(BYTES_HEX);
      expect(await f(new Uint8Array())).toBe(TEXT[""]);
    }
  });
  it("HMAC-SHA256: unpadded base64url, same key import", async () => {
    expect(await hmacSha256Base64Url(SECRET, "payload.x")).toBe("umI0j7B0D6fzH_9Xgdh77Ys6XT0vycnnnmiIFYfYPAI");
    expect(await hmacSha256Base64Url("k", "a")).toBe("eNqRUR5nVYf1ud94vt669VYNoqu4gWLuh13N90SVHZ4");
    expect(await sign(SECRET, "payload.x")).toBe("umI0j7B0D6fzH_9Xgdh77Ys6XT0vycnnnmiIFYfYPAI");
    expect(await verify(SECRET, "payload.x", "umI0j7B0D6fzH_9Xgdh77Ys6XT0vycnnnmiIFYfYPAI")).toBe(true);
    expect(await verify(SECRET, "payload.y", "umI0j7B0D6fzH_9Xgdh77Ys6XT0vycnnnmiIFYfYPAI")).toBe(false);
    const key = await hmacSha256Key(SECRET);
    expect([key.algorithm.name, (key.algorithm as HmacKeyAlgorithm).hash.name, key.extractable, key.usages]).toEqual(["HMAC", "SHA-256", false, ["sign"]]);
  });
  it("callers' signed strings are unchanged (oauth consent ticket, passage link)", async () => {
    const env = { SESSION_SECRET: SECRET } as never;
    const ticket = await mintTicket(env, "park1", "prin1", 1000);
    expect(ticket).toBe("park1.prin1.601000.-5ybZj-qDkoYIrMZuDcEwYSVop_uWLGy4IuJsttHnEw");
    expect(await readTicket(env, ticket, 1000)).toEqual({ parkId: "park1", principalId: "prin1" });
    expect(await signedHref(env, "pas_1", 3600, 2000000)).toBe("/v2/passages/pas_1/file?exp=5600&sig=nV_bSuMYtTh6zL3ybWVRKh-FQ92o2d0Ej5je3XKxIrA");
  });
});

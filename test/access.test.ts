import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyAccessJwt, resetAccessKeyCache } from "../src/access";

const b64u = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function signed(payload: Record<string, unknown>, kid = "k1") {
  const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const head = b64u(JSON.stringify({ alg: "RS256", kid }));
  const body = b64u(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kp.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return { jwt: `${head}.${body}.${b64u(sig)}`, jwks: { keys: [{ kid, kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256" }] } };
}
const env: any = { ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud-1" };
afterEach(() => { vi.restoreAllMocks(); resetAccessKeyCache(); });

describe("Cloudflare Access assertion verification (OF-7 email-code sign-in)", () => {
  it("accepts a valid assertion for this app and yields the email", async () => {
    const { jwt, jwks } = await signed({ iss: "https://team.cloudflareaccess.com", aud: ["aud-1"], exp: Math.floor(Date.now() / 1000) + 60, email: "Owner@Example.invalid", sub: "s1" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(jwks)));
    const id = await verifyAccessJwt(env, jwt);
    expect(id.email).toBe("owner@example.invalid");
  });
  it("refuses another app's audience, a bad signature, an expired token, and a missing token", async () => {
    const good = await signed({ iss: "https://team.cloudflareaccess.com", aud: ["aud-2"], exp: Math.floor(Date.now() / 1000) + 60, email: "x@example.invalid" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(good.jwks)));
    await expect(verifyAccessJwt(env, good.jwt)).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
    const tampered = good.jwt.slice(0, -4) + "AAAA";
    await expect(verifyAccessJwt(env, tampered)).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
    await expect(verifyAccessJwt(env, undefined)).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
    await expect(verifyAccessJwt({ ...env, ACCESS_AUD: undefined }, good.jwt)).rejects.toMatchObject({ code: "RESERVED_NOT_BUILT" });
  });
  it("refuses an expired assertion", async () => {
    const { jwt, jwks } = await signed({ iss: "https://team.cloudflareaccess.com", aud: ["aud-1"], exp: Math.floor(Date.now() / 1000) - 5, email: "x@example.invalid" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(jwks)));
    await expect(verifyAccessJwt(env, jwt)).rejects.toMatchObject({ code: "NOT_AUTHENTICATED", message: "assertion expired" });
  });
});

import app from '../src/index';
import { sha256 } from '../src/handlers/types';

async function accountFixture(over: Record<string, unknown> = {}) {
  const email = 'synthetic@example.invalid';
  const { jwt, jwks } = await signed({ iss: 'https://team.cloudflareaccess.com', aud: ['aud-1'], exp: Math.floor(Date.now()/1000)+60, email, ...over });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(jwks)));
  const token = 'st_' + 'a'.repeat(32), other = 'st_' + 'b'.repeat(32);
  const row: any = { principal_id: 'synthetic-person', kind: 'user', delegated_by: null, expires_at: Date.now()+60000, email_hash: await sha256(email), provisioned: 1, support: 0 };
  const lookups: string[] = []; let writes = 0, selected: any = row;
  const tokenHash = await sha256(token);
  const db: any = { prepare: (sql: string) => ({ bind: (value: string) => ({
    first: async () => { lookups.push(value); if(value !== tokenHash) return null; return sql.includes('LEFT JOIN') ? row : selected; },
    run: async () => { writes++; throw Error('account read attempted write'); }
  }) }) };
  return { row, token, other, lookups, setSelected: (value: any) => selected=value, writes: () => writes,
    request: (query='?view=account', headers: Record<string,string> = { cookie: `session=${token}` }) => app.fetch(new Request('https://app.invalid/v2/auth/access'+query, {headers:{'cf-access-jwt-assertion':jwt,...headers}}), {...env,DB:db,SESSION_SECRET:'synthetic'}) };
}

describe('account display read binds verified provider email to the selected existing session', () => {
  it('returns only email with no-store, no cookie, no redirect and zero writes', async () => {
    const f=await accountFixture(); const r=await f.request();
    expect(r.status).toBe(200); expect(await r.json()).toEqual({email:'synthetic@example.invalid'});
    expect(r.headers.get('cache-control')).toBe('private, no-store'); expect(r.headers.has('set-cookie')).toBe(false); expect(r.headers.has('location')).toBe(false); expect(f.writes()).toBe(0);
  });
  it.each(['user','support'])('permits undelegated %s selected session', async kind => {
    const f=await accountFixture(); f.row.kind=kind; expect((await f.request()).status).toBe(200);
  });
  it.each([['user','cookie'],['user','bearer'],['support','cookie'],['support','bearer']])('refuses delegated %s via %s',async(kind,transport)=>{
    const f=await accountFixture(); f.row.kind=kind; f.row.delegated_by='synthetic-delegator';
    const r=await f.request('?view=account',transport==='cookie'?{cookie:`session=${f.token}`}:{authorization:`Bearer ${f.token}`});
    expect(r.status).toBe(401); expect(await r.json()).toEqual({error:'Account identity unavailable'}); expect(f.writes()).toBe(0);
  });
  it.each(['participant','expired','mismatch','missing','replaced'])('refuses %s without disclosing email',async mode=>{
    const f=await accountFixture();
    if(mode==='participant')f.row.kind='participant'; if(mode==='expired')f.row.expires_at=Date.now()-1;
    if(mode==='mismatch')f.row.email_hash='different'; if(mode==='missing')f.setSelected(null);
    if(mode==='replaced')f.setSelected({...f.row,principal_id:'another-person'});
    const r=await f.request(); expect(r.status).toBe(401); expect(await r.json()).toEqual({error:'Account identity unavailable'}); expect(f.writes()).toBe(0);
  });
  it('never falls back from invalid selected bearer to valid cookie',async()=>{
    const f=await accountFixture(); const r=await f.request('?view=account',{authorization:`Bearer ${f.other}`,cookie:`session=${f.token}`});
    expect(r.status).toBe(401); expect(f.lookups).not.toContain(await sha256(f.token));
  });
  it.each(['?view=other','?view=account&view=account','?view='])('fails closed before all side effects for %s',async query=>{
    const f=await accountFixture(); const r=await f.request(query); expect(r.status).toBe(400); expect(f.lookups).toEqual([]); expect(f.writes()).toBe(0); expect(r.headers.has('set-cookie')).toBe(false);
  });
  it.each([{aud:['wrong']},{exp:1},{email:42},{email:''},{email:'a'.repeat(255)}])('rejects invalid claims %j',async claims=>{
    const f=await accountFixture(claims); const r=await f.request(); expect(r.status).toBe(401); expect(await r.json()).toEqual({error:'Account identity unavailable'}); expect(f.writes()).toBe(0);
  });
  it('requires provider assertion and current app credential',async()=>{
    const f=await accountFixture(); expect((await f.request('?view=account',{})).status).toBe(401);
    expect((await f.request('?view=account',{'cf-access-jwt-assertion':'',cookie:`session=${f.token}`})).status).toBe(401);
  });
});

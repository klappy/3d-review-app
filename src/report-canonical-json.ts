/** Bounded RFC 8785 JSON for attestation. This is deliberately stricter than JSON. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export const JSON_LIMITS = Object.freeze({ depth: 16, stringBytes: 4096, members: 1024 });
const utf8 = new TextEncoder();
export class CanonicalJsonError extends Error {
  constructor() { super('INVALID_JSON'); this.name = 'CanonicalJsonError'; }
}
function fail(): never { throw new CanonicalJsonError(); }
function validString(s: string): void {
  if (utf8.encode(s).length > JSON_LIMITS.stringBytes) fail();
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail();
    } else if (c >= 0xdc00 && c <= 0xdfff) fail();
  }
}
function validNumber(n: number): void {
  if (!Number.isFinite(n) || (Number.isInteger(n) && !Number.isSafeInteger(n))) fail();
}
/** Raw production ingress. Duplicate decoded names are rejected before they can be lost. */
export function parseBoundedJson(raw: string, maxBytes: number): Json {
  if (typeof raw !== 'string' || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || raw.length > maxBytes || utf8.encode(raw).length > maxBytes) fail();
  let p = 0;
  function space(): void { while (p < raw.length && /[\x20\t\n\r]/.test(raw[p])) p++; }
  function string(): string {
    if (raw[p++] !== '"') fail();
    const units: string[] = [];
    let bytes = 0, high = false;
    function unit(code: number): void {
      if (high) {
        if (code < 0xdc00 || code > 0xdfff) fail();
        high = false; bytes += 4;
      } else if (code >= 0xd800 && code <= 0xdbff) high = true;
      else if (code >= 0xdc00 && code <= 0xdfff) fail();
      else bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
      if (bytes > JSON_LIMITS.stringBytes) fail();
      units.push(String.fromCharCode(code));
    }
    while (p < raw.length) {
      const c = raw.charCodeAt(p++);
      if (c === 34) { if (high) fail(); return units.join(''); }
      if (c < 32) fail();
      if (c === 92) {
        const e = raw[p++];
        if (e === 'u') {
          const digits = raw.slice(p, p + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(digits)) fail();
          p += 4; unit(parseInt(digits, 16));
        } else {
          const escaped: Record<string, number> = { '"': 34, '\\': 92, '/': 47, b: 8, f: 12, n: 10, r: 13, t: 9 };
          if (!e || !Object.hasOwn(escaped, e)) fail();
          unit(escaped[e]);
        }
      } else unit(c);
    }
    return fail();
  }
  function value(depth: number): Json {
    if (depth > JSON_LIMITS.depth) fail();
    space(); const c = raw[p];
    if (c === '"') return string();
    if (c === '{' || c === '[') {
      p++; space(); const object = c === '{'; const end = object ? '}' : ']';
      const result: Record<string, Json> = Object.create(null); const list: Json[] = [];
      const keys = new Set<string>(); let count = 0;
      if (raw[p] === end) { p++; return object ? result : list; }
      while (true) {
        if (++count > JSON_LIMITS.members) fail();
        space();
        if (object) {
          const key = string(); if (keys.has(key)) fail(); keys.add(key);
          space(); if (raw[p++] !== ':') fail(); result[key] = value(depth + 1);
        } else list.push(value(depth + 1));
        space(); if (raw[p] === end) { p++; return object ? result : list; }
        if (raw[p++] !== ',') fail();
      }
    }
    for (const [token, v] of [['true', true], ['false', false], ['null', null]] as const) {
      if (raw.startsWith(token, p)) { p += token.length; return v; }
    }
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(raw.slice(p));
    if (!match) return fail();
    p += match[0].length; const n = Number(match[0]); validNumber(n); return n;
  }
  const result = value(0); space(); if (p !== raw.length) fail(); return result;
}
/** Internal data only; arbitrary proxies are outside this API's trust boundary. */
export function canonicalJson(input: unknown, maxBytes = 524288): string {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) fail();
  let remaining = maxBytes;
  function debit(s: string): string { remaining -= utf8.encode(s).length; if (remaining < 0) fail(); return s; }
  const ancestors = new Set<object>();
  function visit(v: unknown, depth: number): string {
    if (depth > JSON_LIMITS.depth) fail();
    if (v === null) return debit('null');
    if (typeof v === 'string') { validString(v); return debit(JSON.stringify(v)); }
    if (typeof v === 'boolean') return debit(v ? 'true' : 'false');
    if (typeof v === 'number') { validNumber(v); return debit(JSON.stringify(v)); }
    if (typeof v !== 'object') return fail();
    if (ancestors.has(v)) fail();
    const proto = Object.getPrototypeOf(v);
    const array = Array.isArray(v);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) fail();
    // Even inherited enumerable pollution or a non-enumerable hook is refused.
    for (const key in v) if (!Object.hasOwn(v, key)) fail();
    if ('toJSON' in v) fail();
    const descriptors = Object.getOwnPropertyDescriptors(v);
    if (Object.getOwnPropertySymbols(v).length) fail();
    const keys = Object.keys(descriptors);
    for (const key of keys) {
      const d = descriptors[key];
      if (!('value' in d) || (!d.enumerable && !(array && key === 'length'))) fail();
      validString(key);
    }
    ancestors.add(v);
    let result: string;
    if (array) {
      const length = descriptors.length.value as number;
      if (length > JSON_LIMITS.members || keys.length !== length + 1) fail();
      debit('[' + ']' + ','.repeat(Math.max(0, length - 1)));
      const parts: string[] = [];
      for (let i = 0; i < length; i++) {
        const d = descriptors[String(i)]; if (!d) fail(); parts.push(visit(d.value, depth + 1));
      }
      result = '[' + parts.join(',') + ']';
    } else {
      if (keys.length > JSON_LIMITS.members) fail();
      debit('{' + '}' + ','.repeat(Math.max(0, keys.length - 1)));
      result = '{' + keys.sort().map(k => debit(JSON.stringify(k) + ':') + visit(descriptors[k].value, depth + 1)).join(',') + '}';
    }
    ancestors.delete(v); return result;
  }
  const result = visit(input, 0);
  if (result.length > maxBytes || utf8.encode(result).length > maxBytes) fail();
  return result;
}
export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export async function domainHash(domain: string, value: unknown): Promise<string> {
  if (!/^3d-(answer|template|response|index|capture)-v1$/.test(domain)) fail();
  return sha256Bytes(utf8.encode(domain + '\0' + canonicalJson(value)));
}

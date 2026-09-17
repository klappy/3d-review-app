import { describe, it, expect } from 'vitest';
import fixtures from './fixtures/report-canonical-v1.json';
import { canonicalJson, parseBoundedJson, domainHash, sha256Bytes } from '../src/report-canonical-json';
const parse = (s: string, cap = 524288) => parseBoundedJson(s, cap);
describe('independent canonical bytes and digest vectors', () => {
  for (const [i, v] of fixtures.canonical.entries()) it(`canonical vector ${i}`, async () => {
    const actual = canonicalJson(parse(v.raw));
    expect(actual).toBe(v.canonical);
    expect(await sha256Bytes(new TextEncoder().encode(actual))).toBe(v.sha256);
  });
  for (const [i, v] of fixtures.domains.entries()) it(`full domain preimage ${i}`, async () => {
    const value = parse(v.canonical);
    expect(canonicalJson(value)).toBe(v.canonical);
    expect(await domainHash(v.domain, value)).toBe(v.digest);
  });
  it('retains array order, missing/null/empty and Unicode distinctions', () => {
    for (const values of [[{}, { x: null }, { x: '' }], [['a','b'], ['b','a']], ['é', 'e\u0301']]) expect(new Set(values.map(v => canonicalJson(v))).size).toBe(values.length);
  });
  it('template array reordering changes identity', async () => {
    const t = JSON.parse(fixtures.domains[1].canonical); t.items.push({ id: 'q2' });
    const first = await domainHash('3d-template-v1', t); t.items.reverse();
    expect(await domainHash('3d-template-v1', t)).not.toBe(first);
  });
  it('capture expansion, duplicate IDs and root self-inclusion have distinct fixed digests', () => {
    expect(fixtures.domains[4].digest).not.toBe(fixtures.domains[5].digest);
    expect(fixtures.domains[4].digest).not.toBe(fixtures.domains[7].digest);
    expect(fixtures.domains[3].digest).not.toBe(fixtures.domains[6].digest);
    expect(fixtures.domains[8].digest).not.toBe(fixtures.domains[9].digest);
  });
});
describe('raw lexical and resource refusals', () => {
  const bad = [...fixtures.reject, '', ' ', '01', '+1', '.2', '1.', 'NaN', 'Infinity', 'true false', '[1,]', '{"a":1,}', '{a:1}', '"\\x61"', '"\u0000"', '"\\udc00"', '{"\\ud800":1}', '{"outer":[{"a":1,"\\u0061":2}]}'];
  for (const [i, raw] of bad.entries()) it(`rejects malformed raw ${i}`, () => expect(() => parse(raw)).toThrow('INVALID_JSON'));
  it('allows escaped keys once and safely keeps prototype-named fields', () => {
    expect(canonicalJson(parse('{"\\u0061":1,"__proto__":{"x":2}}'))).toBe('{"__proto__":{"x":2},"a":1}');
    expect(({} as any).x).toBeUndefined();
  });
  it('enforces bytes, decoded strings, depth and collections at their exact boundary', () => {
    expect(parse('"é"', 4)).toBe('é'); expect(() => parse('"é"', 3)).toThrow();
    expect(parse(JSON.stringify('x'.repeat(4096)))).toHaveLength(4096);
    expect(() => parse(JSON.stringify('x'.repeat(4097)))).toThrow();
    expect(() => parse(JSON.stringify('é'.repeat(2049)))).toThrow();
    expect(parse(JSON.stringify('😀'.repeat(1024)))).toBe('😀'.repeat(1024));
    expect(() => parse(JSON.stringify('😀'.repeat(1025)))).toThrow();
    expect(() => parse('"' + '\\u0061'.repeat(4097) + '"')).toThrow();
    expect(() => parse('{"' + 'x'.repeat(4097) + '":0}')).toThrow();
    expect(() => parse('['.repeat(16) + '0' + ']'.repeat(16))).not.toThrow();
    expect(() => parse('['.repeat(17) + '0' + ']'.repeat(17))).toThrow();
    expect(parse(JSON.stringify(Array(1024).fill(0)))).toHaveLength(1024);
    expect(() => parse(JSON.stringify(Array(1025).fill(0)))).toThrow();
    expect(() => parse(JSON.stringify(Object.fromEntries(Array.from({length:1025},(_,i)=>[String(i),0]))))).toThrow();
  });
});
describe('internal typed ingress without getter invocation', () => {
  it('rejects unsupported types, objects, cycles, holes and properties', () => {
    const cycle: any = {}; cycle.self = cycle;
    const extra: any = []; extra.extra = 1;
    const symbol = { [Symbol('x')]: 1 };
    const hidden = Object.defineProperty({}, 'x', { value: 1 });
    for (const v of [undefined, NaN, Infinity, 9007199254740992, 1n, Symbol('x'), () => 1, new Date(), new Map(), Object.create({x:1}), cycle, Array(2), extra, symbol, hidden, '\ud800', {'\udc00':1}]) expect(() => canonicalJson(v)).toThrow();
    expect(canonicalJson(Object.assign(Object.create(null), {b:2,a:1}))).toBe('{"a":1,"b":2}');
  });
  it('never calls accessor or toJSON hooks', () => {
    let called = 0;
    const getter = Object.defineProperty({}, 'x', { enumerable: true, get() { called++; return 1; } });
    const hook = { toJSON() { called++; return {}; } };
    const inherited = Object.create({ get x() { called++; return 1; } });
    for (const v of [getter, hook, inherited]) expect(() => canonicalJson(v)).toThrow();
    expect(called).toBe(0);
  });
  it('refuses typed byte excess during traversal', () => {
    expect(canonicalJson({a:1}, 7)).toBe('{"a":1}');
    expect(() => canonicalJson({a:1}, 6)).toThrow();
    expect(() => canonicalJson(Array.from({length:1024},()=> 'x'.repeat(4096)), 8192)).toThrow();
  });
  it('rejects unrecognized domains', async () => expect(domainHash('other', {})).rejects.toThrow());
});

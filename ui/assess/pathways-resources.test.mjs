import test from 'node:test';
import assert from 'node:assert/strict';
import { IMPROVE_RESOURCES as table, resourcesFor, resourcesMarkup } from './improve-resources.js';
const rows = [
 ['Translation Team','Translation Brief',1],['Translation Team','Understanding the Source',13],
 ['Translation Team','The Translation Process',4],['Translation Team','External Review',1],
 ['Translation Team','Consistency',1],['Translation Team','Governance/Management',4],
 ['Community','Understandable',2],['Community','Appealing',8],['Community','Impact',1],
 ['Church','Translation Brief',1],['Church','Church Involvement',2],
 ['Church','Confidence in the Translation',1],['Church','Affirmation',1],
];
test('13 source category rows retain40 links and38 distinct destinations, excluding the one proven mismatch',()=>{
 const links=rows.flatMap(([p,c,n])=>{const rs=resourcesFor(`${p} · ${c}`);assert.equal(rs.length,n);return rs;});
 assert.equal(links.length,40);assert.equal(new Set(links.map(r=>r.url)).size,38);
 assert.ok(!JSON.stringify(table).includes('https://oyc.yale.edu/NODE/246'));
 assert.equal(resourcesFor('Church · Translation Brief')[0].url,'https://app.heygen.com/videos/what-is-a-translation-brief-why-do-we-need-one-8000e24db94447029feadf62710a1ae8');
});
test('three explicit source-backed aliases preserve qualified categories without fuzzy or cross-perspective advice',()=>{
 assert.deepEqual(resourcesFor('Translation team · Governance'),resourcesFor('Translation Team · Governance/Management'));
 assert.deepEqual(resourcesFor('Community · Impactful'),resourcesFor('Community · Impact'));
 assert.deepEqual(resourcesFor('Translation team · Translation process & brief'),[...resourcesFor('Translation Team · Translation Brief'),...resourcesFor('Translation Team · The Translation Process')]);
 for(const area of ['Church · Impactful','Community · Consistency','Translation Team · Readiness','Community · Appealing written','Community · Appealing — Written','Church · Impact observation'])assert.deepEqual(resourcesFor(area),[]);
});
test('native query ampersands and original HTTP URL are preserved, markup escapes safely',()=>{
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 for(const [key,rs]of Object.entries(table)){
  const html=resourcesMarkup(key,esc);assert.equal((html.match(/<a /g)||[]).length,rs.length);
  for(const r of rs){assert.ok(['http:','https:'].includes(new URL(r.url).protocol));assert.ok(!r.url.includes('&amp;'));assert.ok(html.includes(`href="${esc(r.url)}"`));}
  assert.equal((html.match(/rel="noopener noreferrer"/g)||[]).length,rs.length);
 }
 assert.equal(resourcesFor('Community · Impactful')[0].url,'http://scriptureengagement.org');
});

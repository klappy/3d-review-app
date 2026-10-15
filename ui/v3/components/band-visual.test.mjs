import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bandImagery} from './band-visual.js';
import {v3ScoreBand} from '../../assess/v3-assessment.js';
test('visual adapter accepts only established words, never numeric score or untrusted HTML',()=>{
 for(const value of [70,0,null,undefined,'<img onerror=x>'])assert.equal(bandImagery(value),'');
 for(const score of [75,74.9,60,59.9,40,39.9]){const word=v3ScoreBand(score,3);const s=bandImagery(word);for(const style of ['signal','faces','container','plant'])assert.ok(s.includes(`data-band-image="${style}"`));assert.ok(s.includes(`aria-label="${word}"`));}
});
test('held/high-score and missing differ from valid zero; each metaphor has its own missing imagery',()=>{
 const missing=bandImagery(v3ScoreBand(90,2));
 for(const style of ['faces','container','plant'])assert.ok(missing.includes(`data-missing-shape="${style}"`));
 assert.ok(missing.includes('proposal-missing-visuals'));assert.ok(missing.includes('>?</text>'));
 assert.ok(!bandImagery(v3ScoreBand(0,3)).includes('data-missing-shape'));
});
test('jar clip references are unique and resolved across repeated cards',()=>{
 const s=bandImagery('Needs support')+bandImagery('Needs support');const ids=[...s.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);for(const m of s.matchAll(/url\(#([^)]+)\)/g))assert.ok(ids.includes(m[1]));
});

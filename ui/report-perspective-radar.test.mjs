import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {subdimensionRadarModels,perspectiveRadarModels,renderPerspectiveRadars} from './report-perspective-radar.js';
const card={lens:'Community',n:1,rows:[{name:'Appealing',score:75},{name:'Impactful',score:52.5},{name:'Trust',score:0},{name:'Understandable',score:47}]};
test('one response uses exact own subdimensions including genuine zero; no rescoring or cross-lens substitution',()=>{
 const before=JSON.stringify(card),[m]=subdimensionRadarModels([card],1);
 assert.deepEqual(m.spokes,card.rows.map(r=>r.name));assert.deepEqual(m.lenses[0].scores,[75,52.5,0,47]);assert.equal(m.n,1);assert.equal(JSON.stringify(card),before);
 assert.deepEqual(subdimensionRadarModels([card],3),[]);
 for(const n of [0,null,undefined,'1',NaN])assert.deepEqual(subdimensionRadarModels([{...card,n}],1),[]);
 assert.deepEqual(subdimensionRadarModels([{...card,n:10,snapshotN:null}],1),[],'live counts cannot stand in for unknown snapshot count');
});
const report=(rows=card.rows)=>({payload:{lenses:[{lens:card.lens,sub_dimensions:rows.map(r=>({sub_dimension:r.name,score:r.score}))}],evidence:[{label:'Community — Written',n:1}],cross_lens_multi:[]}});
test('full radar closes genuine own axes, names measure and limited data; missing score breaks outline without zero-fill',()=>{
 const doc=new JSDOM('<html>').window.document;
 const [section]=renderPerspectiveRadars({doc,report:report(),minimum:1});
 assert.match(section.textContent,/Community subdimensions/);assert.match(section.textContent,/1 response/);assert.match(section.textContent,/Limited data/);
 assert.match(section.textContent,/different areas from the shared-construct comparison/);
 const shape=section.querySelector('svg.radar-wide [data-radar-lens]');assert.equal(shape.querySelectorAll('polygon').length,1);assert.equal(shape.querySelectorAll('circle').length,4);
 const gap=report([...card.rows,{name:'Unanswered area',score:null}]);const [open]=renderPerspectiveRadars({doc,report:gap,minimum:1});
 assert.equal(open.querySelectorAll('svg.radar-wide [data-radar-lens] polygon').length,0);assert.equal(open.querySelectorAll('svg.radar-wide circle').length,4);
 assert.equal(perspectiveRadarModels(gap,1)[0].lenses[0].scores.at(-1),null);
 assert.equal(renderPerspectiveRadars({doc,report:report(card.rows.slice(0,2)),minimum:1}).length,0);
 assert.deepEqual(perspectiveRadarModels({payload:{...report().payload,evidence:[]}},1),[]);
});
test('each perspective retains its own genuine axis count, including 5/4/6 preview shapes',()=>{
 const models=subdimensionRadarModels([5,4,6].map((n,i)=>({lens:['team','community','church'][i],n:1,rows:Array.from({length:n},(_,j)=>({name:'Own dimension '+j,score:j*13}))})),1);
 assert.deepEqual(models.map(m=>m.spokes.length),[5,4,6]);assert.deepEqual(models.map(m=>m.lenses.length),[1,1,1]);
});

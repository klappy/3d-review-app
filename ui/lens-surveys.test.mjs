import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {groupByLens,LENSES} from './lens-surveys.js';
const read=n=>readFileSync(fileURLToPath(new URL(n,import.meta.url)),'utf8');

const templates=[
  {id:'tpl_mid_level',version:2,name:'Mid-Level',perspective:'Translation Team'},{id:'tpl_mid_level',version:1,name:'Mid-Level',perspective:'Translation Team'},
  {id:'tpl_validation',version:2,name:'Validation',perspective:'Translation Team'},
  {id:'tpl_consultant',version:2,name:'Consultant',perspective:'Church'},{id:'tpl_consultant',version:1,name:'Consultant',perspective:'Translation Team'},
  {id:'tpl_denom_leader',version:2,name:'Denom-Leader',perspective:'Church'},{id:'tpl_involved_pastor',version:2,name:'Involved-Pastor',perspective:'Church'},{id:'tpl_community_pastor',version:2,name:'Community-Pastor',perspective:'Church'},
  {id:'tpl_audio',version:2,name:'Audio',perspective:'Community'},{id:'tpl_video_sign',version:2,name:'Video-Sign',perspective:'Community'},{id:'tpl_written',version:2,name:'Written',perspective:'Community'},
];
const surveys=[
  {id:'s1',template_id:'tpl_validation',template_version:1,state:'selected',archived_at:null,template_name:'Validation',perspective:'Translation Team',collection_status:'open'},
  {id:'s2',template_id:'tpl_audio',template_version:2,state:'archived',archived_at:'2026-09-17T00:00:00Z',template_name:'Audio',perspective:'Community',collection_status:'closed'},
];

test('three lenses in the captain\'s order; groups come from the server perspective, nothing invented',()=>{
  assert.deepEqual(LENSES,['Translation Team','Church','Community']);
  const g=groupByLens({surveys,templates});
  assert.deepEqual(g.map(x=>x.lens),LENSES);
  assert.deepEqual(g[0].included.map(s=>s.id),['s1']);
  assert.deepEqual(g[0].available.map(t=>`${t.name}@${t.version}`),['Mid-Level@2'],'included template not offered again; only the current version offered');
  assert.deepEqual(g[1].available.map(t=>t.name),['Consultant','Denom-Leader','Involved-Pastor','Community-Pastor'],'Consultant v2 is Church; the legacy v1 Translation Team row does not leak');
  assert.deepEqual(g[2].included,[],'archived survey is not included');
  assert.deepEqual(g[2].available.map(t=>t.name),['Audio','Video-Sign','Written']);
});
test('empty catalogue is stated as not loaded, never as "every survey included"',()=>{
  const src=read('./lens-surveys.js');
  assert.ok(src.includes("!snapshot.templates.length) card.append(el('p', 'Template catalogue not loaded"));
  assert.ok(src.indexOf('Template catalogue not loaded')<src.indexOf('Every current survey for this lens is included.'),'the not-loaded branch is checked first');
});
test('an unknown perspective is shown as a fourth "Other perspective" group, never folded into a lens',()=>{
  const g=groupByLens({surveys:[],templates:[{id:'x',version:1,name:'X',perspective:'Somewhere'}]});
  assert.equal(g.length,4); assert.equal(g[3].lens,'Other perspective'); assert.equal(g[3].available[0].name,'X');
});
test('wiring: root inside the stage workspace, assets, app.js actions use the existing capabilities and the existing #surveys control',()=>{
  const html=read('./index.html'),app=read('./app.js'),server=read('./server.mjs'),css=read('./lens-surveys.css');
  assert.ok(html.includes('<section id="lens-surveys-root" class="lens-surveys" aria-label="Surveys by lens" hidden></section><div data-stage-content="collect">'));
  assert.ok(html.includes('<link rel="stylesheet" href="/lens-surveys.css">')&&server.includes("'/lens-surveys.js':")&&server.includes("'/lens-surveys.css':"));
  assert.ok(app.includes("await api(`/v2/assessments/${path(aid)}/surveys`, { method: 'POST', body: { template_id, version: Number(version) } }); await chooseAssessment();"));
  assert.ok(app.includes("await api(`/v2/assessments/${path(aid)}/surveys/${path(sid)}`, { method: 'DELETE' }); await chooseAssessment();"));
  assert.ok(app.includes("open: sid => { $('surveys').value = sid; if ($('surveys').value === sid) $('surveys').dispatchEvent(new Event('change')); }"));
  assert.ok(app.includes("lensSurveys?.set({ aid: result.assessment.id, role: result.assessment.role, stage: result.assessment.stage, surveys: result.surveys || [], templates: state.templates || [] });"));
  assert.ok(app.includes("entityScreen?.reset(); lensSurveys?.reset();"));
  assert.ok(!app.includes("if (result.surveys?.length === 1) { $('surveys').value = result.surveys[0].id;"),'no auto-selecting a single survey: the assessment is a collection');
  assert.match(css,/body\[data-workspace-phase="understand"\] #lens-surveys-root,\s*body\[data-workspace-phase="improve"\] #lens-surveys-root \{ display:none; \}/);
  assert.ok(read('./.assetsignore').split('\n').includes('lens-surveys.test.mjs'));
});

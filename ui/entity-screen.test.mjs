import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {entityLevel,parseDeepLink,deepLinkFor} from './entity-screen.js';
const read=n=>readFileSync(fileURLToPath(new URL(n,import.meta.url)),'utf8');

test('level is derived from actual selection, deepest wins; signed out has no level',()=>{
  assert.equal(entityLevel({staff:false,workspace:{id:'w'},project:'p',assessment:'a'}),null);
  assert.equal(entityLevel({staff:true,workspace:null,project:'',assessment:''}),'workspaces');
  assert.equal(entityLevel({staff:true,workspace:{id:'w'},project:'',assessment:''}),'workspace');
  assert.equal(entityLevel({staff:true,workspace:{id:'w'},project:'p',assessment:''}),'project');
  assert.equal(entityLevel({staff:true,workspace:null,project:'p',assessment:'a'}),'assessment');
  assert.equal(entityLevel({staff:true,workspace:null,project:'',assessment:'granted'}),'assessment');
  assert.equal(entityLevel({staff:true,workspace:null,project:'p',assessment:'a',survey:'s'}),'survey');
});
test('deep links: #p/<pid> and #p/<pid>/a/<aid> only; tokens and other fragments never parse',()=>{
  assert.deepEqual(parseDeepLink('#p/proj_1'),{project:'proj_1',assessment:null});
  assert.deepEqual(parseDeepLink('#p/proj_1/a/assess_2'),{project:'proj_1',assessment:'assess_2'});
  for(const h of ['','#facilitator','#session=abc','#survey=abc','#a/assess_2','#p/','#p/x/a/','#p/x?y'])assert.equal(parseDeepLink(h),null,h);
  assert.equal(deepLinkFor({project:'proj_1',assessment:''}),'#p/proj_1');
  assert.equal(deepLinkFor({project:'proj_1',assessment:'assess_2'}),'#p/proj_1/a/assess_2');
  assert.equal(deepLinkFor({project:'',assessment:''}),'');
});
test('css is level-scoped, keeps the next-entity paths and the stage control reachable',()=>{
  const css=read('./entity-screen.css').replace(/\/\*[\s\S]*?\*\//g,'');
  for(const sel of css.replace(/\/\*[\s\S]*?\*\//g,'').split('}').map(c=>c.slice(0,c.indexOf('{')).trim()).filter(Boolean))
    for(const one of sel.split(',').map(x=>x.trim()).filter(x=>x&&!x.startsWith('@')))
      assert.ok(/^\.rv(\[data-entity-level="(workspaces|workspace|project|assessment|survey)"\]| #entity-back| \.collab-accept| #collab:has\()/.test(one),`unscoped: ${one}`);
  assert.ok(!/#create-project/.test(css),'the authorized create-project form is never hidden');
  assert.ok(!/#set-stage/.test(css)&&!/\[data-entity-level="assessment"\] #assessment-card\s*[,{]/.test(css),'the stage control stays at assessment level');
  assert.ok(!/#projects\b|#assessments\b/.test(css.replace(/#project-card|#assessment-card|#load-assessments/g,'')),'selects are hidden only via their card chrome, never removed');
});
test('wiring: assets, back link inside #collab, entity screen mounted after collab and reset on identity change',()=>{
  const html=read('./index.html'),app=read('./app.js'),server=read('./server.mjs'),src=read('./entity-screen.js');
  assert.ok(html.includes('<link rel="stylesheet" href="/entity-screen.css">'));
  assert.ok(server.includes("'/entity-screen.js':")&&server.includes("'/entity-screen.css':"));
  assert.ok(html.includes('<section id="collab" class="collab" aria-label="Workspaces and collaborators"><button id="entity-back" class="rv-btn quiet" type="button" hidden></button>'));
  assert.ok(app.includes("const entityScreen = sharedMode || typeof window === 'undefined' ? null : mountEntityScreen(document, window, {"));
  assert.ok(app.includes("  collab.reset(); // W/I managers clear synchronously before any other identity work\n  entityScreen?.reset();"));
  assert.ok(src.includes("const assessmentValue = () => assessments.value || granted?.value || '';"),'assessment-only grants count as an assessment selection');
  assert.ok(src.includes("granted?.addEventListener('change', render)"));
  assert.ok(app.includes("collab.setScope({ type: 'assessment', id: result.assessment.id, role: result.assessment.role });"));
  assert.ok(app.includes("lensSurveys?.set({ aid: result.assessment.id, role: result.assessment.role, stage: result.assessment.stage, surveys: result.surveys || [], templates: state.templates || [], canOpen: !$('survey-card').hidden });"));
  assert.ok(app.includes('async function chooseGrantedAssessment()')&&app.includes('if (!state.templates) await templates();'));
  assert.ok(read('./.assetsignore').split('\n').includes('entity-screen.test.mjs'));
});

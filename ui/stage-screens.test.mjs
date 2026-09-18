import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  STAGES, STAGE_TOUR, REPEAT_WHEN_APPROPRIATE,
  isStageId, stageLabel, selectStageTab, recalledTab,
  authorizedRole, roleHelpVisible, printAllowed, helpForStage,
  shouldShowStageTour, dismissStageTour,
  credentialFields, itemsFromPrintHtml, printTitleFromHtml,
  loadRoleHelp, loadBlankPrint,
  renderAssessmentHeadrow, renderStageTabs, renderRoleHelp, renderStageTour, renderBlankPrint, printBlankForm,
} from './stage-screens.js';

function fakeNode(tag, id) {
  const attrs = new Map();
  return {
    tag, id, textContent: '', children: [], listeners: {}, hidden: false, className: '',
    selected: false, value: '', type: '',
    setAttribute(k, v) { attrs.set(k, String(v)); },
    getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
    addEventListener(event, fn) { (this.listeners[event] ||= []).push(fn); },
    async fire(event, extra = {}) {
      for (const fn of this.listeners[event] || []) await fn({ preventDefault() {}, currentTarget: this, ...extra });
    },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
  };
}
function fakeDocument() {
  const nodes = new Map();
  const doc = {
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, fakeNode('div', id)); return nodes.get(id); },
    createElement(tag) { return fakeNode(tag); },
    createTextNode(text) { return { tag: '#text', textContent: text, children: [] }; },
  };
  return doc;
}
function memory() {
  const store = new Map();
  return {
    store,
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
  };
}
const json = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });
function fetchFor(routes, log) {
  return async (url, options) => {
    log.push({ url, options });
    const r = routes[url];
    if (typeof r === 'function') return r();
    if (r === undefined) return json({ ok: false, error: { code: 'NOT_FOUND_OR_NOT_VISIBLE' } }, false, 404);
    return r;
  };
}
const text = node => [node.textContent, ...node.children.map(text)].join('');

test('plan06 stage tabs are Prepare Collect Understand Improve in that order', () => {
  assert.deepEqual(STAGES.map(s => s.id), ['prepare', 'collect', 'understand', 'improve']);
  assert.deepEqual(STAGES.map(s => s.label), ['Prepare', 'Collect', 'Understand', 'Improve']);
  assert.equal(REPEAT_WHEN_APPROPRIATE, 'Repeat when appropriate');
  assert.equal(isStageId('people'), false);
  assert.equal(isStageId('preparing'), false);
  assert.equal(stageLabel('understand'), 'Understand');
});

test('selecting a tab remembers it per assessment and never calls set_stage', async () => {
  const storage = memory();
  const log = [];
  const request = fetchFor({}, log);
  const next = selectStageTab(storage, 'assess_1', 'understand');
  assert.equal(next, 'understand');
  assert.equal(recalledTab(storage, 'assess_1'), 'understand');
  assert.equal(recalledTab(storage, 'assess_2', 'prepare'), 'prepare');
  assert.equal(selectStageTab(storage, 'assess_1', 'people'), 'understand');
  assert.deepEqual(log, []);
  assert.equal(log.some(r => /\/stage/.test(r.url)), false);
});

test('renderStageTabs paints four tabs, keeps server stage distinct, click does not fetch', async () => {
  const doc = fakeDocument(), storage = memory(), log = [];
  const root = doc.createElement('div');
  const selected = [];
  renderStageTabs(doc, root, { assessmentId: 'a1', stage: 'prepare', selected: 'prepare', storage, onSelect: id => selected.push(id) });
  const nav = root.children[0];
  assert.equal(nav.getAttribute('role'), 'tablist');
  assert.deepEqual(nav.children.map(b => b.textContent), ['Prepare', 'Collect', 'Understand', 'Improve']);
  assert.equal(nav.children[0].getAttribute('aria-selected'), 'true');
  assert.match(root.children[1].textContent, /Current stage: Prepare/);
  assert.equal(root.children[2].textContent, REPEAT_WHEN_APPROPRIATE);
  await nav.children[2].fire('click');
  assert.deepEqual(selected, ['understand']);
  assert.equal(recalledTab(storage, 'a1'), 'understand');
  assert.deepEqual(log, []);
});

test('role-help is hidden without an authorized assessment role', () => {
  assert.equal(authorizedRole({}), null);
  assert.equal(authorizedRole({ role: 'participant' }), null);
  assert.equal(roleHelpVisible(null), false);
  assert.equal(helpForStage({ role: 'viewer', can: [], next_best: {} }, 'prepare').visible, true);
  assert.equal(helpForStage(null, 'prepare').visible, false);
});

test('loadRoleHelp uses assessment.get exact role then docs.get?role=; viewer does not get member next_best', async () => {
  const log = [];
  const request = fetchFor({
    '/v2/assessments/a1': json({ ok: true, result: { assessment: { id: 'a1', stage: 'prepare', role: 'viewer' } } }),
    '/v2/docs?role=viewer': json({
      ok: true,
      result: {
        role: 'viewer',
        can: ['cap.results.summary', 'cap.assessment.get'],
        next_best: { prepare: 'cap.survey.select', collect: 'cap.survey.issue_codes', understand: 'cap.results.summary', improve: 'cap.assessment.notes.update' },
      },
    }),
  }, log);
  const hidden = await loadRoleHelp({ request, token: 'st_owner', assessmentId: null, stage: 'prepare' });
  assert.equal(hidden.visible, false);
  const help = await loadRoleHelp({ request, token: 'st_owner', assessmentId: 'a1', stage: 'prepare' });
  assert.equal(help.visible, true);
  assert.equal(help.role, 'viewer');
  assert.equal(help.available, null);
  const understand = helpForStage({
    role: 'viewer',
    can: ['cap.results.summary'],
    next_best: { understand: 'cap.results.summary', prepare: 'cap.survey.select' },
  }, 'understand');
  assert.equal(understand.available, 'cap.results.summary');
  assert.deepEqual(log.map(r => r.url), ['/v2/assessments/a1', '/v2/docs?role=viewer']);
  assert.equal(log[0].options.headers.authorization, 'Bearer st_owner');
  assert.equal(log.some(r => r.url.includes('/stage')), false);
});

test('loadRoleHelp stays hidden when assessment is not visible', async () => {
  const log = [];
  const request = fetchFor({
    '/v2/assessments/nope': json({ ok: false, error: { code: 'NOT_FOUND_OR_NOT_VISIBLE' } }, false, 404),
    '/v2/docs?role=owner': json({ ok: true, result: { role: 'owner', can: ['cap.survey.select'], next_best: { prepare: 'cap.survey.select' } } }),
  }, log);
  const help = await loadRoleHelp({ request, token: 'st_x', assessmentId: 'nope', stage: 'prepare' });
  assert.equal(help.visible, false);
  assert.equal(log.some(r => r.url.startsWith('/v2/docs')), false);
});

test('printAllowed is owner/member only; viewer never fetches print', async () => {
  assert.equal(printAllowed('owner'), true);
  assert.equal(printAllowed('member'), true);
  assert.equal(printAllowed('viewer'), false);
  const log = [];
  const request = fetchFor({ '/v2/assessments/a1/surveys/s1/print': json({ ok: true, result: { blank: true, html: '<h1>X</h1>' } }) }, log);
  const hidden = await loadBlankPrint({ request, token: 'st_x', aid: 'a1', sid: 's1', role: 'viewer' });
  assert.equal(hidden.visible, false);
  assert.deepEqual(log, []);
});

test('blank print requires blank:true and refuses credential-bearing payloads', async () => {
  assert.deepEqual(credentialFields({ blank: true, html: '<h1>T</h1>' }), []);
  assert.ok(credentialFields({ blank: true, codes: ['ABCD-EFGH'] }).includes('codes'));
  assert.ok(credentialFields({ blank: false, html: '<h1>T</h1>' }).includes('not-blank'));
  const log = [];
  const html = '<!doctype html><title>Team form</title><h1>Team form</h1><ol><li>How does review work?<hr></li><li>Who decides?<hr></li></ol>';
  const request = fetchFor({
    '/v2/assessments/a1/surveys/s1/print': json({
      ok: true, result: { html, content_type: 'text/html; charset=utf-8', template_id: 'tpl_team', template_version: 2, blank: true },
    }),
    '/v2/assessments/a1/surveys/s2/print': json({
      ok: true, result: { blank: true, codes: [{ id: 'code_1', code: 'ABCD-EFGH' }], html: '<h1>nope</h1>' },
    }),
  }, log);
  const okPrint = await loadBlankPrint({ request, token: 'st_m', aid: 'a1', sid: 's1', role: 'member' });
  assert.equal(okPrint.visible, true);
  assert.equal(okPrint.blank, true);
  assert.deepEqual(okPrint.items, ['How does review work?', 'Who decides?']);
  assert.equal(okPrint.title, 'Team form');
  const unsafe = await loadBlankPrint({ request, token: 'st_m', aid: 'a1', sid: 's2', role: 'member' });
  assert.equal(unsafe.visible, false);
  assert.equal(unsafe.reason, 'unsafe-print');
});

test('itemsFromPrintHtml does not execute markup and printTitle is text-only', () => {
  assert.deepEqual(itemsFromPrintHtml('<li>A &amp; B<hr></li><li>C<hr></li>'), ['A & B', 'C']);
  assert.equal(printTitleFromHtml('<h1>Community &lt;form&gt;</h1>'), 'Community <form>');
});

test('renderBlankPrint uses empty code slot, no invitation URL, no innerHTML, no credentials', () => {
  const doc = fakeDocument();
  const root = doc.createElement('div');
  renderBlankPrint(doc, root, {
    visible: true, blank: true, title: 'Team form', items: ['How does review work?'],
    template_id: 'tpl_team', template_version: 2,
  });
  const page = text(root);
  assert.match(page, /Blank code slot|Code \(optional/);
  assert.match(page, /No invitation link on this blank form/);
  assert.match(page, /never prints codes or credentials/);
  assert.match(page, /How does review work\?/);
  assert.equal(/ABCD-EFGH|st_|Bearer |link_token/.test(page), false);
  assert.equal(/https?:\/\//.test(page), false);
  for (const n of walk(root)) assert.equal('innerHTML' in n, false);
  const slot = findClass(root, 'p-slot');
  assert.equal(slot.children.length, 6);
  assert.equal(slot.children.every(c => c.textContent === ''), true);
});

test('stage tour covers the four assessment stages and is not a public five-step tour', () => {
  assert.deepEqual(Object.keys(STAGE_TOUR), ['prepare', 'collect', 'understand', 'improve']);
  for (const stage of STAGES) {
    assert.equal(STAGE_TOUR[stage.id].length, 3);
    assert.equal(STAGE_TOUR[stage.id].join(' ').includes('Welcome'), false);
    assert.equal(STAGE_TOUR[stage.id].join(' ').includes('Take a survey'), false);
  }
  assert.match(STAGE_TOUR.prepare[2], /Browsing the four phases never changes the stage/);
  assert.match(STAGE_TOUR.improve[1], /Repeat when it helps/);
});

test('stage tour shows once per stage then dismisses without API calls', async () => {
  const doc = fakeDocument(), storage = memory(), log = [];
  const root = doc.createElement('div');
  assert.equal(shouldShowStageTour(storage, 'a1', 'collect'), true);
  renderStageTour(doc, root, { storage, assessmentId: 'a1', stage: 'collect', role: 'member' });
  assert.equal(root.hidden, false);
  assert.equal(root.children[0].children[2].children.length, 3);
  await root.children[0].children[1].children.at(-1).fire('click');
  assert.equal(shouldShowStageTour(storage, 'a1', 'collect'), false);
  assert.equal(shouldShowStageTour(storage, 'a1', 'prepare'), true);
  renderStageTour(doc, root, { storage, assessmentId: 'a1', stage: 'collect', role: 'member' });
  assert.equal(root.hidden, false);
  assert.equal(root.children[0].getAttribute('open'), null);
  assert.deepEqual(log, []);
});

test('renderRoleHelp hides when unauthorized and never lists other-role capabilities', () => {
  const doc = fakeDocument();
  const root = doc.createElement('div');
  renderRoleHelp(doc, root, { visible: false });
  assert.equal(root.hidden, true);
  renderRoleHelp(doc, root, { visible: true, role: 'member', available: 'cap.survey.select', can: ['cap.survey.select'] });
  assert.equal(root.hidden, false);
  assert.match(text(root), /Authorized role: member/);
  assert.match(text(root), /Next here: cap\.survey\.select/);
});

test('module source does not import Root or Claude Design C files and CSS is a separate file', () => {
  const js = fs.readFileSync(new URL('./stage-screens.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('./stage-screens.css', import.meta.url), 'utf8');
  assert.equal(/^import /m.test(js), false);
  assert.equal(/from ['"].*app\.js['"]/.test(js), false);
  assert.equal(/from ['"].*report-view/.test(js), false);
  assert.equal(/tokens\.css/.test(js), false);
  assert.equal(/views-public/.test(js), false);
  assert.match(css, /\.paper/);
  assert.match(css, /\.p-slot/);
  assert.match(css, /@media print/);
  assert.equal(/@import/.test(css), false);
});

function walk(node) {
  return [node, ...node.children.flatMap(walk)];
}
function findClass(node, className) {
  if (node.className === className) return node;
  for (const child of node.children) {
    const found = findClass(child, className);
    if (found) return found;
  }
  return null;
}


test('tour omits unsupported bands, suppression, invited denominator and review gates', () => {
  assert.doesNotMatch(Object.values(STAGE_TOUR).flat().join(' '), /Bands|Withheld|small group|over invited|review gate|moves the stage/);
});
test('blank print instructions correspond to actual empty answer lines', () => {
  const doc=fakeDocument(), root=doc.createElement('div');
  renderBlankPrint(doc,root,{visible:true,blank:true,items:['First?','Second?']});
  assert.match(text(root),/Write your response on the blank lines/);
  assert.doesNotMatch(text(root),/Mark one box|choose all/);
  const lines=walk(root).filter(n=>n.className==='p-lines');
  assert.equal(lines.length,2);
  assert.ok(lines.every(n=>n.children.length===2 && n.children.every(c=>text(c)==='')));
});
test('print wrapper contains only new blank article and cleans up even on print failure', () => {
  const doc=fakeDocument(); doc.body=fakeNode('body');
  const create=doc.createElement;
  doc.createElement=tag=>{const n=create(tag);n.remove=()=>{doc.body.children=doc.body.children.filter(c=>c!==n);};return n;};
  const workspace=fakeNode('main');workspace.textContent='PRIVATE WORKSPACE';doc.body.append(workspace);
  const model={visible:true,blank:true,items:['Question?']};
  assert.throws(()=>printBlankForm(doc,model,{print(){
    const isolated=doc.body.children[1];
    assert.equal(isolated.className,'stage-print-only');
    assert.equal(isolated.children.length,2);
    assert.match(isolated.children[1].textContent, /size: letter/);
    assert.equal(isolated.children[0].tag,'article');
    assert.doesNotMatch(text(isolated),/PRIVATE WORKSPACE/);
    throw new Error('cancelled');
  }}),/cancelled/);
  assert.deepEqual(doc.body.children,[workspace]);
  let calls=0;assert.equal(printBlankForm(doc,{...model,blank:false},{print(){calls++;}}),false);
  assert.equal(calls,0);
});

test('missing stage suggestion does not falsely deny an authorized role', () => {
  const doc=fakeDocument(),root=doc.createElement('div');
  renderRoleHelp(doc,root,{visible:true,role:'member',available:null});
  assert.match(text(root),/Authorized role: member/);
  assert.doesNotMatch(text(root),/not available|not authorized|denied/i);
});


test('dismissed tour remains reopenable, first visit opens, unauthorized tour stays hidden', () => {
  const doc=fakeDocument(),root=doc.createElement('div'),storage=memory();
  renderStageTour(doc,root,{storage,assessmentId:'a1',stage:'collect',role:'member'});
  assert.equal(root.children[0].tag,'details');
  assert.equal(root.children[0].getAttribute('open'),'');
  dismissStageTour(storage,'a1','collect');
  renderStageTour(doc,root,{storage,assessmentId:'a1',stage:'collect',role:'member'});
  assert.equal(root.hidden,false);assert.equal(root.children[0].getAttribute('open'),null);
  assert.equal(root.children[0].children[0].tag,'summary');
  renderStageTour(doc,root,{storage,assessmentId:'a1',stage:'collect',role:'participant'});
  assert.equal(root.hidden,true);
});
test('role help defaults to a collapsed native disclosure retaining exact role and suggestion',()=>{
  const doc=fakeDocument(),root=doc.createElement('div');
  renderRoleHelp(doc,root,{visible:true,role:'member',available:'cap.results.summary'});
  assert.equal(root.children[0].tag,'details');assert.equal(root.children[0].getAttribute('open'),null);
  assert.match(text(root),/Authorized role: member/);assert.match(text(root),/cap.results.summary/);
});


test('assessment heading uses exact returned context without inferred parent, language or role', () => {
  const doc=fakeDocument(), root=doc.getElementById('heading');
  renderAssessmentHeadrow(doc,root,{name:'Actual <assessment>',period:'September 2026',format:'Audio',language_id:'private-id',role:'viewer'});
  assert.equal(root.children[0].tag,'h1');
  assert.deepEqual(root.children.map(n=>n.textContent),['Actual <assessment>','September 2026 · Audio','viewer']);
  assert.equal(root.children[2].getAttribute('title'),'Your role at this assessment');
  renderAssessmentHeadrow(doc,root,{name:'Direct assessment',period:null,format:null,language_id:'unresolved'});
  assert.deepEqual(root.children.map(n=>n.textContent),['Direct assessment']);
  renderAssessmentHeadrow(doc,root,null);assert.equal(root.children.length,0);
});


test('print defaults to Letter and preserves explicit A4 through isolated output', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<main id="preview"></main>');
  const doc = dom.window.document, root = doc.querySelector('main');
  const model = { visible: true, blank: true, items: Array.from({ length: 30 }, (_, i) => `Question ${i + 1}?`) };
  const captured = [];
  renderBlankPrint(doc, root, model, { onPrint() {
    const output = doc.querySelector('.stage-print-only');
    captured.push([output.querySelector('article').className, output.querySelector('style').textContent]);
    assert.equal(output.querySelectorAll('.p-lines').length, 30);
  } });
  assert.equal(root.querySelector('select').value, 'letter');
  root.querySelector('button').click();
  assert.equal(captured[0][0], 'paper letter');
  assert.match(captured[0][1], /size: letter/);
  const select = root.querySelector('select'); select.value = 'a4';
  select.dispatchEvent(new dom.window.Event('change'));
  assert.equal(root.querySelector('select').value, 'a4');
  root.querySelector('button').click();
  assert.equal(captured[1][0], 'paper a4');
  assert.match(captured[1][1], /size: A4/);
  assert.equal(doc.querySelector('.stage-print-only'), null);
  dom.window.close();
});

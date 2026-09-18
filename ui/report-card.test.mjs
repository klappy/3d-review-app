import assert from 'node:assert/strict';
import test from 'node:test';
import { renderReportCards } from './report-card.js';
const doc = { createElement(tag) { return { tag, textContent:'', children:[], dataset:{}, append(...nodes) { this.children.push(...nodes); } }; } };
const report = lenses => ({ payload:{ source_commit:'f042cde', versions:{scorer:'source'}, lenses } });
const render = lenses => renderReportCards({doc, report:report(lenses)});
const text = n => [n.textContent, ...n.children.map(text)].join('\n');
test('exact score precision, zero, null and supplied order survive; no invented third card', () => {
  const section = render([{lens:'church',score:0},{lens:'team',score:66.66666},{lens:'community',score:null}]);
  const cards = section.children[1].children;
  assert.deepEqual(cards.map(c=>c.dataset.lens), ['church','team','community']);
  assert.deepEqual(cards.map(c=>c.children[1].textContent), ['0','66.66666','null']);
  assert.equal(render([{lens:'team',score:1}]).children[1].children.length,1);
});
test('subdimension fields retain exact source values and text-only rendering', () => {
  const section=render([{lens:'<img onerror=bad>',score:12.1234567,sub_dimensions:[{sub_dimension:'<script>',score:null,n_items_included:0}]}]);
  const card=section.children[1].children[0];
  assert.equal(card.children[0].textContent,'<img onerror=bad>');
  assert.equal(card.children[2].children[0].textContent,'<script> · null · 0');
  assert.equal(card.className,'report-lens-card glass panel');
  assert.doesNotMatch(text(section),/Strong|Growing|invited|suppressed/);
});
test('absent, empty or malformed lenses and invalid report guard produce no cards', () => {
  for (const lenses of [undefined,null,[],{},[null]]) assert.equal(render(lenses),null);
  for (const value of [null,{}, {payload:[]},{payload:{lenses:[{lens:'team',score:0}]} }]) {
    assert.equal(renderReportCards({doc,report:value}),null);
  }
});
test('input stays immutable and standalone/cross-lens values do not become cards', () => {
  const r=report([{lens:'team',score:0,sub_dimensions:[]}]);
  r.payload.cross_lens_multi=[{score:100}];
  r.payload.standalone_indicators=[{score:99}];
  const before=JSON.stringify(r);
  const section=renderReportCards({doc,report:r});
  assert.equal(JSON.stringify(r),before);
  assert.equal(section.children[1].children.length,1);
  assert.doesNotMatch(text(section),/100|99/);
});

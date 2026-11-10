// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { printPageModel, clearLinks } from '../ui-next/src/app/data.js';
import { preparePapers, papersDocumentHtml, openPapersPrint } from '../ui-next/src/app/print.js';
import { printDocumentHtml, paperLink } from '../ui/assess/print.js';
import { writeFileSync } from 'node:fs';

const origin = 'https://surveys.example.test';
const aid = 'assessment_fixture', pid = 'project_fixture';
const surveys = Array.from({ length: 7 }, (_, i) => ({ id: `survey_fixture_${i}`, template_name: `Fixture role ${i + 1}`, template_id: `template_fixture_${i}`, perspective: i < 3 ? 'Translation Team' : i < 6 ? 'Community' : 'Church', state: 'selected', collection_status: 'open' }));
const entry = (i:number) => `#survey=existing_fixture_${i}-AbC_123`;
// Long choice text and all supported item types exercise multipage print layout, without real participant data.
const items = (i:number) => Array.from({ length: 20 }, (_, j) => ({ text: `Role ${i + 1} question ${j + 1}: Which description best represents this project and the passage discussed together?`, type: j % 4 === 0 ? 'multi' : j % 4 === 1 ? 'single' : j % 4 === 2 ? 'scale' : 'text', ...(j % 4 < 2 ? { options: [{ code: 'yes', text: `Role ${i + 1} question ${j + 1} option A: The meaning is clear and people can explain it in their own words.` }, { code: 'no', text: `Role ${i + 1} question ${j + 1} option B: Some parts need more discussion and careful explanation before people can confidently use this translation.` }, { code: 'other', text: `Role ${i + 1} question ${j + 1} option C: Other (please explain)` }] } : j % 4 === 2 ? { scale: { min: 1, max: 5 } } : {}) }));
const ok = (result:any) => new Response(JSON.stringify({ ok: true, result }), { headers: { 'content-type': 'application/json' } });
function fixture() {
  clearLinks();
  vi.stubGlobal('location', { origin });
  const request = vi.fn(async (path:string, init:any = {}) => {
    if (path === `/v2/assessments/${aid}`) return ok({ assessment: { id: aid, project_id: pid, name: 'Fixture review', language_name: 'English', role: 'owner', stage: 'collect' }, surveys });
    if (path === `/v2/projects/${pid}`) return ok({ project: { id: pid, name: 'Fixture project', lwc: [] } });
    if (path.endsWith('/passages')) return ok({ passages: [{ reference: 'Luke 1:1-4' }] });
    if (path.endsWith('/results')) return ok({ level_minimum_responses: 3 });
    const match = path.match(/\/surveys\/survey_fixture_(\d)(?:\/(links|print))?$/);
    if (!match) throw new Error(`Unexpected fixture request: ${path}`);
    const i = Number(match[1]);
    if (match[2] === 'links') {
      // Existing data-adapter behavior only: mocked reuse of a pre-existing invitation, never a real issue/mint.
      const body = JSON.parse(init.body);
      return ok(body.mode === 'dry_run' ? { reuses: `invitation_fixture_${i}`, confirm_token: 'fixture_confirmation' } : { link_id: `invitation_fixture_${i}`, entry_fragment: entry(i), reused: true, expires_at: null });
    }
    if (match[2] === 'print') return ok({ blank: true, template_id: surveys[i].template_id, template_version: 2, html: `<h1>${surveys[i].template_name}</h1>`, items: items(i) });
    return ok({ counts: { respondents: 0, responses: 0 } });
  });
  vi.stubGlobal('fetch', request);
  return request;
}
afterEach(() => { clearLinks(); vi.unstubAllGlobals(); });

it('real Next adapter -> preparation -> combined seven papers retains each exact existing URL, QR and identity on A4/Letter reprints', async () => {
  const request = fixture();
  const m = await printPageModel(aid, { principal: { display_name: 'Fixture owner' } });
  expect(m.surveys.map((s:any) => s.code)).toEqual(surveys.map((_, i) => `${origin}/next/?ui_next=on${entry(i)}`));
  const before = request.mock.calls.filter(([, init]) => init?.method === 'POST').length;
  const models = await preparePapers(m, surveys.map(s => s.id), { tok: 'fixture_staff_session' });
  expect(request.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(before);
  const again = await preparePapers(m, surveys.map(s => s.id), { tok: 'fixture_staff_session' });
  expect(again).toEqual(models);
  const expected = surveys.map((s, i) => ({ survey: s.id, role: s.template_name, assessment: aid, project: pid, url: `${origin}/next/?ui_next=on${entry(i)}` }));
  for (const paper of ['a4', 'letter']) {
    const html = papersDocumentHtml(models, { paper, title: 'Synthetic seven survey print acceptance' });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const pages = [...doc.querySelectorAll('.paper-page')];
    expect(pages).toHaveLength(7);
    for (const [i, page] of pages.entries()) {
      expect(page.querySelector('.p-url')?.textContent).toBe(expected[i].url);
      expect(page.querySelectorAll('img.qr')).toHaveLength(1);
      expect(page.querySelector('.p-ident')?.textContent).toContain(`${pid} · ${aid} · ${surveys[i].id}`);
      expect(page.textContent).toContain(surveys[i].template_name);
      expect(page.querySelectorAll('.p-item')).toHaveLength(20);
      for (const item of items(i)) for (const option of item.options ?? []) expect(page.textContent).toContain(option.text);
      const rootUrl = `${origin}/${entry(i)}`;
      const individual = printDocumentHtml({ ...models[i], link: paperLink({ url: rootUrl }) }, { paper });
      const single = new DOMParser().parseFromString(individual, 'text/html');
      expect(single.querySelector('.p-url')?.textContent).toBe(rootUrl);
      expect(new URL(rootUrl).hash).toBe(new URL(expected[i].url).hash);
      expect(single.querySelector('.p-ident')?.textContent).toBe(page.querySelector('.p-ident')?.textContent);
      expect(single.querySelector('.p-items')?.outerHTML).toBe(page.querySelector('.p-items')?.outerHTML);
      if (process.env.BULK_QR_EVIDENCE_DIR) writeFileSync(`${process.env.BULK_QR_EVIDENCE_DIR}/individual-${paper}-${i + 1}.html`, individual);
    }
    expect(html).not.toMatch(/No shared link|fixture_staff_session|fixture_confirmation/);
    if (process.env.BULK_QR_EVIDENCE_DIR) writeFileSync(`${process.env.BULK_QR_EVIDENCE_DIR}/combined-${paper}.html`, html);
  }
  if (process.env.BULK_QR_EVIDENCE_DIR) writeFileSync(`${process.env.BULK_QR_EVIDENCE_DIR}/expected.json`, JSON.stringify({ expected, items: surveys.map((_, i) => items(i)) }, null, 2));
  let opened = '';
  const document = { open: vi.fn(), write: (s:string) => { opened = s; }, close: vi.fn() };
  expect(openPapersPrint({ open: () => ({ document }) }, models, { paper: 'a4' })).toBe(true);
  expect(opened).toContain('addEventListener("load"');
  expect((opened.match(/class="p-qr"/g) ?? [])).toHaveLength(7);
  expect(openPapersPrint({ open: () => null }, models)).toBe(false);
});

it('preparation refuses unauthorized roles before any read and preserves truthful missing/invalid-link paper fallback', async () => {
  const request = fixture();
  const m = await printPageModel(aid, {});
  request.mockClear();
  for (const role of ['viewer', 'participant', 'unknown']) await expect(preparePapers({ ...m, role }, [surveys[0].id], { tok: null })).rejects.toThrow('cannot print');
  expect(request).not.toHaveBeenCalled();
  for (const role of ['owner', 'member']) {
    const bad = { ...m, role, surveys: m.surveys.map((s:any, i:number) => ({ ...s, code: i === 0 ? '' : `${origin}/other/${entry(i)}` })) };
    const models = await preparePapers(bad, [surveys[0].id, surveys[1].id], { tok: null });
    const doc = new DOMParser().parseFromString(papersDocumentHtml(models), 'text/html');
    expect(doc.querySelectorAll('.qr.none')).toHaveLength(2);
    expect(doc.querySelectorAll('img.qr')).toHaveLength(0);
    expect(doc.body.textContent).toContain('No shared link for this survey yet');
  }
});

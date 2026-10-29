// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import ReviewResources from '../ui-next/src/screens/actions/ReviewResources.svelte';
import Live from '../ui-next/src/app/Live.svelte';
// @ts-expect-error plain JS
import { forget } from '../ui-next/src/app/session.js';
// @ts-expect-error plain JS
import { reviewResources } from '../ui-next/src/screens/actions/resource-data.js';
const { table } = vi.hoisted(() => ({ table: {} as Record<string, unknown> }));
vi.mock('../ui/assess/improve-resources.js', async (original) => {
  const actual = await original<Record<string, any>>();
  return { ...actual, resourcesFor: (area: string) => actual.resourcesFor(area, table) };
});
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; forget(); Object.keys(table).forEach(k => delete table[k]); vi.unstubAllGlobals(); });

it('uses the existing category lookup, rejects malformed URLs and renders escaped links with safe new-tab behavior', () => {
  table.Listening = [{ title: '<Guide>', url: 'https://example.org/guide?q=a&b=2' }, { title: 'unsafe', url: 'javascript:alert(1)' }, { title: 'invalid', url: 'https://' }];
  const weak = [{ label: 'Translation team · Listening' }];
  expect(reviewResources(weak)[0].resources).toHaveLength(1);
  const { container } = render(ReviewResources, { weak });
  const a = container.querySelector('a')!;
  expect(a.textContent).toBe('<Guide>'); expect(a.querySelector('guide')).toBeNull();
  expect(a.href).toBe('https://example.org/guide?q=a&b=2'); expect(a.target).toBe('_blank');
  expect(a.rel).toBe('noopener noreferrer');
});
it('empty categories and reports have distinct truthful states, with no fake action', () => {
  const { container, rerender } = render(ReviewResources, { weak: [{ label: 'Church · Listening' }] });
  expect(container.textContent).toContain('More resources coming.'); expect(container.querySelector('a')).toBeNull();
  return rerender({ weak: [] }).then(() => expect(container.textContent).toContain('No low-scoring areas are available to show'));
});

const aid = 'synthetic_resources', pid = 'synthetic_project';
const payload = { lenses: [{ lens: 'Translation Team', score: 30, sub_dimensions: [{ sub_dimension: 'Listening', score: 30 }] }], cross_lens_multi: [] };
function serve(fail = false) {
  const calls: string[] = [];
  const routes: Record<string, unknown> = {
    '/v2/me': { principal: { id: 'synthetic_principal', display_name: 'Synthetic Facilitator' } },
    [`/v2/assessments/${aid}`]: { assessment: { id: aid, project_id: pid, name: 'Synthetic resources review', stage: 'understand', role: 'viewer', format: 'written', language_name: 'Test language' }, surveys: [{ id: 's1', perspective: 'Translation Team' }] },
    [`/v2/assessments/${aid}/results`]: { status: 'ready' },
    [`/v2/projects/${pid}`]: { project: { id: pid, name: 'Synthetic project', workspace_id: null } },
    [`/v2/assessments/${aid}/surveys/s1`]: { counts: { responses: 5, respondents: 5 } },
    [`/v2/assessments/${aid}/reports`]: { reports: [{ id: 'synthetic_report', created_at: '2026-10-29T00:00:00Z' }], next_cursor: null },
    '/v2/reports/synthetic_report': { report: { id: 'synthetic_report', payload } },
  };
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    calls.push(`${init.method ?? 'GET'} ${url}`);
    const value = routes[String(url)]; const status = (fail && String(url).endsWith('/reports')) ? 500 : value ? 200 : 404;
    return new Response(JSON.stringify(status === 200 ? { ok: true, result: value } : { ok: false, error: { code: 'FAILED', message: 'Synthetic load failure' } }), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return calls;
}
for (const phone of [false, true]) {
  it(`real Next route loads report categories, resource fallback and contextual links (${phone ? 'phone' : 'desktop'}) without writes`, async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: phone, addEventListener() {}, removeEventListener() {} }));
    table.Listening = [{ title: 'Synthetic supplied guide', url: 'https://example.org/supplied-guide' }];
    const calls = serve(); globalThis.location.hash = `#/review/${aid}/next-step`;
    const { container } = render(Live);
    await waitFor(() => expect(container.querySelector('[data-resources-for]')).not.toBeNull());
    expect(container.querySelector('[data-resources-for]')!.textContent).toContain('Synthetic supplied guide');
    const resource = container.querySelector('[data-resources-for] a') as HTMLAnchorElement;
    expect(resource.href).toBe('https://example.org/supplied-guide'); expect(resource.target).toBe('_blank');
    const links = [...container.querySelectorAll('a')].map(a => a.getAttribute('href'));
    expect(links).toContain(`#/project/${pid}`);
    expect(links).toContain(`#/review/${aid}/results`);
    expect(calls.some(c => c.startsWith('POST'))).toBe(false);
  });
}
it('report-load failure exposes retry and does not render stale resource suggestions', async () => {
  serve(true); globalThis.location.hash = `#/review/${aid}/next-step`;
  const { container } = render(Live);
  await waitFor(() => expect(container.textContent).toContain('Try again'));
  expect(container.querySelector('[data-resources-for]')).toBeNull();
});

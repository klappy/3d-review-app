// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import Projects from '../ui-next/src/app/Projects.svelte';

const base = { id: 'scoped-project', name: 'Synthetic project', organization: 'Synthetic', role: 'viewer', assessment_count: 1, response_count: 12 };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const readsOnly = () => {
  const request = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true, result: { assessments: [] } })));
  vi.stubGlobal('fetch', request);
  return request;
};

describe('project card totals use only the supplied authorized aggregates', () => {
  for (const phone of [false, true]) for (const role of ['owner', 'member', 'viewer']) {
    it(`${role} ${phone ? 'phone' : 'desktop'}: displays the server-scoped response total without extra reads`, () => {
      const request = readsOnly();
      const view = render(Projects, { phone, projects: [{ ...base, role }] });
      expect(view.getByText(`Synthetic · ${role} · 1 review · 12 responses`)).toBeTruthy();
      expect(view.getByText(/Counts reflect reviews and submitted survey responses you can access/)).toBeTruthy();
      expect(view.getByText(/including archived reviews/)).toBeTruthy();
      expect(request).not.toHaveBeenCalled();
      expect(!!view.queryByRole('link', { name: 'Start a review in this project' })).toBe(role !== 'viewer');
    });
  }

  it.each([0, 1, 2])('a valid aggregate %s remains a real count with correct singular/plural labels', count => {
    const view = render(Projects, { projects: [{ ...base, assessment_count: count, response_count: count }] });
    expect(view.getByText(`Synthetic · viewer · ${count} review${count === 1 ? '' : 's'} · ${count} response${count === 1 ? '' : 's'}`)).toBeTruthy();
    expect(view.queryByText(/count unavailable/)).toBeNull();
  });

  it.each([undefined, null, -1, 1.5, '12', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('an unavailable or malformed response count %s is never presented as zero', count => {
    const view = render(Projects, { projects: [{ ...base, response_count: count }] });
    expect(view.getByText('Synthetic · viewer · 1 review · Response count unavailable')).toBeTruthy();
    expect(view.queryByText(/0 responses|NaN responses|Infinity responses/)).toBeNull();
  });

  it('an absent review total is also unavailable while a known response zero remains zero', () => {
    const view = render(Projects, { projects: [{ ...base, assessment_count: undefined, response_count: 0 }] });
    expect(view.getByText('Synthetic · viewer · Review count unavailable · 0 responses')).toBeTruthy();
  });

  it('different My/Global authorized input replaces the display without retaining or requesting other totals', async () => {
    const request = readsOnly();
    const view = render(Projects, { projects: [{ ...base, role: 'owner', assessment_count: 0, response_count: 0 }] });
    expect(view.getByText('Synthetic · owner · 0 reviews · 0 responses')).toBeTruthy();
    await view.rerender({ projects: [{ ...base, role: 'viewer', assessment_count: 4, response_count: 50 }] });
    expect(view.getByText('Synthetic · viewer · 4 reviews · 50 responses')).toBeTruthy();
    await view.rerender({ projects: [{ ...base, role: 'owner', assessment_count: 0, response_count: 0 }] });
    expect(view.queryByText(/50 responses/)).toBeNull();
    expect(view.getByText('Synthetic · owner · 0 reviews · 0 responses')).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
  });

  it('a project card never lists or fetches its reviews outside the project (owner rule), and its totals stay the server aggregates', () => {
    const request = readsOnly();
    const view = render(Projects, { phone: true, projects: [{ ...base, assessment_count: 2, response_count: 8 }] });
    expect(view.queryByRole('button', { name: /Show reviews/ })).toBeNull();
    expect(view.queryByRole('checkbox', { name: /archived reviews/i })).toBeNull();
    expect(view.getByText('Synthetic · viewer · 2 reviews · 8 responses')).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
  });

  it('an empty authorized project result displays no invented project or response total', () => {
    const request = readsOnly();
    const view = render(Projects, { projects: [] });
    expect(view.getByText('No projects match this view.')).toBeTruthy();
    expect(view.queryByText(/\d+ responses/)).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
});

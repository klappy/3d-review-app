// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import Shell from '../ui-next/src/AppShell.svelte';
import Code from '../ui-next/src/screens/participant/PCode.svelte';
import { qrPrintHtml, papersDocumentHtml } from '../ui-next/src/app/print.js';
afterEach(cleanup);
it('skips navigation into main content without changing the live route', async () => {
  location.hash = '#/project/p';
  const v = render(Shell);
  await fireEvent.click(v.getByText('Skip to main content'));
  expect(document.activeElement).toBe(v.container.querySelector('main'));
  expect(location.hash).toBe('#/project/p');
});
it('opens the functioning labelled sample participant fallback', () => {
  const v = render(Code);
  expect(v.getByRole('link', { name: /Try a sample survey/ }).getAttribute('href')).toBe('/participate/?demo=1');
});
it('QR print has an explicit same-origin return with no history dependency and rejects unsafe targets', () => {
  const options = { title: 'Synthetic review', surveys: [{ name: 'Survey', fullLink: 'https://example.invalid/#survey=local' }], returnHref: '/next/#/review/a/collect' };
  const html = qrPrintHtml(options);
  expect(html).toContain('<a href="/next/#/review/a/collect">Return to review</a>');
  expect(html).not.toContain('history.back');
  expect(qrPrintHtml({ ...options, returnHref: 'javascript:alert(1)' })).not.toContain('javascript:');
  expect(papersDocumentHtml([], { returnHref: '/next/#/review/a/print' })).toBe('');
});

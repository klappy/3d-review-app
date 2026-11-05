// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import Share from '../ui-next/src/screens/actions/Share.svelte';
import QRRoom from '../ui-next/src/screens/collect/QRRoom.svelte';
import collect from '../ui-next/fixtures/collect/collect.json';
import R from '../ui-next/fixtures/actions/review.json';
// @ts-expect-error plain JS
import { qrModules } from '../ui-next/src/app/data.js';
const surveys = Array.from({ length: 7 }, (_, i) => ({ ...R.surveys[0], name: `Role ${i + 1}`, code: `https://example.invalid/next/?ui_next=on#survey=unchanged-token-${i}`, lens: 'team' }));
const data = { ...R, host: '', shortHost: '', surveys };
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState({}, '', '/'); });
function browserDialog() {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); } });
}
for (const phone of [false, true]) describe(`Share presenter (${phone ? 'phone' : 'desktop'})`, () => {
  it('starts at selected row, traverses all seven exact links in order, clamps boundaries, closes and reopens', async () => {
    browserDialog();
    const v = render(Share, { props: { data, phone } });
    const row = (i: number) => v.getByRole('button', { name: `${phone ? 'QR for' : 'QR code for'} Role ${i + 1}` });
    await fireEvent.click(row(3));
    const check = (i: number) => {
      const d = v.container.querySelector('dialog[open]')!;
      expect(d.querySelector('h2')?.textContent).toBe(`Role ${i + 1}`);
      expect(d.querySelectorAll('.qr')).toHaveLength(1);
      expect(d.querySelector('.survey-qr-link')?.textContent).toBe(surveys[i].code);
      expect([...d.querySelectorAll('.qr i')].map(x => x.classList.contains('o') ? '0' : '1').join('')).toBe(qrModules(surveys[i].code).cells);
      return d;
    };
    let d = check(3);
    for (let i = 2; i >= 0; i--) { await fireEvent.keyDown(window, { key: 'ArrowLeft' }); d = check(i); }
    expect((v.getByRole('button', { name: 'Previous survey' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.keyDown(window, { key: 'ArrowLeft' }); check(0);
    for (let i = 1; i < 7; i++) { await fireEvent.click(v.getByRole('button', { name: 'Next survey' })); d = check(i); }
    expect((v.getByRole('button', { name: 'Next survey' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.keyDown(window, { key: 'ArrowRight' }); check(6);
    await fireEvent.click(v.getByRole('button', { name: 'Close QR code' }));
    expect(v.container.querySelector('dialog[open]')).toBeNull();
    await fireEvent.click(row(1)); check(1);
    expect(v.getByRole('link', { name: 'Show all QR codes to the room' }).getAttribute('href')).toContain('screen=qr-room');
  });
  it('renders no QR or fabricated link for a genuinely missing survey link', async () => {
    browserDialog();
    const v = render(Share, { props: { data: { ...data, surveys: [{ ...surveys[0], code: '' }] }, phone } });
    await fireEvent.click(v.getByRole('button', { name: `${phone ? 'QR for' : 'QR code for'} Role 1` }));
    expect(v.container.querySelector('dialog .qr')).toBeNull();
    expect(v.container.querySelector('dialog[open] [role=status]')?.textContent).toContain('link is unavailable');
  });
});

it('mobile all-code mode preserves phone navigation and renders every code; normal room phone mode remains a pager', () => {
  window.history.replaceState({}, '', '?w=phone');
  const all = render(QRRoom, { props: { phone: true, state: 'all', data: collect } });
  expect(all.container.querySelectorAll('.qr')).toHaveLength(collect.groups.flatMap(g => g.surveys).length);
  expect(all.getByRole('link', { name: 'Back to Collect' }).getAttribute('href')).toContain('w=phone');
  all.unmount();
  const single = render(QRRoom, { props: { phone: true, state: '3', data: collect } });
  expect(single.container.querySelectorAll('.qr')).toHaveLength(1);
});

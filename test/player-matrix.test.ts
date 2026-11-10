import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { CASES } from '../ui-player-matrix/cases.js';
import { renderCase } from '../ui-player-matrix/render.js';
import { observe } from '../ui-player-matrix/observe.js';
import { OVERVIEW } from '../ui-next/src/overview-video.js';

describe('controlled player comparison', () => {
  it('has two controls and exactly five cumulative steps in each direction', () => {
    expect(CASES.map(c => c.id)).toEqual(['a0','a1','a2','a3','a4','a5','r0','r1','r2','r3','r4','r5']);
    expect(CASES.filter(c => c.kind === 'native').map(c => c.id)).toEqual(['a0','a1','a2','a3']);
    expect(CASES.find(c => c.id === 'a4').note).toContain('construction and initialization together');
    const a = CASES.find(c => c.id === 'a5'), r = CASES.find(c => c.id === 'r0');
    for (const key of ['kind','poster','captions','card']) expect(a[key]).toBe(r[key]);
    expect(CASES.slice(0, 4).map(c => [c.poster,c.captions,c.card])).toEqual([[false,false,false],[true,false,false],[true,true,false],[true,true,true]]);
    expect(CASES.slice(6, 10).map(c => [c.poster,c.captions,c.card])).toEqual([[true,true,true],[true,false,true],[false,false,true],[false,false,false]]);
  });
  for (const configuration of CASES) it(`${configuration.id}: one isolated case, fixed source and a fresh document per choice`, () => {
    const dom = new JSDOM(renderCase(configuration));
    const doc = dom.window.document;
    expect(doc.body.dataset.case).toBe(configuration.id);
    const videos = [...doc.querySelectorAll('video')];
    expect(videos).toHaveLength(configuration.kind === 'native' ? 1 : 0);
    for (const v of videos) {
      expect(v.getAttribute('src')).toBe(OVERVIEW.src);
      expect(v.controls).toBe(true); expect(v.hasAttribute('playsinline')).toBe(true);
      expect(v.preload).toBe('metadata'); expect(v.autoplay).toBe(false);
      expect(v.getAttribute('poster')).toBe(configuration.poster ? OVERVIEW.poster : null);
      expect(v.querySelector('track')?.getAttribute('src') ?? null).toBe(configuration.captions ? OVERVIEW.captions : null);
      expect(v.querySelector('track[default]')).toBeNull(); expect(v.hasAttribute('crossorigin')).toBe(false);
    }
    const choices = [...doc.querySelectorAll('nav a')];
    expect(choices.map(a => a.getAttribute('href'))).toEqual(CASES.map(c => `./${c.id}.html`));
    expect(doc.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(doc.querySelector('iframe')).toBeNull();
    expect([...doc.querySelectorAll('script')].map(s => s.getAttribute('src'))).toEqual([configuration.kind === 'native' ? './native-entry.js' : './entry.js']);
    expect(doc.querySelector('#player')?.classList.contains('app')).toBe(configuration.card);
    dom.window.close();
  });
  it('contains the product shell shadow without changing the media card styling', () => {
    const html = renderCase(CASES.find(c => c.id === 'r0'));
    const dom = new JSDOM(html);
    const inherited = dom.window.document.createElement('style');
    inherited.textContent = '.app { box-shadow: 0 0 0 100vmax rgb(11, 21, 32); }';
    dom.window.document.head.prepend(inherited);
    const host = dom.window.document.getElementById('player')!;
    expect(dom.window.getComputedStyle(host).boxShadow).toBe('none');
    expect(dom.window.document.querySelector('nav')).not.toBeNull();
    expect(dom.window.document.querySelector('h1')).not.toBeNull();
    expect(html).toContain('id="player" class="app" data-theme="dark"');
    expect(html).not.toMatch(/\.l-media[^<]*box-shadow:none/);
    dom.window.close();
  });
  it('rejects arbitrary case objects rather than interpolating user content', () => {
    expect(() => renderCase({ id: '<script>', title: 'bad' })).toThrow('Unknown player case');
  });
  it('only observes bounded native state and detaches cleanly', () => {
    const dom = new JSDOM('<video></video><output></output>');
    const video = dom.window.document.querySelector('video')!, output = dom.window.document.querySelector('output')!;
    const play = vi.spyOn(video,'play'), load = vi.spyOn(video,'load'), pause = vi.spyOn(video,'pause');
    Object.defineProperty(video,'error',{ value: { code: 4, message: 'private URL secret' } });
    Object.defineProperty(video,'networkState',{ value: 3 });
    const stop = observe(video, output);
    video.dispatchEvent(new dom.window.Event('error'));
    expect(output.textContent).toContain('media error 4'); expect(output.textContent).toContain('network 3');
    expect(output.textContent).not.toContain('private URL');
    expect(play).not.toHaveBeenCalled(); expect(load).not.toHaveBeenCalled(); expect(pause).not.toHaveBeenCalled();
    stop(); output.textContent = 'stopped'; video.dispatchEvent(new dom.window.Event('timeupdate'));
    expect(output.textContent).toBe('stopped'); dom.window.close();
  });
  it('keeps diagnostics outside the product entry and ordinary error copy', () => {
    const read = (path: string) => readFileSync(new URL('../'+path,import.meta.url),'utf8');
    expect(read('ui-next/src/main.js')).not.toMatch(/player-matrix|player-diagnostic/);
    expect(read('ui-next/src/MediaCard.svelte')).not.toMatch(/media error|network \$\{|ready \$\{|function diagnostic/);
    for (const path of ['ui-player-matrix/entry.js','ui-player-matrix/native-entry.js','ui-player-matrix/observe.js']) expect(read(path)).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/);
  });
});

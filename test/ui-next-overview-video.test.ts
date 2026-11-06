// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,fireEvent,cleanup} from '@testing-library/svelte';
import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import Landing from '../ui-next/src/screens/Landing.svelte';
import {OVERVIEW} from '../ui-next/src/overview-video.js';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
for(const phone of [false,true])it(`approved overview player, captions and failure recovery (${phone?'phone':'desktop'})`,async()=>{
 const load=vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});
 const play=vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
 const v=render(Landing,{props:{phone,home:'#/projects'}});const media=v.getByLabelText('What 3D Review is · 2:00',{selector:'video'}) as HTMLVideoElement;
 expect(media.src).toBe(OVERVIEW.src);expect(media.poster).toBe(OVERVIEW.poster);expect(media.controls).toBe(true);expect(media.autoplay).toBe(false);expect(media.preload).toBe('none');expect(media.hasAttribute('playsinline')).toBe(true);expect(media.hasAttribute('crossorigin')).toBe(false);
 const track=media.querySelector('track')!;expect(track.getAttribute('src')).toBe('/media/overview.en.vtt');expect(track.hasAttribute('default')).toBe(false);expect(track.getAttribute('srclang')).toBe('en');
 const before=location.href;await fireEvent.click(v.getByRole('button',{name:'Watch how it works · 2:00'}));expect(play).toHaveBeenCalledTimes(1);expect(location.href).toBe(before);expect(document.activeElement).toBe(media);
 await fireEvent.error(media);expect(v.getByRole('status').textContent).toContain('could not play');expect(v.getByRole('link',{name:'Open the video directly'}).getAttribute('href')).toBe(OVERVIEW.src);
 await fireEvent.click(v.getByRole('button',{name:'Watch how it works · 2:00'}));expect(load).toHaveBeenCalledTimes(1);
 await fireEvent.playing(media);expect(v.queryByRole('status')).toBeNull();expect(v.getByRole('link',{name:'Open video separately'}).getAttribute('href')).toBe(OVERVIEW.src);
});
it('same-origin English captions exactly match approved CDN handoff bytes',()=>{
 const captions=readFileSync(resolve(__dirname,'../ui/media/overview.en.vtt'));expect(createHash('sha256').update(captions).digest('hex')).toBe('cb6a2952a991c33a7fbff0d267a8db56fd2181e807345eff82bf55355f7a7e39');expect(captions.toString()).toMatch(/^WEBVTT/);
});

// @vitest-environment jsdom
import {it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,fireEvent,cleanup} from '@testing-library/svelte';
import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import Landing from '../ui-next/src/screens/Landing.svelte';
import {OVERVIEW} from '../ui-next/src/overview-video.js';
beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}); });
afterEach(()=>{cleanup();vi.restoreAllMocks();});
for(const phone of [false,true])it(`approved overview without the iPhone-failing optional track and with failure recovery (${phone?'phone':'desktop'})`,async()=>{
 const load=vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});
 const play=vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
 const v=render(Landing,{props:{phone,home:'#/projects'}});const media=v.getByLabelText('What 3D Review is · 2:00',{selector:'video'}) as HTMLVideoElement;
 expect(media.getAttribute('src')).toBe(OVERVIEW.src);expect(media.querySelector('source')).toBeNull();expect(media.poster).toBe(OVERVIEW.poster);expect(media.controls).toBe(true);expect(media.autoplay).toBe(false);expect(media.preload).toBe('metadata');expect(media.hasAttribute('playsinline')).toBe(true);expect(media.hasAttribute('crossorigin')).toBe(false);
 Object.defineProperty(media,'networkState',{configurable:true,value:HTMLMediaElement.NETWORK_IDLE});
 expect(media.querySelector('track')).toBeNull();expect(v.queryByText('English text captions are available in the player.')).toBeNull();
 const before=location.href;await fireEvent.click(v.getByRole('button',{name:'Watch how it works · 2:00'}));expect(play).toHaveBeenCalledTimes(1);expect(location.href).toBe(before);expect(document.activeElement).toBe(media);
 await fireEvent.error(media);expect(v.getByRole('status').textContent).toContain('could not play');expect(v.getByRole('link',{name:'open the video directly'}).getAttribute('href')).toBe(OVERVIEW.directSrc);
 await fireEvent.click(v.getByRole('button',{name:'Watch how it works · 2:00'}));expect(load).toHaveBeenCalledTimes(2);
 await fireEvent.playing(media);expect(v.queryByRole('status')).toBeNull();expect(v.getByRole('link',{name:'Open video separately'}).getAttribute('href')).toBe(OVERVIEW.directSrc);
});
it('retained diagnostic English captions exactly match approved CDN handoff bytes',()=>{
 const captions=readFileSync(resolve(__dirname,'../ui/overview/3d-review-overview.en.vtt'));expect(createHash('sha256').update(captions).digest('hex')).toBe('cb6a2952a991c33a7fbff0d267a8db56fd2181e807345eff82bf55355f7a7e39');expect(captions.toString()).toMatch(/^WEBVTT/);
});

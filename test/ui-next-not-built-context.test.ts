// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {render} from '@testing-library/svelte';
import NotBuilt from '../ui-next/src/app/NotBuilt.svelte';
import {reportAvailability} from '../ui-next/src/app/report-availability.js';
it.each([false,true])('explains synthetic collected data versus no saved report at phone=%s without offering a write',phone=>{const context=reportAvailability({review:{title:'Synthetic review',project:'Synthetic project',liveResponses:19},canBuild:false});const view=render(NotBuilt,{props:{phone,chrome:{},context,back:'#/collect',backLabel:'Back to Collect'}});expect(view.getByRole('status').textContent).toContain('19 collected responses');expect(view.container.textContent).toContain('Synthetic project · Synthetic review');expect(view.queryByRole('button',{name:/build/i})).toBeNull();expect(view.getByRole('link',{name:'Back to Collect'}).getAttribute('href')).toBe('#/collect');});

it.each([false,true])('keeps changing preview/build outcomes in a live status region with availability context (phone=%s)',async phone=>{
 const context=reportAvailability({review:{title:'Synthetic review',project:'Synthetic project',liveResponses:19},canBuild:true});const props={phone,chrome:{},context,message:'Preparing the preview…'};const view=render(NotBuilt,{props});const outcome=view.getAllByRole('status').find(node=>node.textContent==='Preparing the preview…')!;expect(outcome).toBeTruthy();expect(outcome.getAttribute('aria-live')).toBe('polite');expect(outcome.getAttribute('aria-atomic')).toBe('true');
 for(const message of ['Preview ready. Review it before building.','The build could not be confirmed. Reload before another build.']){await view.rerender({...props,message});expect(outcome.textContent).toBe(message);expect(view.getAllByRole('status')).toContain(outcome);expect(view.container.textContent).toContain('19 collected responses');}
});

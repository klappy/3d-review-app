// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import ActionPlan from '../ui-next/src/screens/actions/ActionPlan.svelte';
import NextStep from '../ui-next/src/screens/actions/NextStep.svelte';
import Live from '../ui-next/src/app/Live.svelte';
import * as S from '../ui-next/src/app/session.js';
import * as D from '../ui-next/src/app/data.js';
import { setLiveContext } from '../ui-next/src/screens/href.js';
import { setLiveChrome } from '../ui-next/src/app/chrome.js';
import { REPORT } from '../ui-next/src/screens/results/data.js';
import R from '../ui-next/fixtures/actions/review.json';

const urls = [
 'https://review.example/next/#/review/alpha/action-plan?report=report-a',
 'https://review.example/next/#/review/beta%2Fspecial/action-plan?report=report-b',
];
const model = (id: string, url: string) => ({
 ...D.nextStepModel({ aid:id, reportId:`report-${id}`, serverStage:'understand', review:{...REPORT.desktop.review,title:`Review ${id}`}, counts:REPORT.desktop.counts, payload:REPORT.desktop.payload, notes:{notes_reflection:`Reflection ${id}`,notes_next_steps:`Plan ${id}\n\n[Follow up on] 2026-11-28\n[Review again] After the next draft`} }),
 share:{url,authenticated:true},
});
const pathOf = ({n,cells}: {n:number,cells:string}) => [...cells].map((c,i)=>c==='1'?`M${i%n} ${Math.floor(i/n)}h1v1h-1z`:'').join('');
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();S.forget();setLiveContext(null);setLiveChrome(null);location.hash='';});

it.each(urls)('live plan QR encodes its exact authenticated URL: %s',url=>{
 const plan=model(url===urls[0]?'alpha':'beta',url),v=render(ActionPlan,{data:plan});
 const qr=v.container.querySelector('.plan-share svg.qr')!;
 const encoded=D.qrModules(url);
 expect(qr.getAttribute('data-size')).toBe('plan');
 expect(qr.getAttribute('data-n')).toBe(String(encoded.n));
 expect(qr.getAttribute('viewBox')).toBe(`0 0 ${encoded.n} ${encoded.n}`);
 expect(qr.querySelector('path')?.getAttribute('d')).toBe(pathOf(encoded));
 expect(qr.querySelector('path')?.getAttribute('d')).not.toBe(pathOf({n:21,cells:R.qr.plan}));
 expect(v.container.querySelector('.plan-share .mono')?.textContent).toBe(url);
});

it.each([
 ['https://3dreview.app/next/#/review/assess_00000000-0000-4000-8000-000000000001/action-plan?report=a',41],
 ['https://3d-review-dev.klappy.workers.dev/next/#/review/assess_00000000-0000-4000-8000-000000000002/action-plan?report=report_00000000-0000-4000-8000-000000000002',53],
])('dense live plan retains the plan quiet-zone sizing preset (%s)',(url,n)=>{
 const v=render(ActionPlan,{data:model('dense',String(url))});
 const qr=v.container.querySelector('.plan-share svg.qr')!;
 expect(qr.getAttribute('data-n')).toBe(String(n));
 expect(qr.getAttribute('width')).toBe('72');
 expect(qr.getAttribute('height')).toBe('72');
 expect(qr.getAttribute('data-size')).toBe('plan');
 expect(qr.querySelector('path')?.getAttribute('d')).toBe(pathOf(D.qrModules(String(url))));
});

it.each([false,true])('live plan copy and print are truthful about sign-in and current review access (phone=%s)',phone=>{
 const v=render(ActionPlan,{phone,data:model('alpha',urls[0])});
 expect(v.container.textContent).toContain('sign in');
 expect(v.container.textContent).toContain('access to this review');
 expect(v.container.textContent).not.toMatch(/no account|without signing in|expires in 90 days/);
 expect(v.container.textContent).toContain('[Follow up on] 2026-11-28');
 expect(v.container.textContent).toContain('[Review again] After the next draft');
});

it('NextStep live guidance never promises an anonymous plan route',()=>{
 const v=render(NextStep,{data:model('alpha',urls[0])});
 expect(v.getByText(/Opening it requires sign-in/)).toBeTruthy();
 expect(v.container.textContent).not.toContain("people who won't sign in");
});

it('changing live review updates its QR, printed URL, title, notes and copied link together',async()=>{
 const writeText=vi.fn().mockResolvedValue(undefined);
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
 const v=render(ActionPlan,{data:model('alpha',urls[0])});
 const first=v.container.querySelector('.plan-share svg.qr path')?.getAttribute('d');
 await v.rerender({data:model('beta',urls[1])});
 expect(v.container.querySelector('.paper-title')?.textContent).toBe('Review beta');
 expect(v.container.textContent).toContain('Reflection beta');
 expect(v.container.textContent).not.toContain('Reflection alpha');
 expect(v.container.querySelector('.plan-share .mono')?.textContent).toBe(urls[1]);
 expect(v.container.querySelector('.plan-share svg.qr path')?.getAttribute('d')).not.toBe(first);
 await fireEvent.click(v.getByRole('button',{name:'Copy share link'}));
 expect(writeText).toHaveBeenCalledWith(urls[1]);
});

it('a live plan without share data does not draw a fixture QR or invent public access',()=>{
 const v=render(ActionPlan,{data:{...model('alpha',urls[0]),share:null}});
 expect(v.container.querySelector('.plan-share svg.qr')).toBeNull();
 expect(v.container.textContent).not.toMatch(/no account|expires in 90 days/);
});

it('an unsigned recipient of an actual plan route reaches sign-in without reading report data',async()=>{
 vi.spyOn(S,'me').mockResolvedValue(null);
 vi.spyOn(S,'emailLinksOn').mockResolvedValue(false);
 const results=vi.spyOn(D,'resultsModel');
 location.hash='#/review/alpha/action-plan?report=report-a';
 const v=render(Live);
 await waitFor(()=>expect(v.getByRole('heading',{name:'Sign in to 3D Review'})).toBeTruthy());
 expect(results).not.toHaveBeenCalled();
 expect(v.container.textContent).not.toContain('Reflection alpha');
});

it('the fixture gallery keeps its declared 21-module QR',()=>{
 const v=render(ActionPlan);
 const qr=v.container.querySelector('.plan-share svg.qr')!;
 expect(qr.getAttribute('viewBox')).toBe('0 0 21 21');
 expect(qr.querySelector('path')?.getAttribute('d')).toBe(pathOf({n:21,cells:R.qr.plan}));
});

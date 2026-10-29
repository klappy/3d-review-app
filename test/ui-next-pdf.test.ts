// @vitest-environment jsdom
import {it,expect,vi,beforeEach} from 'vitest';
import {render,fireEvent,screen,waitFor} from '@testing-library/svelte';
import PdfActions from '../ui-next/src/screens/actions/PdfActions.svelte';
beforeEach(()=>{vi.stubGlobal('URL',class extends URL {static createObjectURL=vi.fn(()=> 'blob:local-pdf');static revokeObjectURL=vi.fn();});});
it('prepares a binary file, then exposes save/open on fresh user gestures without navigating the app',async()=>{
  const fetchImpl=vi.fn(async()=>new Response('%PDF-1.7\nfixture',{headers:{'content-type':'application/pdf','content-disposition':'attachment; filename="survey.pdf"'}}));
  const view=render(PdfActions,{url:'/v2/survey.pdf',fetchImpl});
  await fireEvent.click(screen.getByRole('button',{name:'Download PDF'}));
  await waitFor(()=>expect(screen.getByRole('link',{name:'Save PDF'}).getAttribute('download')).toBe('survey.pdf'));
  expect(screen.getByRole('link',{name:'Open PDF'}).getAttribute('target')).toBe('_blank');
  expect(fetchImpl).toHaveBeenCalledTimes(1);expect(screen.getByRole('status').textContent).toContain('PDF ready');
  view.unmount();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-pdf');
});
it('shows useful retry and keeps Print as the supplied fallback',async()=>{
  const fetchImpl=vi.fn(async()=>new Response(JSON.stringify({error:{message:'PDF unavailable. Use Print.'}}),{status:503,headers:{'content-type':'application/json'}}));
  render(PdfActions,{url:'/v2/survey.pdf',fetchImpl});await fireEvent.click(screen.getByRole('button',{name:'Download PDF'}));
  await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('PDF unavailable. Use Print.'));expect(screen.queryByRole('link',{name:'Save PDF'})).toBeNull();
});
it('cancel interrupts the request and allows another preparation',async()=>{
  let aborted=false;
  const fetchImpl=vi.fn(async(_:unknown,init:any)=>new Promise<Response>((_,reject)=>{init.signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Aborted','AbortError'));});}));
  render(PdfActions,{url:'/v2/survey.pdf',fetchImpl});await fireEvent.click(screen.getByRole('button',{name:'Download PDF'}));
  await fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(aborted).toBe(true);expect((screen.getByRole('button',{name:'Download PDF'}) as HTMLButtonElement).disabled).toBe(false);
});
it('discards a prepared file when its report URL or session changes',async()=>{
  const fetchImpl=vi.fn(async()=>new Response('%PDF-1.7\nfixture',{headers:{'content-type':'application/pdf'}}));
  const view=render(PdfActions,{url:'/v2/reports/first/pdf',token:'first',fetchImpl});
  await fireEvent.click(screen.getByRole('button',{name:'Download PDF'}));await waitFor(()=>expect(screen.queryByRole('link',{name:'Save PDF'})).not.toBeNull());
  await view.rerender({url:'/v2/reports/second/pdf',token:'second',fetchImpl});
  expect(screen.queryByRole('link',{name:'Save PDF'})).toBeNull();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-pdf');expect(screen.getByRole('status').textContent).toBe('');
});

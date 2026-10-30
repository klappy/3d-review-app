import {describe,it,expect,vi} from 'vitest';
import {pdfBytes,pdfResponse,PDF_LIMITS} from '../src/pdf-render';
const bytes=new TextEncoder().encode('%PDF-1.7\nfixture');
const browser=(response:()=>Response|Promise<Response>)=>({quickAction:vi.fn(async()=>response())});
describe('bounded PDF rendering',()=>{
  it('uses HTML only, blocks network, returns binary PDF with attachment/no-store headers',async()=>{
    const b=browser(()=>new Response(bytes,{headers:{'content-type':'application/pdf'}}));
    expect(await pdfBytes('<p>local</p>','a4',{PDF_BROWSER:b})).toEqual(bytes);
    expect(b.quickAction).toHaveBeenCalledWith('pdf',expect.objectContaining({html:'<p>local</p>',rejectRequestPattern:expect.arrayContaining(['/^https?:/']),pdfOptions:{format:'a4',preferCSSPageSize:true,printBackground:true,timeout:25_000}}));
    const r=pdfResponse(bytes,'x"\r\n/evil.pdf');expect(r.headers.get('content-type')).toBe('application/pdf');expect(r.headers.get('cache-control')).toBe('private, no-store');expect(r.headers.get('content-disposition')).toBe('attachment; filename="x----evil.pdf"');
  });
  it('refuses unavailable rendering, oversized HTML, non-PDF content and invalid PDF signatures',async()=>{
    await expect(pdfBytes('x','letter',{})).rejects.toMatchObject({code:'PDF_UNAVAILABLE'});
    const b=browser(()=>new Response(bytes,{headers:{'content-type':'application/pdf'}}));
    await expect(pdfBytes('x'.repeat(PDF_LIMITS.htmlBytes+1),'letter',{PDF_BROWSER:b})).rejects.toMatchObject({code:'PDF_TOO_LARGE'});expect(b.quickAction).not.toHaveBeenCalled();
    for(const response of [new Response('oops'),new Response('<html>',{headers:{'content-type':'application/pdf'}}),new Response(bytes,{status:503,headers:{'content-type':'application/pdf'}})])await expect(pdfBytes('x','letter',{PDF_BROWSER:browser(()=>response)})).rejects.toMatchObject({code:'PDF_FAILED'});
  });
  it('enforces output bounds while streaming',async()=>{
    const b=browser(()=>new Response(new Uint8Array(PDF_LIMITS.pdfBytes+1),{headers:{'content-type':'application/pdf'}}));await expect(pdfBytes('x','letter',{PDF_BROWSER:b})).rejects.toMatchObject({code:'PDF_TOO_LARGE'});
  });
  it('times out and handles cancellation without a PDF response',async()=>{
    const b=browser(()=>new Promise<Response>(()=>{}));
    await expect(pdfBytes('x','letter',{PDF_BROWSER:b},undefined,5)).rejects.toMatchObject({code:'PDF_TIMEOUT'});
    const c=new AbortController(),p=pdfBytes('x','letter',{PDF_BROWSER:b},c.signal);c.abort();await expect(p).rejects.toMatchObject({code:'PDF_INTERRUPTED'});
    await expect(pdfBytes('x','letter',{PDF_BROWSER:b},c.signal)).rejects.toMatchObject({code:'PDF_INTERRUPTED'});
  });
  it('cancels an active response reader on abort and a late response after timeout',async()=>{
    const cancelled=vi.fn(),stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(bytes);},cancel:cancelled});
    const c=new AbortController(),p=pdfBytes('x','letter',{PDF_BROWSER:browser(()=>new Response(stream,{headers:{'content-type':'application/pdf'}}))},c.signal);
    await new Promise(resolve=>setTimeout(resolve,0));c.abort();await expect(p).rejects.toMatchObject({code:'PDF_INTERRUPTED'});expect(cancelled).toHaveBeenCalledTimes(1);
    let finish!:(r:Response)=>void;const late=vi.fn();
    const pending=pdfBytes('x','letter',{PDF_BROWSER:browser(()=>new Promise<Response>(resolve=>{finish=resolve;}))},undefined,2);
    await expect(pending).rejects.toMatchObject({code:'PDF_TIMEOUT'});
    finish(new Response(new ReadableStream({cancel:late}),{headers:{'content-type':'application/pdf'}}));
    await new Promise(resolve=>setTimeout(resolve,0));expect(late).toHaveBeenCalledTimes(1);
  });
});

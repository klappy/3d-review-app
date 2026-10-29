/** On-demand rendering only. No URLs, cookies, credentials, storage or arbitrary client HTML enter the browser. */
export interface PdfBrowser { quickAction(action: 'pdf', options: Record<string, unknown>): Promise<Response> }
export interface PdfEnv { PDF_BROWSER?: PdfBrowser }
export class PdfError extends Error {
  constructor(public code: string, message: string, public status = 503) { super(message); }
}
export const PDF_LIMITS = { htmlBytes: 2_000_000, pdfBytes: 12_000_000, timeoutMs: 30_000 } as const;
export async function pdfBytes(html: string, paper: 'letter'|'a4', env: PdfEnv, signal?: AbortSignal, timeoutMs: number = PDF_LIMITS.timeoutMs): Promise<Uint8Array> {
  if (!env.PDF_BROWSER) throw new PdfError('PDF_UNAVAILABLE','PDF download is not available yet. You can still print this document.');
  if (new TextEncoder().encode(html).length > PDF_LIMITS.htmlBytes) throw new PdfError('PDF_TOO_LARGE','This document is too large for PDF download.',413);
  if (signal?.aborted) throw new PdfError('PDF_INTERRUPTED','PDF download interrupted. Try again.',499);
  let timer: ReturnType<typeof setTimeout>;
  let abort: () => void = () => {};
  const stopped = new Promise<never>((_,reject) => {
    timer = setTimeout(() => reject(new PdfError('PDF_TIMEOUT','PDF generation took too long. Try again or use Print.',504)),timeoutMs);
    abort = () => reject(new PdfError('PDF_INTERRUPTED','PDF download interrupted. Try again.',499));
    signal?.addEventListener('abort',abort,{once:true});
  });
  const render = async () => {
    const response = await env.PDF_BROWSER!.quickAction('pdf',{
      html, rejectRequestPattern:['/^https?:/','/^file:/','/^ftp:/','/^wss?:/'],
      pdfOptions:{format:paper==='a4'?'a4':'letter',preferCSSPageSize:true,printBackground:true,waitForFonts:true,timeout:25_000},
      gotoOptions:{waitUntil:'load',timeout:25_000},
    });
    if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('application/pdf')) {
      await response.body?.cancel(); throw new PdfError('PDF_FAILED','PDF generation failed. Try again or use Print.');
    }
    if (Number(response.headers.get('content-length')) > PDF_LIMITS.pdfBytes) { await response.body?.cancel(); throw new PdfError('PDF_TOO_LARGE','The generated PDF is too large.',413); }
    const reader = response.body?.getReader();
    if (!reader) throw new PdfError('PDF_FAILED','PDF generation returned no file. Try again.');
    const chunks:Uint8Array[]=[]; let size=0;
    try {
      for (;;) { const {done,value}=await reader.read(); if(done)break; size+=value.length; if(size>PDF_LIMITS.pdfBytes)throw new PdfError('PDF_TOO_LARGE','The generated PDF is too large.',413); chunks.push(value); }
    } catch(e) { await reader.cancel().catch(()=>{}); throw e; }
    const bytes = new Uint8Array(size); let at=0; for(const c of chunks){bytes.set(c,at);at+=c.length;}
    if (new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') throw new PdfError('PDF_FAILED','PDF generation returned an invalid file. Try again.');
    return bytes;
  };
  try { return await Promise.race([render(),stopped]); }
  catch(e) { if(e instanceof PdfError)throw e; throw new PdfError('PDF_FAILED','PDF generation failed. Try again or use Print.'); }
  finally { clearTimeout(timer!); signal?.removeEventListener('abort',abort); }
}
export function pdfResponse(bytes:Uint8Array, filename:string):Response {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,120).replace(/\.pdf$/i,'')+'.pdf';
  return new Response(bytes,{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="${safe}"`,'cache-control':'private, no-store','x-content-type-options':'nosniff','content-length':String(bytes.length)}});
}

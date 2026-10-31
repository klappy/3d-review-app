// Binary download primitive shared by survey/report controls. The UI supplies its existing authorized PDF endpoint.
// Prepare asynchronously, then offer Save/Open/Share on a fresh click: iOS requires user activation for file sharing.
export const surveyPdfUrl=(aid,sid,{lang='en',paper='letter'}={})=>`/v2/assessments/${encodeURIComponent(aid)}/surveys/${encodeURIComponent(sid)}/print.pdf?lang=${encodeURIComponent(lang)}&paper=${String(paper).toLowerCase()==='a4'?'a4':'letter'}`;
export function reportPdfUrl(id,{format='full',paper}={}) {return reportPdfFormatUrl(`/v2/reports/${encodeURIComponent(id)}/pdf`,format,{paper});}
export function reportPdfFormatUrl(url,format,{paper}={}) {
 if(!['full','overview','detailed'].includes(format))throw new Error('Unknown report PDF format.');
 const [path,query='']=String(url).split('?');if(!/^\/v2\/reports\/[^/?#]+\/pdf$/.test(path)||String(url).includes('#'))throw new Error('Invalid report PDF URL.');
 const params=new URLSearchParams(query);if(format==='full')params.delete('format');else params.set('format',format);
 if(paper!==undefined){if(!['letter','a4'].includes(paper))throw new Error('Unknown paper size.');params.set('paper',paper);}
 return path+(params.size?'?'+params:'');
}
export function reportPdfFormat(url){const [path,query='']=String(url||'').split('?');return /^\/v2\/reports\/[^/?#]+\/pdf$/.test(path)?new URLSearchParams(query).get('format')||'full':null;}

export async function fetchPdf(url, {fetchImpl=globalThis.fetch,token,signal}={}) {
  const response=await fetchImpl(url,{credentials:'same-origin',cache:'no-store',signal,headers:{accept:'application/pdf',...(token?{authorization:`Bearer ${token}`}:{})}});
  if(!response.ok) {
    let message='PDF download failed. Retry or use Print.';
    try { const data=await response.json(); if(typeof data?.error?.message==='string')message=data.error.message; } catch {}
    throw new Error(message);
  }
  if(!response.headers.get('content-type')?.toLowerCase().startsWith('application/pdf'))throw new Error('The server did not return a PDF. Retry or use Print.');
  const blob=await response.blob();
  if(new TextDecoder().decode(await blob.slice(0,5).arrayBuffer())!=='%PDF-')throw new Error('The PDF file is invalid. Retry or use Print.');
  const name=/filename="([a-zA-Z0-9._-]+\.pdf)"/i.exec(response.headers.get('content-disposition')||'')?.[1]||'3d-review.pdf';
  return {blob,name};
}
export function pdfFile(pdf,FileImpl=globalThis.File) {return new FileImpl([pdf.blob],pdf.name,{type:'application/pdf'});}
export function canSharePdf(pdf,nav=globalThis.navigator) {try{return !!nav?.share&&!!nav.canShare?.({files:[pdfFile(pdf)]});}catch{return false;}}
export async function sharePdf(pdf,nav=globalThis.navigator) {
  if(!canSharePdf(pdf,nav))throw new Error('File sharing is unavailable. Use Save or Open.');
  try {await nav.share({files:[pdfFile(pdf)]});return true;} catch(e) {if(e?.name==='AbortError')return false;throw new Error('Sharing failed. Try Save or Open.');}
}
export function pdfObjectUrl(pdf,URLImpl=globalThis.URL) {
  const url=URLImpl.createObjectURL(pdf.blob);
  return {url,name:pdf.name,dispose:()=>URLImpl.revokeObjectURL(url)};
}
// One operation per control; repeated clicks reuse the active request. A cancelled request never replaces a newer file.
export function pdfLoader(load=fetchPdf) {
  let current=null,controller=null;
  return {load(url,options={}) {
    if(current)return current;
    controller=new AbortController();
    const p=load(url,{...options,signal:controller.signal});current=p;
    p.finally(()=>{if(current===p){current=null;controller=null;}}).catch(()=>{});
    return p;
  },cancel(){controller?.abort();controller=null;current=null;}};
}

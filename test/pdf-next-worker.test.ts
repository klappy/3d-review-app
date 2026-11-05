import {it,expect} from 'vitest';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFileSync} from 'node:fs';
it('renders the actual Next paper inside Workers runtime without Node compatibility',async()=>{
 const corpus=JSON.parse(readFileSync(new URL('./fixtures/synthetic-report-renderer-v1.json',import.meta.url),'utf8'));
 const stored={suppressed:false,report:{id:'worker-synthetic',created_at:'2026-10-31',payload:{...corpus.contexts['assess_syn_earning-trust-2026-01'],synthetic:true,source_commit:corpus.source_commit,versions:{scorer:'fixture'}}}};
 const compiled=await build({stdin:{contents:`import {storedReportDocument} from './ui/pdf/report-formats.js';export default {fetch(request){const format=new URL(request.url).pathname.slice(1);return new Response(storedReportDocument(${JSON.stringify(stored)},{format,minimum:1,identity:{title:'Synthetic worker QA'},paper:'a4'}),{headers:{'content-type':'text/html'}})}}`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'next-pdf-worker',modules:true,compatibilityDate:'2026-09-01',script:compiled.outputFiles[0].text}]}));
 try{for(const kind of ['overview','detailed']){const r=await mf.dispatchFetch('https://local.invalid/'+kind);expect(r.status).toBe(200);const html=await r.text();expect(html).toContain('class="paper"');expect(html).toContain('Synthetic worker QA');expect(html).not.toContain('Skip to main content');}}
 finally{await mf.dispose();}
},60000);

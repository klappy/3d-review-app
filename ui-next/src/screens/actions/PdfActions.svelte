<!-- Isolated binary-PDF control; shared Print/Results/Live integration remains with its file owner. -->
<script>
  import { onDestroy } from 'svelte';
  import Row from '../../Row.svelte';
  import Stack from '../../Stack.svelte';
  import { fetchPdf, pdfLoader, pdfObjectUrl, canSharePdf, sharePdf } from '../../../../ui/pdf/download.js';
  let { url, token = null, label = 'Download PDF', fetchImpl = globalThis.fetch } = $props();
  let busy = $state(false), status = $state(''), ready = $state(null), file = $state(null), shareable = $state(false);
  const loader = pdfLoader(fetchPdf);
  let generation = 0;
  const clear = () => {ready?.dispose();ready=null;file=null;shareable=false;};
  const cancel = () => {generation++;loader.cancel();busy=false;status='PDF preparation cancelled. You can retry or use Print.';};
  async function prepare() {
    if(busy)return;
    const run=++generation;clear();busy=true;status='Preparing PDF…';
    try {
      const pdf=await loader.load(url,{token,fetchImpl});if(run!==generation)return;
      file=pdf;ready=pdfObjectUrl(pdf);shareable=canSharePdf(pdf);status='PDF ready. Save it, open it, or share it.';
    } catch(e) {if(run===generation)status=e?.message||'PDF download failed. Retry or use Print.';}
    finally {if(run===generation)busy=false;}
  }
  async function share() {try {status=await sharePdf(file)?'PDF shared.':'Sharing cancelled. Your PDF is still ready.';}catch(e){status=e.message;}}
  onDestroy(()=>{generation++;loader.cancel();clear();});
</script>
<div aria-label="PDF download">
  <Stack gap={2}>
  <Row gap={2} wrap>
  <button class="btn btn-primary" type="button" disabled={busy || !url} onclick={prepare}>{busy ? 'Preparing PDF…' : ready ? 'Prepare again' : label}</button>
  {#if busy}<button class="btn" type="button" onclick={cancel}>Cancel</button>{/if}
  {#if ready}
    <a class="btn" href={ready.url} download={ready.name} target="_blank" rel="noopener">Save PDF</a>
    <a class="btn" href={ready.url} target="_blank" rel="noopener">Open PDF</a>
    {#if shareable}<button class="btn" type="button" onclick={share}>Share PDF</button>{/if}
  {/if}
  </Row>
  <p class="small" role="status" aria-live="polite">{status}</p>
  </Stack>
</div>

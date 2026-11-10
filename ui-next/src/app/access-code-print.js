const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
// The caller supplies only the currently revealed in-memory batch. No endpoint, storage, URL credential or reissue.
export function accessCodePrintDocument({ aid, survey, codes }) {
  if (!aid || !Array.isArray(codes) || !codes.length) throw new Error('Reveal an access-code batch before printing.');
  const back = `/next/#/review/${encodeURIComponent(aid)}/share`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access codes · ${escape(survey)}</title><style>body{font:14pt system-ui;margin:2rem}ol{columns:2;column-gap:3rem}li{break-inside:avoid;padding:.5rem;font-family:monospace}.tools{display:flex;flex-wrap:wrap;gap:1rem;margin-bottom:1rem}@media print{.tools{display:none}}</style></head><body><nav class="tools"><button type="button" onclick="print()">Print</button><button type="button" onclick="close()">Close print page</button><a href="${back}">Return to review</a></nav><h1>${escape(survey)}</h1><p>${codes.length} one-time access codes from the batch already revealed. Keep them with the intended participants.</p><ol>${codes.map(value => `<li data-code>${escape(value.code)}</li>`).join('')}</ol></body></html>`;
}

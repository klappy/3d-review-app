// UI Next (v4) live: printing for real. Status: provisional (playbook rule 12). No new print path: the documents and the
// sheets are the current UI's own, opened in their own tab from the click and printing themselves, so the app page never prints.
//  - QR pages (print-qr): ui/assess/print.js qrPrintDocumentHtml / openQrPrintDocument over ui/assess/share.js oneSheetHtml / printAllHtml.
//  - Paper surveys (print): each chosen survey's blank form read through the existing GET /v2/assessments/{aid}/surveys/{sid}/print
//    (ui/stage-screens.js loadBlankPrint: PRINT_ROLES, credential-field refusal), named as the current UI names it (ui/assess/print.js
//    printIdentityFrom, the passage line, the survey's real link and QR as paperLink), translated on request through the same
//    POST /v2/translate path (ui/assess/print-lang.js translatePrint), and drawn by the one paper renderer (ui/assess/print.js paperHtml)
//    into one self-contained document, a page per survey (ui/assess/print.js printDocumentHtml draws one paper; this joins several).
export { qrPrintDocumentHtml as qrPrintHtml, openQrPrintDocument as openQrPrint } from "../../../ui/assess/print.js";
import { paperHtml, PRINT_DOC_CSS, printIdentityFrom, paperLink } from "../../../ui/assess/print.js";
import { loadBlankPrint, printAllowed } from "../../../ui/stage-screens.js";
import { translatePrint, facilitatorFetch, printReadyLine } from "../../../ui/assess/print-lang.js";
import { LENSES } from "../../../ui/lens-surveys.js";
import { token } from "./api.js";

export { printReadyLine, printAllowed };
/** UI Next's status line once the print tab has opened (live QA N6): the same facts as the current UI's printReadyLine (question count,
 *  language, English fallbacks, machine translation) with a correct plural and no "Use Print below" (printing opens its own tab). */
export function printOpenedLine(model) {
  const n = model?.items?.length ?? 0, qs = `${n} ${n === 1 ? "question" : "questions"}`;
  if (!model?.lang) return `${qs} ready; the print tab has opened.`;
  const english = model.english ? ` ${model.english} of ${model.phrases} phrases have no translation yet and stay in English, marked EN on the paper.` : "";
  const machine = model.english === model.phrases ? "" : model.review ? " Machine translation, not yet checked by a speaker of this language." : " Machine translation.";
  if (model.english > 0) return `Translation incomplete for ${model.language}.${english}${machine} The print tab uses these English fallbacks; choose Print again to retry.`;
  return `${qs} ready in ${model.language}.${english}${machine} The print tab has opened.`;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PERSPECTIVE = { team: "Translation Team", community: "Community", church: "Church" };
const lensName = (lens) => (LENSES.includes(PERSPECTIVE[lens]) ? PERSPECTIVE[lens] : "Other perspective");

// The blank forms of the chosen surveys of a print page model (app/data.js printPageModel), in order; lang: an LWC code to print in
// (null / "en" prints the published English). Throws with the current UI's words when a form cannot be prepared; a refused role
// never reads. onProgress(text) says what is happening (the screen's status line).
export async function preparePapers(m, picked, { lang = null, onProgress = () => {}, fetchImpl = globalThis.fetch, tok = token() } = {}) {
  if (!printAllowed(m.role)) throw new Error("Your role here cannot print blank surveys (owner or member can).");
  const rows = m.surveys.filter((s) => picked.includes(s.id));
  if (!rows.length) throw new Error("Tick at least one survey to print.");
  const want = lang && lang !== "en" ? lang : null;
  const request = (url, init) => fetchImpl(url, init);
  const out = [];
  for (const s of rows) {
    onProgress(`Preparing ${s.name}…`);
    let model = await loadBlankPrint({ request, token: tok, aid: m.aid, sid: s.id, role: m.role, lang: want ?? undefined });
    if (!model.visible) throw new Error(model.reason === "unsafe-print" ? "The print payload was refused because it carried credentials." : `Blank questionnaire unavailable (${model.reason}).`);
    model.passageLine = m.passageLine || "";
    model.identity = printIdentityFrom({ id: m.aid, project_id: m.projectId, name: m.review.title, language_name: m.review.language }, { project: { name: m.project }, survey: { id: s.id, template_name: s.name }, perspective: lensName(s.lens) });
    model.link = paperLink(s.code ? { url: s.code } : null); // the survey's one real link, already issued for this tab; never minted here
    if (want) { onProgress(`Translating ${s.name}… The first time can take up to a minute.`); model = await translatePrint(model, { lang: want, fetchImpl: facilitatorFetch(tok, fetchImpl) }); }
    out.push(model);
  }
  return out;
}

// One document, one paper per page (the current UI's print CSS, page size from the picker); "" with nothing printable.
export function papersDocumentHtml(models, { paper = "letter", title = "", autoPrint = false, returnHref = "" } = {}) {
  const size = /a4/i.test(paper) ? "A4" : "letter";
  const bodies = models.map((m) => paperHtml(m, { paper: size === "A4" ? "a4" : "letter" })).filter(Boolean);
  if (!bodies.length) return "";
  const first = models.find((m) => m?.visible) ?? {};
  const body = bodies.map((b) => `<section class="paper-page">${b}</section>`).join("");
  return `<!doctype html><html lang="${esc(first.lang || "en")}"${first.dir === "rtl" ? ' dir="rtl"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title || first.title || "Paper surveys")}</title><style>${PRINT_DOC_CSS}
.paper-page{break-after:page}.paper-page:last-child{break-after:auto}
@page{size:${size}}</style></head><body><main><div class="doc-tools"><button type="button" onclick="print()">Print</button>${/^\/next\/#\/review\/[^/?#]+\/(?:collect|print|results)(?:[?#].*)?$/.test(returnHref) ? `<a href="${esc(returnHref)}">Return to review</a>` : ""}<span>${size === "A4" ? "A4" : "Letter"} · ${bodies.length} ${bodies.length === 1 ? "survey" : "surveys"} · nothing personal on the page</span></div>${body}</main>${autoPrint ? '<script>addEventListener("load",function(){setTimeout(function(){print()},300)})</script>' : ""}</body></html>`;
}

// Open the papers in their own tab and let them print themselves; false when the browser blocked the tab (the caller says so).
export function openPapersPrint(win, models, opts = {}) {
  const html = papersDocumentHtml(models, { ...opts, autoPrint: true });
  if (!html) return false;
  let w = null;
  try { w = win.open("", "_blank"); } catch { w = null; }
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}

// The on-screen preview (actions/Paper.svelte) of a prepared form: the paper's words in the fixture's shape (title, line, questions).
export function paperPreview(model, m) {
  const items = Array.isArray(model?.items) ? model.items : [];
  const questions = items.map((it, i) => {
    const type = it.type === "multi" ? "multi" : it.type === "text" ? "text" : "single";
    const options = it.type === "scale" && it.scale ? Array.from({ length: Math.max(0, it.scale.max - it.scale.min + 1) }, (_, k) => String(it.scale.min + k)) : (it.options ?? []).map((o) => o.text);
    return { n: i + 1, type, text: it.text, options, lines: it.type === "text" ? 3 : 0 };
  });
  return { title: model?.title || "Blank survey", line: `3D Review · ${m.review.title} · ${m.project}${m.review.language ? ` · ${m.review.language}` : ""}`, code: "", codeLine: m.passageLine || "Your answers are confidential", questions };
}

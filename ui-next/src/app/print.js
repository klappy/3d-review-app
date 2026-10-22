// UI Next (v4) live: printing QR pages for real. Status: provisional (playbook rule 12). No new print path: the document and the
// sheets are the current UI's own (ui/assess/print.js qrPrintDocumentHtml / openQrPrintDocument over ui/assess/share.js
// oneSheetHtml / printAllHtml), opened in their own tab from the click and printing themselves, so the app page never prints.
export { qrPrintDocumentHtml as qrPrintHtml, openQrPrintDocument as openQrPrint } from "../../../ui/assess/print.js";

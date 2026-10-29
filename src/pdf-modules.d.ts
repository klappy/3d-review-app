declare module '*ui/pdf/documents.js' {
  export function surveyPdfDocument(model: Record<string, any>, options?: {paper?:string}): string;
  export function reportPdfDocument(result: Record<string, any>, options?: {paper?:string}): string;
}
declare module '*ui/assess/print.js' {
  export function paperLink(link: {url:string}|null): unknown;
  export function printIdentityFrom(a: Record<string,any>, options?: Record<string,any>): unknown;
}
declare module '*ui/assess/print-lang.js' {
  export function translatePrint(model: Record<string,any>, options: {lang:string;fetchImpl:typeof fetch}): Promise<Record<string,any>>;
}
declare module '*ui/stage-screens.js' {
  export function printTitleFromHtml(html:string): string;
  export function printItemsFrom(result:Record<string,any>): unknown[];
}

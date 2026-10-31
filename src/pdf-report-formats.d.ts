declare module '*ui/pdf/report-formats.js' {
 export function storedReportDocument(stored:Record<string,any>,options:{paper:'letter'|'a4';format:'full'|'overview'|'detailed';identity?:Record<string,unknown>;minimum:number}):string;
}

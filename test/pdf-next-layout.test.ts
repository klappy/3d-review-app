import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {nextReportInputHashes} from '../ui/pdf/next-layout.generated.js';
import {reportPdfUrl,reportPdfFormatUrl} from '../ui/pdf/download.js';
it('compiled PDF layout pins the actual Next report component/style sources',()=>{
 for(const [path,hash] of Object.entries(nextReportInputHashes))expect(createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex'),path).toBe(hash);
 expect(Object.keys(nextReportInputHashes)).toContain('ui-next/src/screens/results/Report.svelte');expect(Object.keys(nextReportInputHashes)).toContain('ui-next/src/screens/results/ReportDetailed.svelte');expect(Object.keys(nextReportInputHashes)).toContain('ui-next/components/base.css');
});
it('format URLs keep the existing full default and reject unknown formats/external paths',()=>{
 expect(reportPdfUrl('a')).toBe('/v2/reports/a/pdf');expect(reportPdfUrl('a',{format:'overview'})).toBe('/v2/reports/a/pdf?format=overview');expect(reportPdfFormatUrl('/v2/reports/a/pdf?paper=a4','detailed')).toBe('/v2/reports/a/pdf?paper=a4&format=detailed');expect(reportPdfFormatUrl('/v2/reports/a/pdf?format=detailed','full')).toBe('/v2/reports/a/pdf');
 for(const format of ['questions','',null])expect(()=>reportPdfUrl('a',{format})).toThrow();expect(()=>reportPdfFormatUrl('https://external.invalid/v2/reports/a/pdf','overview')).toThrow();
});

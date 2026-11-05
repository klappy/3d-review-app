// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {cleanup,render} from '@testing-library/svelte';
import Overview from '../ui-next/src/screens/results/Report.svelte';
import Detailed from '../ui-next/src/screens/results/ReportDetailed.svelte';
import Context from '../ui-next/src/screens/results/ReportContext.svelte';
import {useLevelMinimum} from '../ui-next/src/screens/results/data.js';
import fixture from '../ui-next/fixtures/results/report.json';
afterEach(()=>{cleanup();useLevelMinimum(3);});
const report=()=>({...structuredClone(fixture.desktop),counts:{team:999,community:999,church:999},payload:{...structuredClone(fixture.desktop.payload),translation_type_agreement:{team_values:[],church_values:[],agree:null,team_statuses:['no-brief'],church_statuses:['not-aware']},evidence:[{label:'Translation Team — Translators',n:3},{label:'Church — Involved Pastor',n:1},{label:'Community — Written',n:1}]}});
for(const Component of [Overview,Detailed,Context])it(`${Component.name} protects below-floor and unknown snapshot findings despite newer live counts`,()=>{
 useLevelMinimum(3);const data=report();let view=render(Component,{report:data});
 expect(view.container.textContent).toContain('Translation team: No translation brief');
 expect(view.container.textContent).not.toContain('Church: Not aware');
 cleanup();data.payload.evidence=[];view=render(Component,{report:data});
 expect(view.container.textContent).not.toContain('Translation team: No translation brief');
 expect(view.container.textContent).not.toContain('Church: Not aware');
 cleanup();useLevelMinimum(1);view=render(Component,{report:report()});
 expect(view.container.textContent).toContain('Church: Not aware');
});

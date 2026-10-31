import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {it,expect,vi} from 'vitest';
import {prepareQuestionResults,readQuestionResults,type AggregateInput} from '../src/question-results-projection';
import {questionResultsDocument} from '../ui/pdf/question-results-document.js';
const input:AggregateInput={snapshotId:'fixture-1',population:'synthetic',perspective:'Community',questions:[{id:'s',text:'Single',kind:'single',options:[{code:'a',text:'A'},{code:'b',text:'B'},{code:'z',text:'Zero'},{code:'dk',text:'Not known',missing:true}]},{id:'m',text:'Multiple',kind:'multi',options:[{code:'a',text:'A'},{code:'b',text:'B'}]},{id:'text',text:'Comment',kind:'text',options:[]}],rows:[{s:'a',m:['a','b'],text:'SECRET EXCERPT',_other:'SECRET OTHER'},{s:'b',m:['a','b']},{s:'dk',m:[]}].map(answers=>({source:'synthetic' as const,answers}))};
it('single/multi denominators, missing and zero; population pinned; no excerpts',()=>{
 const snapshot=prepareQuestionResults(input,1),m=JSON.parse(snapshot);expect(m.questions[0]).toMatchObject({answered:2,missing:1,options:[{count:1,percentage:50},{count:1,percentage:50},{count:0,percentage:0}]});expect(m.questions[1]).toMatchObject({answered:2,missing:1,options:[{count:2,percentage:100},{count:2,percentage:100}]});expect(snapshot).not.toMatch(/SECRET|_other/);expect(questionResultsDocument(snapshot)).not.toMatch(/SECRET/);expect(m.population).toBe('synthetic');expect(JSON.parse(prepareQuestionResults({...input,population:'participant',rows:input.rows.map(r=>({...r,source:'participant'}))},1)).population).toBe('participant');
});
it('whole question holds small positive/missing/complementary cells and zero denominator',()=>{
 expect(JSON.parse(prepareQuestionResults(input,2)).questions.every((q:any)=>q.status!=='ready')).toBe(true);
 expect(JSON.parse(prepareQuestionResults({...input,rows:[]},1)).questions.every((q:any)=>q.status!=='ready')).toBe(true);
});
it('invalid/duplicate selections and malformed floors fail closed',()=>{
 for(const rows of [[{s:'unknown'}],[{s:['a']}],[{m:['a','a']}],[{m:['a','unknown']}],[{s:'dk',m:['a',3]}]])expect(()=>prepareQuestionResults({...input,rows:rows.map(answers=>({source:'synthetic' as const,answers}))},1)).toThrow('QUESTION_RESULTS_HELD');
 expect(()=>prepareQuestionResults(input,0)).toThrow();
});
it('snapshot readback remains immutable after source mutation and population remains isolated',()=>{
 const copy=structuredClone(input),s=prepareQuestionResults(copy,1);(copy.rows[0].answers as any).s='b';expect(JSON.parse(s).questions[0].options[0].count).toBe(1);expect(prepareQuestionResults(copy,1)).not.toBe(s);
});
it('normal authorization is rechecked after revocation and never reads answers',async()=>{
 const calls:string[]=[];let authorized=true;
 const db={prepare:(sql:string)=>{calls.push(sql);return {bind:()=>({first:async()=>sql.includes('SELECT id, stage')?{id:'a',stage:'understand'}:sql.includes('grant')?(authorized?{role:'owner'}:null):{n:0},all:async()=>({results:[]})})};}};
 const ctx:any={db,env:{ENVIRONMENT:'dev'},principal:{id:'owner',kind:'user'},now:()=>new Date()};
 const result=await readQuestionResults(ctx,'a');expect(result.suppressed).toBe(true);expect(result.excerpts).toBe('held');authorized=false;await expect(readQuestionResults(ctx,'a')).rejects.toThrow();
 expect(calls.some(sql=>sql.includes('answers_json'))).toBe(false);
 const outsider={...ctx,principal:{id:'outsider',kind:'user'}};await expect(readQuestionResults(outsider,'a')).rejects.toThrow();
});

it('refuses mixed or mismatched source populations instead of silently filtering',()=>{expect(()=>prepareQuestionResults({...input,population:'participant'},1)).toThrow();expect(()=>prepareQuestionResults({...input,rows:[...input.rows,{source:'participant',answers:{s:'a'}}]},1)).toThrow();});

it('renders actual question-results PDF only under explicit local evidence options',()=>{
 const out=process.env.PDF_FORMAT_EVIDENCE,chrome=process.env.PDF_LOCAL_CHROME;if(!out||!chrome)return;
 mkdirSync(out,{recursive:true});const path=out+'/question-results-synthetic',snapshot=prepareQuestionResults(input,1);writeFileSync(path+'.json',snapshot);writeFileSync(path+'.html',questionResultsDocument(snapshot));execFileSync(chrome,['--headless','--no-sandbox','--no-pdf-header-footer',`--print-to-pdf=${path}.pdf`,`file://${path}.html`],{timeout:30000,stdio:'pipe'});expect(readFileSync(path+'.pdf').subarray(0,5).toString()).toBe('%PDF-');
});
it('tampered count and unsafe labels cannot inject markup',()=>{const m=JSON.parse(prepareQuestionResults(input,1));m.questions[0].answered='<script>bad</script>';expect(()=>questionResultsDocument(JSON.stringify(m))).toThrow();const safe=structuredClone(input);safe.questions[0].text='<script>question</script>';expect(questionResultsDocument(prepareQuestionResults(safe,1))).not.toContain('<script>');});

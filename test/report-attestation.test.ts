import { beforeAll, describe, it, expect, vi } from 'vitest';
import { readFile, mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildIndex, readPinnedSources, generate } from '../tools/build-synthetic-attestation';
import { attestCapture, initializeAttestation, type CaptureRow } from '../src/report-attestation';
import { canonicalJson, domainHash } from '../src/report-canonical-json';
import artifact from '../src/synthetic-attestation-index.json';
import { ATTESTATION_TRUST } from '../src/synthetic-attestation-trust';
let sources: Awaited<ReturnType<typeof readPinnedSources>>;
let built: Awaited<ReturnType<typeof buildIndex>>;
let seeded: CaptureRow[];
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
beforeAll(async () => {
  sources = await readPinnedSources(); built = await buildIndex(sources.records, sources.templates);
  // Independent mapping oracle: decode the EXISTING committed SQL literals without
  // executing seed SQL. The only SQLite execution is pinned template recovery.
  const python = `import json,pathlib,re,sys
text=(pathlib.Path(sys.argv[1])/'seed/synthetic-responses.sql').read_text()
def statements(table):
 rows=[]
 for line in text.splitlines():
  prefix='INSERT OR IGNORE INTO '+table+' ('
  if not line.startswith(prefix):continue
  cols,raw=line[len(prefix):].split(') VALUES (',1); raw=raw[:-2];vals=[];pos=0
  while pos<len(raw):
   m=re.match(r"'(?:[^']|'')*'|[0-9]+|NULL",raw[pos:])
   if not m:raise ValueError('literal')
   t=m.group();vals.append(t[1:-1].replace("''", "'") if t[0]=="'" else None if t=='NULL' else int(t));pos+=len(t)
   if pos<len(raw):
    if raw[pos]!=',':raise ValueError('separator')
    pos+=1
  names=cols.split(',')
  if len(names)!=len(vals):raise ValueError('columns')
  rows.append(dict(zip(names,vals)))
 return rows
surveys={r['id']:r for r in statements('assessment_survey')}
rows=[]
for r in statements('response'):
 s=surveys[r['assessment_survey_id']]; rows.append(dict(responseId=r['id'],assessmentId=s['assessment_id'],assessmentSurveyId=r['assessment_survey_id'],responseTemplateId=r['template_id'],responseTemplateVersion=r['template_version'],selectedTemplateId=s['template_id'],selectedTemplateVersion=s['template_version'],submittedAt=r['submitted_at'],answersRaw=r['answers_json']))
print(json.dumps(rows))
`;
  const decoded = JSON.parse(execFileSync('python3', ['-c', python, process.cwd()], { encoding: 'utf8', maxBuffer: 1048576 }));
  seeded = decoded.map((row: any) => {
    const t = sources.templates.find((t: any) => t.id === row.selectedTemplateId && t.version === row.selectedTemplateVersion);
    if (!t) throw new Error('Missing oracle template');
    return {...row, templateRaw: JSON.stringify({ templateId:t.id, templateVersion:t.version, sourceRef:t.source_ref, perspective:t.perspective, items:JSON.parse(t.items_json) })};
  });
}, 20000);
describe('pinned source identity and compact generation', () => {
  it('generates exact committed bytes with all historic omissions', async () => {
    expect(built.bytes).toBe(await readFile('src/synthetic-attestation-index.json','utf8'));
    expect(built.evidence).toMatchObject({ count:425, cycles:34, itemCount:111, templateCount:9, requiredOmissions:301, optionalNulls:659 });
    expect(built.artifact.indexRoot).toBe(ATTESTATION_TRUST.indexRoot);
    expect(Buffer.byteLength(built.bytes)).toBeLessThanOrEqual(524288);
    expect((await buildIndex(sources.records, sources.templates)).bytes).toBe(built.bytes);
    expect(new Set(built.evidence.collisionAudit.map(x=>x.responseId)).size).toBe(425);
  });
  it('all 425 actual existing seeded tuples attest, grouped into all 34 assessments', async () => {
    expect(seeded).toHaveLength(425);
    const groups = Map.groupBy(seeded, row=>row.assessmentId); expect(groups.size).toBe(34);
    for (const [id, rows] of groups) {
      const result = await attestCapture(id, rows); expect(result.eligible).toBe(true);
      if (result.eligible) expect(result.responseIds).toEqual(rows.map(r=>r.responseId).sort());
    }
    const generated = new Map(built.captures.map(r=>[r.responseId,r]));
    for (const row of seeded) {
      const actual = generated.get(row.responseId)!;
      expect(actual).toBeDefined();
      for (const key of Object.keys(row)) {
        if (key === 'answersRaw' || key === 'templateRaw') expect(JSON.parse(actual[key])).toEqual(JSON.parse(row[key]));
        else expect(actual[key]).toEqual(row[key as keyof CaptureRow]);
      }
    }
  });
  it('old subset and appended known set attest separately; order is irrelevant', async () => {
    const group = seeded.filter(r=>r.assessmentId===seeded[0].assessmentId);
    expect(group.length).toBeGreaterThan(1);
    const old = await attestCapture(group[0].assessmentId,group.slice(0,1));
    const current = await attestCapture(group[0].assessmentId,group);
    expect(old.eligible && current.eligible).toBe(true);
    if (old.eligible && current.eligible) expect(old.captureDigest).not.toBe(current.captureDigest);
    expect(await attestCapture(group[0].assessmentId,[...group].reverse())).toEqual(current);
  });
  it('preserves every required omission; replacing any by null or empty refuses', async () => {
    let omissions = 0;
    for (const row of seeded) {
      const answers = JSON.parse(row.answersRaw), template = JSON.parse(row.templateRaw);
      for (const item of template.items) if (item.required === true && !Object.hasOwn(answers,item.id)) {
        omissions++;
        for (const replacement of [null,'']) expect((await attestCapture(row.assessmentId,[{...row,answersRaw:JSON.stringify({...answers,[item.id]:replacement})}])).eligible).toBe(false);
      }
    }
    expect(omissions).toBe(301);
  });
  it('dropping an explicit optional null refuses', async () => {
    const row = seeded.find(r=>Object.values(JSON.parse(r.answersRaw)).includes(null))!;
    const answers=JSON.parse(row.answersRaw); delete answers[Object.keys(answers).find(k=>answers[k]===null)!];
    expect((await attestCapture(row.assessmentId,[{...row,answersRaw:JSON.stringify(answers)}])).eligible).toBe(false);
  });
});
describe('verification fail-closed boundary', () => {
  it('mutating every metadata and template identity field refuses', async () => {
    const row=seeded[0];
    for (const key of ['responseId','assessmentId','assessmentSurveyId','responseTemplateId','responseTemplateVersion','selectedTemplateId','selectedTemplateVersion','submittedAt'] as const) {
      const value = row[key]; const changed = {...row,[key]: typeof value==='number'?value+1:value+'x'};
      expect((await attestCapture(row.assessmentId,[changed])).eligible).toBe(false);
    }
    for (const key of ['templateId','templateVersion','sourceRef','perspective','items']) {
      const template=JSON.parse(row.templateRaw);
      template[key]=key==='items'?[...template.items].reverse():typeof template[key]==='number'?template[key]+1:template[key]+'x';
      expect((await attestCapture(row.assessmentId,[{...row,templateRaw:JSON.stringify(template)}])).eligible).toBe(false);
    }
    const t=JSON.parse(row.templateRaw); t.extra='not attested';
    expect((await attestCapture(row.assessmentId,[{...row,templateRaw:JSON.stringify(t)}])).eligible).toBe(false);
    expect((await attestCapture(row.assessmentId,[{...row,answersRaw:'{}'}])).eligible).toBe(false);
  });
  it('refuses empty, unknown, mixed, duplicate, oversized and malformed captures', async () => {
    const row=seeded[0], other=seeded.find(r=>r.assessmentId!==row.assessmentId)!;
    const bad:any[]=[[],[row,row],[row,other],[{...row,responseId:'unknown'}],Array(426).fill(row),[{...row,answersRaw:'{"a":1,"\\u0061":2}'}],[{...row,templateRaw:'{"x":{"a":1,"a":2}}'}],[{...row,answersRaw:' '.repeat(8193)}],[{...row,templateRaw:' '.repeat(65537)}],[{...row,source:'synthetic'}]];
    const missing:any={...row};delete missing.submittedAt;bad.push([missing]);
    for (const rows of bad) expect((await attestCapture(row.assessmentId,rows)).eligible).toBe(false);
    expect((await attestCapture('',[row])).eligible).toBe(false);
  });
  it('snapshots before await and refuses accessors without invoking them', async () => {
    const row=clone(seeded[0]); const result=attestCapture(row.assessmentId,[row]); row.answersRaw='{}';
    expect((await result).eligible).toBe(true);
    let calls=0; const evil=Object.defineProperty({...seeded[0]},'answersRaw',{get(){calls++;return '{}';},enumerable:true});
    expect((await attestCapture(seeded[0].assessmentId,[evil])).eligible).toBe(false);
    const array:any=[];Object.defineProperty(array,'0',{get(){calls++;return seeded[0];},enumerable:true});
    expect((await attestCapture(seeded[0].assessmentId,array)).eligible).toBe(false);expect(calls).toBe(0);
  });
  it('compiled trust refuses a forged artifact even after every changed self-hash is recomputed', async () => {
    const forged=clone(artifact); const entry=forged.index.entries[0];
    entry.preimage.submittedAt+='x';entry.responseDigest=await domainHash('3d-response-v1',entry.preimage);
    forged.indexRoot=await domainHash('3d-index-v1',forged.index);
    vi.resetModules();vi.doMock('../src/synthetic-attestation-index.json',()=>({default:forged}));
    try {
      const altered=await import('../src/report-attestation');
      await expect(altered.initializeAttestation()).rejects.toThrow();
      expect(await altered.attestCapture(seeded[0].assessmentId,[seeded[0]])).toEqual({eligible:false,reason:'INDEX_INVALID'});
    } finally {vi.doUnmock('../src/synthetic-attestation-index.json');vi.resetModules();}
  });
  it('refuses artifact getters, hooks, inherited and extra fields without invocation', async () => {
    let calls=0;
    const getter=Object.defineProperty(clone(artifact),'index',{enumerable:true,get(){calls++;return artifact.index;}});
    const rootGetter=Object.defineProperty(clone(artifact),'indexRoot',{enumerable:true,get(){calls++;return artifact.indexRoot;}});
    const hook=Object.assign(clone(artifact),{toJSON(){calls++;return artifact;}});
    const inherited=Object.assign(Object.create({extra:1}),clone(artifact));
    const hidden=Object.defineProperty(clone(artifact),'index',{value:artifact.index,enumerable:false});
    const nested=clone(artifact);Object.defineProperty(nested.index,'entries',{enumerable:true,get(){calls++;return artifact.index.entries;}});
    for(const forged of [getter,rootGetter,hook,inherited,hidden,nested,{...clone(artifact),extra:1}]) {
      vi.resetModules();vi.doMock('../src/synthetic-attestation-index.json',()=>({default:forged}));
      try {await expect((await import('../src/report-attestation')).initializeAttestation()).rejects.toThrow();}
      finally {vi.doUnmock('../src/synthetic-attestation-index.json');vi.resetModules();}
    }
    expect(calls).toBe(0);
  });
  it('refuses canonical/mapping/source header changes', async () => {
    for (const key of ['canonicalVersion','mappingVersion','sourcePin','schemaVersion'] as const) {
      const forged=clone(artifact);forged.index[key]+='x';forged.indexRoot=await domainHash('3d-index-v1',forged.index);
      vi.resetModules();vi.doMock('../src/synthetic-attestation-index.json',()=>({default:forged}));
      try {await expect((await import('../src/report-attestation')).initializeAttestation()).rejects.toThrow();}
      finally {vi.doUnmock('../src/synthetic-attestation-index.json');vi.resetModules();}
    }
  });
});
describe('offline generator refuses ambiguity atomically', () => {
  it('rejects duplicate source IDs and a truncated ID collision', async () => {
    await expect(buildIndex([...sources.records,sources.records[0]],sources.templates)).rejects.toThrow('SOURCE_REFUSED');
    let n=0;
    await expect(buildIndex(sources.records,sources.templates,async()=> 'a'.repeat(20)+(n++).toString(16).padStart(44,'0'))).rejects.toThrow('SOURCE_REFUSED');
  });
  it('rejects duplicate form, item, option code/text, unknown answer and bad cardinality/type', async () => {
    await expect(buildIndex(sources.records,[...sources.templates,sources.templates[0]])).rejects.toThrow();
    for (const kind of ['item','code','text']) {
      const rows=clone(sources.templates);const items=JSON.parse(rows[0].items_json);
      if(kind==='item')items.push(items[0]);else {const item=items.find((x:any)=>x.options?.length>1);item.options[1][kind]=item.options[0][kind];}
      rows[0].items_json=JSON.stringify(items);await expect(buildIndex(sources.records,rows)).rejects.toThrow();
    }
    for(const kind of ['unknown','text','cardinality','type']) {
      const records:any[]=clone(sources.records);const answers=records[0].answers;const key=Object.keys(answers)[0];
      if(kind==='unknown')answers.unknown={selected:['x']};
      else if(kind==='text')answers[key].selected=['not a known option'];
      else if(kind==='cardinality')answers[key].selected.push(answers[key].selected[0]);
      else answers[key].selected=[42];
      await expect(buildIndex(records,sources.templates)).rejects.toThrow();
    }
  });
  it('preserves multi-answer order and multiplicity without inventing answers', async () => {
    const record:any=clone(sources.records.find((r:any)=> {
      const t=sources.templates.find((t:any)=>t.name===r.form_variant);
      return JSON.parse(t.items_json).some((i:any)=>i.type==='multi' && i.options?.length>1);
    }));
    const template=sources.templates.find((t:any)=>t.name===record.form_variant);
    const item=JSON.parse(template.items_json).find((i:any)=>i.type==='multi' && i.options?.length>1);
    record.answers[item.id]={selected:[item.options[1].text,item.options[0].text,item.options[1].text]};
    const mapped=await buildIndex([record],sources.templates);
    expect(JSON.parse(mapped.captures[0].answersRaw)[item.id]).toEqual([item.options[1].code,item.options[0].code,item.options[1].code]);
  });
  it('leaves no partial output and preserves an existing artifact on failures', async () => {
    const directory=await mkdtemp(resolve(tmpdir(),'attestation-atomic-'));const output=resolve(directory,'index.json');
    try {
      await expect(generate(output,process.cwd(),s=>s.records.push(s.records[0]))).rejects.toThrow();
      expect(await readdir(directory)).toEqual([]);
      await writeFile(output,'previous');
      await expect(generate(output,process.cwd(),undefined,async()=> 'a'.repeat(64))).rejects.toThrow();
      expect(await readFile(output,'utf8')).toBe('previous');expect(await readdir(directory)).toEqual(['index.json']);
    } finally {await rm(directory,{recursive:true,force:true});}
  });
});

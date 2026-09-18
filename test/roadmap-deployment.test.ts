import {describe,it,expect} from 'vitest';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// @ts-expect-error Node build helper is JavaScript by design.
import {permissionHashes,stampRoadmapPermissions} from '../scripts/stamp-roadmap-permissions.mjs';
// @ts-expect-error Node deployment helper is JavaScript by design.
import {guard,expectedSchema,deployPreparation,providerCommand} from '../scripts/prepare-roadmap-deploy.mjs';
const sha='a'.repeat(40),env={WORKERS_CI:'1',CI:'true',WORKERS_CI_BRANCH:'main',WORKERS_CI_COMMIT_SHA:sha};
const sql=readFileSync(new URL('../migrations/0010_roadmap.sql',import.meta.url),'utf8');
const rows=()=>[...expectedSchema(sql)].map(([name,sql]:any)=>({name,sql}));
describe('reviewed roadmap deployment guards',()=>{
 it('private build permissions contain hashes only; missing permissions deny by default',()=>{expect(permissionHashes({})).toEqual({publish:[],verify:[],summary:[]});const id='usr_'+'1'.repeat(20),folder=mkdtempSync(join(tmpdir(),'roadmap-permission-'));try{stampRoadmapPermissions(folder,{...env,ROADMAP_PUBLISHER_IDS:id});const out=readFileSync(join(folder,'src/roadmap/permissions.generated.ts'),'utf8');expect(out).not.toContain(id);expect(out).toContain('"verify":[]');expect(out).toContain('"summary":[]');expect(permissionHashes({...env,ROADMAP_PUBLISHER_IDS:id}).publish[0]).toMatch(/^[0-9a-f]{64}$/);}finally{rmSync(folder,{recursive:true,force:true});}});
 it('permission projection rejects branch previews, local overrides and malformed IDs',()=>{for(const e of [{ROADMAP_PUBLISHER_IDS:'usr_'+'1'.repeat(20)},{...env,WORKERS_CI_BRANCH:'feature',ROADMAP_PUBLISHER_IDS:'usr_'+'1'.repeat(20)},{...env,ROADMAP_PUBLISHER_IDS:'person@example.test'}])expect(()=>permissionHashes(e)).toThrow();});
 it('migration refuses local, wrong branch/target and mismatched commit',()=>{for(const e of [{},{...env,WORKERS_CI_BRANCH:'production'},{...env,WORKERS_CI_COMMIT_SHA:'b'.repeat(40)}])expect(()=>guard(e,'dev',sha)).toThrow();expect(()=>guard(env,'production',sha)).toThrow();expect(()=>guard(env,'dev',sha)).not.toThrow();});
 it('absent schema applies only reviewed migration and validates readback',()=>{let applied=false;const calls:any[]=[];const execute=(args:any[])=>{calls.push(args);if(args.includes('--file')){applied=true;return [{success:true}];}return [{success:true,results:args.join(' ').includes('sqlite_master')?(applied?rows():[]):[{revision:0,generation:0}]}];};expect(deployPreparation('dev',{env,head:sha,execute,sql}).action).toContain('applied');expect(calls.filter(c=>c.includes('--file'))).toHaveLength(1);expect(calls.flat().filter(x=>String(x).includes('0010_roadmap.sql'))).toHaveLength(1);});
 it('matching schema preserves current clock and writes nothing; partial schema stops',()=>{const calls:any[]=[];const execute=(args:any[])=>{calls.push(args);return [{success:true,results:args.join(' ').includes('sqlite_master')?rows():[{revision:19,generation:2}]}];};expect(deployPreparation('dev',{env,head:sha,execute,sql}).action).toContain('no data change');expect(calls.some(c=>c.includes('--file'))).toBe(false);expect(()=>deployPreparation('dev',{env,head:sha,sql,execute:()=>[{success:true,results:rows().slice(1)}]})).toThrow('Partial');});
});
it('production preparation targets only the production binding',()=>{const calls:any[]=[];const execute=(args:any[])=>{calls.push(args);return [{success:true,results:args.join(' ').includes('sqlite_master')?rows():[{revision:0,generation:0}]}];};deployPreparation('production',{env:{...env,WORKERS_CI_BRANCH:'production'},head:sha,execute,sql});expect(calls.every(c=>c[2]==='3d-review'&&c.includes('--env')&&c.includes('production')&&!c.includes('3d-review-dev'))).toBe(true);});

it('provider adapter invokes pinned CLI directly and never turns a signal, timeout or malformed output into success',()=>{
 const args=['d1','execute','3d-review-dev','--remote','--json','--command','SELECT 1'];let captured:any[]=[];const valid={status:0,signal:null,stdout:'[{"success":true,"results":[]}]',stderr:''};
 expect(providerCommand(args,{spawn:(...v:any[])=>{captured=v;return valid;},env:{}})).toEqual([{success:true,results:[]}]);expect(captured[1][0]).toMatch(/wrangler-dist\/cli\.js$/);expect(captured[1].slice(1)).toEqual(args);expect(captured[2].timeout).toBe(120000);
 for(const result of [{...valid,status:null,signal:'SIGTERM'},{...valid,error:new Error('ETIMEDOUT')},{...valid,status:1},{...valid,stdout:''},{...valid,stdout:'private-raw-output'}]){let error='';try{providerCommand(args,{spawn:()=>result,env:{}});}catch(e){error=String(e);}expect(error).toContain('deployment stopped');expect(error).not.toContain('private-raw-output');expect(error).toContain('stdout_bytes=');}
});

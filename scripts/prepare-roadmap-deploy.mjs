import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const migration=join(root,'migrations/0010_roadmap.sql');
export const normalizeSql=s=>s.replace(/\s+/g,' ').trim().replace(/;$/,'').toLowerCase();
export function expectedSchema(sql){const out=new Map();for(const statement of sql.split('\n').filter(x=>!x.trimStart().startsWith('--')).join('\n').split(';').map(x=>x.trim()).filter(Boolean)){const m=statement.match(/^CREATE (TABLE|INDEX) (roadmap_[a-z_]+)/i);if(m)out.set(m[2],normalizeSql(statement));}if(out.size!==5)throw Error('Unexpected roadmap migration source.');return out;}
export function preflight(rows,expected){if(!Array.isArray(rows))throw Error('Schema preflight unavailable.');if(rows.length===0)return 'absent';if(rows.length!==expected.size||rows.some(r=>!expected.has(r.name)||normalizeSql(r.sql??'')!==expected.get(r.name)))throw Error('Partial or different roadmap schema; refusing migration.');return 'present';}
export function guard(env,target,head){if(!['dev','production'].includes(target)||env.WORKERS_CI!=='1'||env.CI!=='true'||env.WORKERS_CI_BRANCH!==(target==='dev'?'main':'production')||!/^[0-9a-f]{40}$/.test(env.WORKERS_CI_COMMIT_SHA??'')||head!==env.WORKERS_CI_COMMIT_SHA)throw Error('Migration is restricted to the matching canonical Workers Build.');}
// Invoke the pinned CLI directly: Wrangler's bin wrapper maps a signal-killed child to exit 0.
// Keep raw output private; diagnostics expose only process state and byte counts.
export function providerCommand(args,{spawn=spawnSync,env=process.env}={}){
 const r=spawn(process.execPath,[join(root,'node_modules/wrangler/wrangler-dist/cli.js'),...args],{cwd:root,env,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
 const diagnostic=`status=${r.status??'none'} signal=${r.signal??'none'} stdout_bytes=${Buffer.byteLength(r.stdout??'')} stderr_bytes=${Buffer.byteLength(r.stderr??'')}`;
 if(r.error||r.signal||r.status!==0)throw Error('Provider migration/preflight process failed; deployment stopped. '+diagnostic);
 let data;try{data=JSON.parse(r.stdout);}catch{throw Error('Provider preflight was not valid JSON; deployment stopped. '+diagnostic);}return data;
}
export function deployPreparation(target,{env=process.env,head,execute=providerCommand,sql=readFileSync(migration,'utf8')}={}){
 guard(env,target,head);const expected=expectedSchema(sql),db=target==='dev'?'3d-review-dev':'3d-review';
 const args=['d1','execute',db,'--remote','--json',...(target==='production'?['--env','production']:[])];
 const names=[...expected.keys()].map(x=>`'${x}'`).join(',');
 const inspect=()=>{const r=execute([...args,'--command',`SELECT name,sql FROM sqlite_master WHERE name IN (${names}) ORDER BY name`]);if(!Array.isArray(r)||r.length!==1||r[0].success!==true||!Array.isArray(r[0].results))throw Error('Schema preflight failed.');return r[0].results;};
 const state=preflight(inspect(),expected);
 if(state==='absent')execute([...args,'--file',migration]);
 if(preflight(inspect(),expected)!=='present')throw Error('Roadmap schema readback failed.');
 const clock=execute([...args,'--command','SELECT revision,generation FROM roadmap_clock WHERE id=1']);
 const row=clock?.[0]?.results?.[0];if(clock?.[0]?.success!==true||clock[0].results.length!==1||!Number.isSafeInteger(row?.revision)||row.revision<0||!Number.isSafeInteger(row?.generation)||row.generation<0)throw Error('Roadmap clock readback failed.');
 return {target,action:state==='absent'?'applied reviewed additive migration':'schema already matches; no data change'};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){try{const git=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});if(git.status!==0)throw Error('Build identity unavailable.');const result=deployPreparation(process.argv[2],{head:git.stdout.trim()});console.log('Roadmap deploy preparation: '+result.target+'; '+result.action);}catch(e){console.error(e.message);process.exitCode=1;}}

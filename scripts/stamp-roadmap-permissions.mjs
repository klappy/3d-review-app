import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
/** Build-secret projection. No raw identity or credential enters source control, Assets or logs. */
export function permissionHashes(env){
 const result={publish:[],verify:[],summary:[]};
 for(const [kind,key] of Object.entries({publish:'ROADMAP_PUBLISHER_IDS',verify:'ROADMAP_VERIFIER_IDS',summary:'ROADMAP_SUMMARY_REVIEWER_IDS'})){
  const ids=(env[key]??'').split(',').map(x=>x.trim()).filter(Boolean);
  if(ids.length>20||ids.some(id=>!/^usr_[0-9a-f]{20}$/.test(id)))throw Error('Invalid narrow roadmap permission configuration.');
  if(ids.length&&(env.WORKERS_CI!=='1'||!['main','production'].includes(env.WORKERS_CI_BRANCH)))throw Error('Private roadmap permission projection requires a canonical Workers Build.');
  result[kind]=[...new Set(ids.map(id=>createHash('sha256').update(id).digest('hex')))];
 }
 return result;
}
export function stampRoadmapPermissions(outDir,env){
 const hashes=permissionHashes(env),file=join(outDir,'src/roadmap/permissions.generated.ts');
 const content='// GENERATED server-only authorization metadata. Never serve or commit.\nexport const roadmapPermissionHashes = '+JSON.stringify(hashes)+' as const;\n';
 mkdirSync(dirname(file),{recursive:true});if(!existsSync(file)||readFileSync(file,'utf8')!==content)writeFileSync(file,content,{mode:0o600});
}

import {readFileSync} from 'node:fs';
import {afterAll, expect, it} from 'vitest';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {resolvePrincipal, mintSession} from '../src/auth';
import {list as workspaces, get as workspace} from '../src/handlers/workspace';
import {list as projects, get as project} from '../src/handlers/project';
import {list as assessments, get as assessment} from '../src/handlers/assessment';
import {accept} from '../src/handlers/grant';
import {list as responses} from '../src/handlers/response';
import type {Ctx} from '../src/handlers/types';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'global-access',modules:true,script:"export default {fetch(){return new Response('ok')}}",d1Databases:{DB:'global-access'}}]}));
afterAll(()=>mf.dispose());
it('switches a verified super admin between personal grants and all workspace hierarchies; ordinary accounts cannot elevate',async()=>{
 const db=await mf.getD1Database('DB');
 for(const file of ['migrations/0001_init.sql','migrations/0002_code_escrow.sql','migrations/0003_language_archive.sql','migrations/0011_context.sql','seed/synthetic.sql']){
  const sql=readFileSync(new URL('../'+file,import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
  await db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 }
 const env={DB:db,SESSION_SECRET:'synthetic-only'};
 for(const [id,support] of [['global_admin',1],['ordinary',0]] as const) await db.prepare('INSERT INTO principal(id,email_hash,provisioned,support,created_at) VALUES(?,?,1,?,?)').bind(id,id,support,'2026-10-20').run();
 const admin=await mintSession(env,'global_admin','user'), ordinary=await mintSession(env,'ordinary','user');
 const context=async(token:string,mode:string):Promise<Ctx>=>({env,db,principal:await resolvePrincipal(new Request('https://example.invalid/v2/me',{headers:{cookie:`session=${token}; review_access=${mode}`}}),env),traceId:'tr_test',now:()=>new Date(),log:()=>{}});
 const my=await context(admin,'my'), global=await context(admin,'global');
 for(const preference of ['', 'invalid', 'GLOBAL']) {
  const request=new Request('https://example.invalid/v2/me',{headers:{cookie:`session=${admin}${preference ? '; review_access='+preference : ''}`}});
  expect(await resolvePrincipal(request,env)).toMatchObject({kind:'user',accessMode:'my'});
 }
 expect(await resolvePrincipal(new Request('https://example.invalid/v2/me',{headers:{authorization:`Bearer ${admin}`}}),env)).toMatchObject({kind:'user',accessMode:'my'});
 expect(my.principal).toMatchObject({kind:'user',superAdmin:true,accessMode:'my'});
 expect(global.principal).toMatchObject({kind:'support',superAdmin:true,accessMode:'global'});
 // A global support principal never reaches grant.accept's existing-role preview.
 await expect(accept(global,{invitation_id:'unused'},{dryRun:true})).rejects.toMatchObject({code:'NOT_AUTHENTICATED'});
 expect((await workspaces(my,{})).result.workspaces).toEqual([]);
 expect((await projects(my,{})).result.projects).toEqual([]);
 const ws=(await workspaces(global,{})).result.workspaces;
 expect(ws.length).toBeGreaterThan(0);
 for(const w of ws){const opened=await workspace(global,{id:w.id});expect(opened.result.workspace.id).toBe(w.id);}
 const ps=(await projects(global,{})).result.projects;
 expect(ps.length).toBeGreaterThan(0);
 for(const p of ps){
  expect((await project(global,{id:p.id})).result.project.id).toBe(p.id);
  for(const a of (await assessments(global,{pid:p.id})).result.assessments){
   expect((await assessment(global,{id:a.id})).result.assessment.id).toBe(a.id);
   expect((await responses(global,{aid:a.id})).result).toMatchObject({suppressed:true});
   await expect(assessment(my,{id:a.id})).rejects.toMatchObject({code:'NOT_FOUND_OR_NOT_VISIBLE'});
  }
 }
 const outsider=await context(ordinary,'global');
 expect(outsider.principal.kind).toBe('user');
 expect(outsider.principal.superAdmin).toBeUndefined();
 expect((await projects(outsider,{})).result.projects).toEqual([]);
 // Global cards preserve actual direct roles and workspace inheritance rather than relabelling every grant viewer.
 const stamp=new Date().toISOString(), w=ws[0], p=ps[0];
 await db.prepare('INSERT INTO "grant" (id,principal_id,scope_type,scope_id,role,created_at) VALUES (?,?,?,?,?,?)').bind('g_admin_ws','global_admin','workspace',w.id,'owner',stamp).run();
 await db.prepare('UPDATE project SET workspace_id=? WHERE id=?').bind(w.id,p.id).run();
 await db.prepare('INSERT INTO "grant" (id,principal_id,scope_type,scope_id,role,created_at) VALUES (?,?,?,?,?,?)').bind('g_admin_proj','global_admin','project',p.id,'member',stamp).run();
 expect((await workspaces(global,{})).result.workspaces.find((x:any)=>x.id===w.id).role).toBe('owner');
 expect((await projects(global,{})).result.projects.find((x:any)=>x.id===p.id)).toMatchObject({role:'owner',direct_role:'member'});
 for(const a of (await assessments(global,{pid:p.id})).result.assessments){
  await db.prepare('INSERT INTO "grant" (id,principal_id,scope_type,scope_id,role,created_at) VALUES (?,?,?,?,?,?)').bind('g_admin_'+a.id,'global_admin','assessment',a.id,'member',stamp).run();
  // Workspace owner wins over the lower direct member grant; preserve the direct marker.
  expect((await assessments(global,{pid:p.id})).result.assessments.find((x:any)=>x.id===a.id)).toMatchObject({role:'owner',direct_role:'member'});
  expect((await assessment(global,{id:a.id})).result.assessment).toMatchObject({role:'owner',direct_role:'member'});
  expect((await assessment(my,{id:a.id})).result.assessment).toMatchObject({role:'owner',direct_role:'member'});
 }
 await db.prepare('DELETE FROM "grant" WHERE principal_id=?').bind('global_admin').run();
 // Switching back restores the ordinary grants without altering the account or grants.
 expect((await workspaces(await context(admin,'my'),{})).result.workspaces).toEqual([]);
 const participant=await mintSession(env,'ordinary','participant');
 expect((await context(participant,'global')).principal.kind).toBe('participant');
});

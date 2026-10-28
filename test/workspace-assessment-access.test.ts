import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import worker from '../src/worker';
import { mintSession } from '../src/auth';
import { sha256 } from '../src/handlers/common';

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'workspace-assessment-access', modules: true,
  script: "export default {fetch(){return new Response('isolated fixture')}}", d1Databases: { DB: 'workspace-assessment-access' }, kvNamespaces: { OAUTH_KV: 'fixture-kv' } }] }));
let db: D1Database, env: any;
const aid = 'assess_syn_earning-trust-2026-01';
const tokens: Record<string, string> = {};
let pid: string, reportId: string;
const run = (sql: string, ...args: any[]) => db.prepare(sql).bind(...args).run();
async function http(path: string, who: string, body?: unknown, method?: string) {
  const response = await worker.fetch(new Request('https://fixture.test' + path, { method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: { ...(tokens[who] ? { authorization: `Bearer ${tokens[who]}` } : {}), 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, { waitUntil() {}, passThroughOnException() {}, props: undefined } as any);
  return { status: response.status, body: await response.json() as any };
}
beforeAll(async () => {
  db = await mf.getD1Database('DB');
  for (const file of ['migrations/0001_init.sql', 'migrations/0002_code_escrow.sql', 'migrations/0003_language_archive.sql', 'migrations/0004_pinned_instruments.sql', 'migrations/0006_oauth_code_redemption.sql', 'migrations/0007_shared_link_context.sql', 'migrations/0008_synthetic_report.sql', 'migrations/0011_context.sql', 'seed/synthetic.sql', 'seed/synthetic-responses.sql']) {
    const sql = readFileSync(new URL('../' + file, import.meta.url), 'utf8').split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');
    const statements = sql.split(';\n').map(s => s.trim()).filter(Boolean);
    for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50).map(s => db.prepare(s)));
  }
  env = { DB: db, SESSION_SECRET: 'workspace-inheritance-fixture-only', ENVIRONMENT: 'dev', OAUTH_KV: await mf.getKVNamespace('OAUTH_KV') };
  pid = (await db.prepare('SELECT project_id FROM assessment WHERE id=?').bind(aid).first<any>()).project_id;
  await run("INSERT INTO workspace(id,name,created_at) VALUES('ws_inherited','Fixture workspace','2026-10-27')");
  await run('UPDATE project SET workspace_id=? WHERE id=?', 'ws_inherited', pid);
  for (const [id, role] of [['owner', 'owner'], ['member', 'member'], ['viewer', 'viewer'], ['outsider', null], ['project_only', null]] as const) {
    await run('INSERT INTO principal(id,email_hash,provisioned,support,created_at) VALUES(?,?,1,0,?)', id, await sha256(id + '@example.invalid'), '2026-10-27');
    if (role) await run('INSERT INTO "grant"(id,principal_id,scope_type,scope_id,role,created_at) VALUES(?,?,\'workspace\',?,?,?)', 'g_' + id, id, 'ws_inherited', role, '2026-10-27');
    tokens[id] = await mintSession(env, id, 'user');
  }
  tokens.participant = await mintSession(env, 'outsider', 'participant');
  tokens.support_owner = await mintSession(env, 'owner', 'support');
  await run("INSERT INTO workspace(id,name,created_at) VALUES('ws_other','Other fixture workspace','2026-10-27')");
  await run("INSERT INTO \"grant\"(id,principal_id,scope_type,scope_id,role,created_at) VALUES('g_other','outsider','workspace','ws_other','owner','2026-10-27')");
  await run('INSERT INTO "grant"(id,principal_id,scope_type,scope_id,role,created_at) VALUES(?,?,\'project\',?,?,?)', 'g_project_only', 'project_only', pid, 'owner', '2026-10-27');
}, 60000);
afterAll(() => mf.dispose());

describe('authenticated workspace membership reaches contained assessments and reports', () => {
  it('owner and member open and list existing assessments without child grants; counts agree', async () => {
    for (const who of ['owner', 'member', 'support_owner']) {
      const expectedRole = who === 'support_owner' ? 'owner' : who;
      expect((await http('/v2/assessments/' + aid, who)).body).toMatchObject({ ok: true, result: { assessment: { id: aid, role: expectedRole, direct_role:null } } });
      const listed = await http('/v2/projects/' + pid + '/assessments', who);
      expect(listed.body.result.assessments.some((a: any) => a.id === aid && a.role === expectedRole && a.direct_role === null)).toBe(true);
      const projects = await http('/v2/projects', who);
      expect(projects.body.result.projects.find((p: any) => p.id === pid).assessment_count).toBeGreaterThan(0);
      expect((await http('/v2/assessments/' + aid, who, {name:'Workspace edit '+who}, 'PATCH')).body.ok).toBe(true);
      expect((await http('/v2/assessments/' + aid, who)).body.result.assessment.name).toBe('Workspace edit '+who);
    }
  });
  it('keeps the strongest inherited role without materializing a new grant', async () => {
    await run("INSERT INTO \"grant\"(id,principal_id,scope_type,scope_id,role,created_at) VALUES('direct_view','member','assessment',?,'viewer','2026-10-27')", aid);
    expect((await http('/v2/assessments/' + aid, 'member')).body.result.assessment.role).toBe('member');
    await run("DELETE FROM \"grant\" WHERE id='direct_view'");
  });
  it('member can build with confirmation and owner/viewer can reopen the same stored report', async () => {
    const path = '/v2/assessments/' + aid + '/reports';
    const preview = await http(path, 'member', { mode: 'dry_run' });
    expect(preview.body).toMatchObject({ ok: true, result: { suppressed: false, status: 'ready' } });
    const built = await http(path, 'member', { mode: 'execute', confirm_token: preview.body.result.confirm_token });
    expect(built.status).toBe(200);
    reportId = built.body.result.report.id;
    for (const who of ['owner', 'member', 'viewer']) {
      expect((await http('/v2/reports/' + reportId, who)).body).toMatchObject({ ok: true, result: { report: { id: reportId } } });
      expect((await http(path, who)).body.result.reports.map((r: any) => r.id)).toContain(reportId);
    }
    expect((await http(path, 'viewer', { mode: 'dry_run' })).body.ok).toBe(false);
  });
  it('viewer can read but cannot edit; inherited owner cannot mint a direct child grant or delete', async () => {
    expect((await http('/v2/assessments/' + aid, 'viewer')).body.result.assessment.role).toBe('viewer');
    for(const action of ['archive','unarchive']) expect((await http('/v2/assessments/'+aid+'/'+action,'owner',{})).body).toMatchObject({ok:false,error:{code:'NOT_AUTHORIZED_AT_SCOPE'}});
    // Handler-level writes are exercised through the real capability dispatcher in the companion workspace suite.
    const deletion = await http('/v2/assessments/' + aid, 'owner', { mode: 'dry_run' }, 'DELETE');
    expect(deletion.body).toMatchObject({ok:false,error:{code:'NOT_AUTHORIZED_AT_SCOPE'}});
    expect((await http('/v2/assessments/' + aid, 'viewer', {name:'forbidden'}, 'PATCH')).body).toMatchObject({ok:false,error:{code:'NOT_AUTHORIZED_AT_SCOPE'}});
    expect((await http('/v2/assessment/' + aid + '/invitations', 'owner', {email:'new@example.invalid',role:'member',mode:'dry_run'})).body).toMatchObject({ok:false,error:{code:'NOT_AUTHORIZED_AT_SCOPE'}});
    expect(await db.prepare('SELECT id FROM "grant" WHERE scope_type=\'assessment\' AND principal_id IN (\'owner\',\'member\',\'viewer\')').first()).toBeNull();
  });
  it('outsider, anonymous and direct-project-only principals cannot open assessment or stored report', async () => {
    for (const who of ['outsider', 'anonymous', 'participant', 'project_only']) {
      expect((await http('/v2/assessments/' + aid, who)).body.ok).toBe(false);
      expect((await http('/v2/reports/' + reportId, who)).body.ok).toBe(false);
    }
  });
  it('assessment revocation needs a direct grant, including after authority changes before the write', async () => {
    const path = '/v2/assessment/' + aid + '/grants/revoke_target';
    await run("INSERT INTO \"grant\"(id,principal_id,scope_type,scope_id,role,created_at) VALUES('revoke_target','outsider','assessment',?,'member','2026-10-27')", aid);
    await run("INSERT INTO invitation(id,scope_type,scope_id,invitee_hash,token_hash,role,status,created_by,created_at,expires_at) VALUES('revoke_pending','assessment',?,'fixture_invitee','fixture_token','viewer','sent','outsider','2026-10-27','2099-01-01')", aid);
    for(const who of ['member','owner']) {
      expect((await http(path,who,undefined,'DELETE')).body).toMatchObject({ok:false,error:{code:'NOT_AUTHORIZED_AT_SCOPE'}});
    }
    await run("INSERT INTO \"grant\"(id,principal_id,scope_type,scope_id,role,created_at) VALUES('revoke_caller','member','assessment',?,'member','2026-10-27')", aid);
    const original = env.DB;
    for(const change of ['remove','demote']) {
      await run("INSERT INTO \"grant\"(id,principal_id,scope_type,scope_id,role,created_at) VALUES('revoke_caller','member','assessment',?,'member','2026-10-27') ON CONFLICT(id) DO UPDATE SET role='member'", aid);
      let prepared=false,intervened=false;
      env.DB = {prepare(sql:string){if(sql.startsWith('DELETE FROM "grant" WHERE id = ?1'))prepared=true;return db.prepare(sql);},async batch(statements:D1PreparedStatement[]){
        if(prepared && !intervened){intervened=true;await run(change==='remove'?"DELETE FROM \"grant\" WHERE id='revoke_caller'":"UPDATE \"grant\" SET role='viewer' WHERE id='revoke_caller'");}
        return db.batch(statements);
      }} as D1Database;
      try {
        expect((await http(path,'member',undefined,'DELETE')).body).toMatchObject({ok:false,error:{code:'NOT_AUTHORIZED_AT_SCOPE'}});
        expect(intervened).toBe(true);
        expect(await db.prepare("SELECT id FROM \"grant\" WHERE id='revoke_target'").first()).toBeTruthy();
        expect((await db.prepare("SELECT status FROM invitation WHERE id='revoke_pending'").first<any>()).status).toBe('sent');
      } finally {env.DB=original;}
    }
    await run("UPDATE \"grant\" SET role='member' WHERE id='revoke_caller'");
    expect((await http(path,'member',undefined,'DELETE')).body).toMatchObject({ok:true,result:{revoked:true}});
    expect(await db.prepare("SELECT id FROM \"grant\" WHERE id='revoke_target'").first()).toBeNull();
    expect((await db.prepare("SELECT status FROM invitation WHERE id='revoke_pending'").first<any>()).status).toBe('revoked');
    await run("DELETE FROM \"grant\" WHERE id='revoke_caller'");
  });
  it('an older child invitation cannot materialize workspace access, including a grant arriving before the batch', async () => {
    await run("INSERT INTO \"grant\"(id,principal_id,scope_type,scope_id,role,created_at) VALUES('accept_inviter_project','person_mara','project',?,'owner','2026-10-27') ON CONFLICT(principal_id,scope_type,scope_id) DO UPDATE SET role='owner'", pid);
    for(const [scope,id] of [['assessment',aid],['project',pid]]) {
      const iid='before_workspace_'+scope, token='fixture_'+iid;
      await run("INSERT INTO invitation(id,scope_type,scope_id,invitee_hash,token_hash,role,status,created_by,created_at,expires_at) VALUES(?,?,?,?,?,'member','sent','person_mara','2026-10-27','2099-01-01')",iid,scope,id,await sha256('outsider@example.invalid'),await sha256(token));
      const byId='/v2/me/invitations/'+iid+'/accept', byToken='/v2/invitations/'+token+'/accept';
      const previews = new Map<string,any>();
      for (const endpoint of [byId,byToken]) {const preview=await http(endpoint,'outsider',{mode:'dry_run'});expect(preview.body.ok).toBe(true);previews.set(endpoint,preview.body.result.confirm_token);}
      await run("INSERT INTO \"grant\"(id,principal_id,scope_type,scope_id,role,created_at) VALUES('accept_inherited','outsider','workspace','ws_inherited','viewer','2026-10-27')");
      for(const endpoint of [byId,byToken]) {
        expect((await http(endpoint,'outsider',{mode:'dry_run'})).body).toMatchObject({ok:false,error:{code:'NOT_AUTHORIZED_AT_SCOPE'}});
        expect((await http(endpoint,'outsider',{mode:'execute',confirm_token:previews.get(endpoint)})).body).toMatchObject({ok:false,error:{code:'NOT_AUTHORIZED_AT_SCOPE'}});
      }
      expect(await db.prepare('SELECT role FROM "grant" WHERE principal_id=? AND scope_type=? AND scope_id=?').bind('outsider',scope,id).first()).toBeNull();
      expect((await db.prepare('SELECT status FROM invitation WHERE id=?').bind(iid).first<any>()).status).toBe('sent');
      await run("DELETE FROM \"grant\" WHERE id='accept_inherited'");
      expect((await http('/v2/assessments/'+aid,'outsider')).body.ok).toBe(false);
      const original=env.DB;let prepared=false,intervened=false;
      env.DB={prepare(sql:string){if(sql.startsWith('INSERT INTO "grant"'))prepared=true;return db.prepare(sql);},async batch(statements:D1PreparedStatement[]){
        if(prepared && !intervened){intervened=true;await run("INSERT INTO \"grant\"(id,principal_id,scope_type,scope_id,role,created_at) VALUES('accept_inherited','outsider','workspace','ws_inherited','member','2026-10-27')");}
        return db.batch(statements);
      }} as D1Database;
      try {
        expect((await http(byToken,'outsider',{mode:'execute',confirm_token:previews.get(byToken)})).body).toMatchObject({ok:false,error:{code:'NOT_AUTHORIZED_AT_SCOPE'}});
        expect(intervened).toBe(true);
        expect(await db.prepare('SELECT role FROM "grant" WHERE principal_id=? AND scope_type=? AND scope_id=?').bind('outsider',scope,id).first()).toBeNull();
        expect((await db.prepare('SELECT status FROM invitation WHERE id=?').bind(iid).first<any>()).status).toBe('sent');
      } finally {env.DB=original;await run("DELETE FROM \"grant\" WHERE id='accept_inherited'");}
      const preview=await http(byId,'outsider',{mode:'dry_run'});
      expect(preview.body.ok).toBe(true);
      expect((await http(byId,'outsider',{mode:'execute',confirm_token:preview.body.result.confirm_token})).body).toMatchObject({ok:true,result:{granted:true,role:'member'}});
      await run('DELETE FROM "grant" WHERE principal_id=? AND scope_type=? AND scope_id=?','outsider',scope,id);
      await run('DELETE FROM invitation WHERE id=?',iid);
    }
  });
  it('workspace revocation and ungrouping immediately end inherited report access', async () => {
    await run('DELETE FROM "grant" WHERE id=?', 'g_member');
    expect((await http('/v2/assessments/' + aid, 'member')).body.ok).toBe(false);
    expect((await http('/v2/reports/' + reportId, 'member')).body.ok).toBe(false);
    await run('UPDATE project SET workspace_id=NULL WHERE id=?', pid);
    expect((await http('/v2/assessments/' + aid, 'owner')).body.ok).toBe(false);
    expect((await http('/v2/reports/' + reportId, 'owner')).body.ok).toBe(false);
  });
});

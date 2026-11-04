import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { execute } from '../src/dispatch';
import { byId, toolForClass } from '../src/registry';
import type { Ctx, Role } from '../src/handlers/types';

// Synthetic principals enter at the real dispatcher boundary; no account/session credentials or hosted writes.
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'grouping-assessment-authority', modules: true,
  script: "export default {fetch(){return new Response('isolated regression')}}", d1Databases: { DB: 'grouping-assessment-authority' } }] }));
let db: D1Database, sequence = 0;
const at = '2026-10-30T12:30:00.000Z';
const run = (sql: string, ...args: any[]) => db.prepare(sql).bind(...args).run();
function context(actor: string, database = db): Ctx {
  return { db: database, env: { DB: database, SESSION_SECRET: 'synthetic-local-receipts-only', ENVIRONMENT: 'dev' },
    principal: { kind: 'user', id: actor, provisioned: true }, traceId: `tr_group_child_${++sequence}`, now: () => new Date(at), log() {} };
}
function call(actor: string, capability: string, params: any, database = db, mode?: 'dry_run' | 'execute'): Promise<any> {
  return execute(context(actor, database), capability, params, { tool: toolForClass(byId.get(capability)!.class), ...(mode ? { mode } : {}) });
}
async function grant(principal: string, scope: string, id: string, role: Role) {
  const gid = `g_child_${++sequence}`;
  await run('INSERT INTO "grant"(id,principal_id,scope_type,scope_id,role,created_at) VALUES(?,?,?,?,?,?)', gid, principal, scope, id, role, at);
  return gid;
}
async function fixture(children = 2) {
  const tag = `child_${++sequence}`, owner = `${tag}_owner`, member = `${tag}_member`, viewer = `${tag}_viewer`, inheritedOwner = `${tag}_inherited_owner`;
  for (const actor of [owner, member, viewer, inheritedOwner]) await run('INSERT INTO principal(id,email_hash,provisioned,support,created_at) VALUES(?,?,1,0,?)', actor, `${actor}_synthetic`, at);
  const created = await call(owner, 'cap.workspace.create', { name: 'Synthetic workspace' });
  expect(created.ok).toBe(true);
  const wid = created.result.workspace.id, pid = `${tag}_project`, lid = `${tag}_language`, aids: string[] = [];
  await run('INSERT INTO project(id,name,created_at,created_by) VALUES(?,?,?,?)', pid, 'Synthetic project', at, owner);
  await run('INSERT INTO language(id,project_id,code,name,created_at) VALUES(?,?,?,?,?)', lid, pid, 'qaa', 'Synthetic language', at);
  await grant(owner, 'project', pid, 'owner');
  await grant(member, 'workspace', wid, 'member'); await grant(viewer, 'workspace', wid, 'viewer'); await grant(inheritedOwner, 'workspace', wid, 'owner');
  for (let i = 0; i < children; i++) {
    const aid = `${tag}_assessment_${i}`; aids.push(aid);
    await run('INSERT INTO assessment(id,project_id,language_id,name,stage,notes_reflection,created_at) VALUES(?,?,?,?,?,?,?)', aid, pid, lid, 'Synthetic review', 'prepare', 'Private child reflection', at);
  }
  return { owner, member, viewer, inheritedOwner, wid, pid, aids };
}
async function group(f: Awaited<ReturnType<typeof fixture>>, database = db) { return call(f.owner, 'cap.workspace.add_project', { id: f.wid, pid: f.pid }, database); }
async function containment(pid: string) { return (await db.prepare('SELECT workspace_id FROM project WHERE id=?').bind(pid).first<{ workspace_id: string | null }>())!.workspace_id; }

beforeAll(async () => {
  db = await mf.getD1Database('DB');
  const folder = new URL('../migrations/', import.meta.url);
  for (const name of readdirSync(folder).filter(name => name.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL(name, folder), 'utf8').split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');
    for (const statement of sql.split(';\n').map(x => x.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
}, 60000);
afterAll(() => mf.dispose());

describe('grouping cannot launder project ownership into assessment authority', () => {
  it('project reads expose safe project-side grouping eligibility without hidden child identifiers', async () => {
    const f = await fixture();
    const listed = async () => (await call(f.owner, 'cap.project.list', {})).result.projects.find((p: any) => p.id === f.pid);
    const got = async () => (await call(f.owner, 'cap.project.get', { id: f.pid })).result.project;
    expect.soft((await listed()).grouping_eligible).toBe(false);
    expect.soft((await got()).grouping_eligible).toBe(false);
    expect.soft(JSON.stringify(await listed())).not.toContain(f.aids[0]);
    const gids = []; for (const aid of f.aids) gids.push(await grant(f.owner, 'assessment', aid, 'owner'));
    expect.soft((await listed()).grouping_eligible).toBe(true);
    expect.soft((await got()).grouping_eligible).toBe(true);
    await run('UPDATE assessment SET archived_at=? WHERE id=?', at, f.aids[1]);
    await run('DELETE FROM "grant" WHERE id=?', gids[1]);
    expect.soft((await listed()).grouping_eligible).toBe(false);
    expect.soft((await got()).grouping_eligible).toBe(false);
    expect.soft((await group(f)).ok).toBe(false);
    expect(await containment(f.pid)).toBeNull();
  });
  it('empty-project eligibility is direct ownership, not an inherited owner or member role', async () => {
    const f = await fixture(0);
    expect.soft((await call(f.owner, 'cap.project.get', { id: f.pid })).result.project.grouping_eligible).toBe(true);
    expect((await group(f)).ok).toBe(true);
    for (const actor of [f.member, f.viewer, f.inheritedOwner]) {
      expect.soft((await call(actor, 'cap.project.get', { id: f.pid })).result.project.grouping_eligible).toBe(false);
      const list = await call(actor, 'cap.project.list', {});
      expect.soft(list.result.projects.find((p: any) => p.id === f.pid).grouping_eligible).toBe(false);
    }
  });
  it('refuses a direct project owner who self-creates a workspace but has no child grants', async () => {
    const f = await fixture();
    expect((await call(f.owner, 'cap.assessment.get', { id: f.aids[0] })).ok).toBe(false);
    expect.soft(await group(f)).toMatchObject({ ok: false, error: { code: 'NOT_AUTHORIZED_AT_SCOPE' } });
    expect.soft(await containment(f.pid)).toBeNull();
    expect.soft((await call(f.owner, 'cap.assessment.get', { id: f.aids[0] })).ok).toBe(false);
    expect.soft((await call(f.owner, 'cap.assessment.notes.update', { id: f.aids[0], notes_reflection: 'forbidden' })).ok).toBe(false);
    expect.soft((await db.prepare('SELECT notes_reflection FROM assessment WHERE id=?').bind(f.aids[0]).first<any>()).notes_reflection).toBe('Private child reflection');
  });
  it.each(['viewer', 'member', 'partial-owner', 'archived-missing'] as const)('requires direct owner authority over every child: %s', async mode => {
    const f = await fixture();
    await grant(f.owner, 'assessment', f.aids[0], 'owner');
    if (mode === 'viewer' || mode === 'member') await grant(f.owner, 'assessment', f.aids[1], mode);
    if (mode === 'archived-missing') await run('UPDATE assessment SET archived_at=? WHERE id=?', at, f.aids[1]);
    expect.soft(await group(f)).toMatchObject({ ok: false, error: { code: 'NOT_AUTHORIZED_AT_SCOPE' } });
    expect.soft(await containment(f.pid)).toBeNull();
    expect.soft((await call(f.inheritedOwner, 'cap.assessment.get', { id: f.aids[1] })).ok).toBe(false);
  });
  it('allows empty projects and preserves workspace roles after an authorized all-child-owner grouping', async () => {
    const empty = await fixture(0); expect(await group(empty)).toMatchObject({ ok: true, result: { grouped: true } });
    const f = await fixture(); for (const aid of f.aids) await grant(f.owner, 'assessment', aid, 'owner');
    expect(await group(f)).toMatchObject({ ok: true, result: { grouped: true } });
    for (const [actor, role] of [[f.member, 'member'], [f.viewer, 'viewer'], [f.inheritedOwner, 'owner']] as const) {
      expect(await call(actor, 'cap.assessment.get', { id: f.aids[0] })).toMatchObject({ ok: true, result: { assessment: { role } } });
    }
    expect((await call(f.member, 'cap.assessment.notes.update', { id: f.aids[0], notes_reflection: 'Permitted member edit' })).ok).toBe(true);
    expect((await call(f.viewer, 'cap.assessment.notes.update', { id: f.aids[0], notes_reflection: 'Forbidden viewer edit' })).ok).toBe(false);
    // Inherited owner access still cannot become a direct child grant or direct-owner deletion authority.
    expect((await call(f.inheritedOwner, 'cap.grant.invite', { scope: 'assessment', id: f.aids[0], email: 'synthetic@example.invalid', role: 'viewer' }, db, 'dry_run')).ok).toBe(false);
    expect((await call(f.inheritedOwner, 'cap.assessment.delete', { id: f.aids[0] }, db, 'dry_run')).ok).toBe(false);
    expect((await db.prepare('SELECT COUNT(*) AS n FROM "grant" WHERE principal_id=? AND scope_type=\'assessment\'').bind(f.inheritedOwner).first<any>()).n).toBe(0);
  });
  it.each(['revoke', 'demote', 'insert-child'] as const)('rechecks child authority at the actual grouping UPDATE: %s', async change => {
    const f = await fixture(); const grants: string[] = [];
    for (const aid of f.aids) grants.push(await grant(f.owner, 'assessment', aid, 'owner'));
    let intervened = false;
    const wrap = (statement: any): any => new Proxy(statement, { get(target, key) {
      if (key === 'bind') return (...args: any[]) => wrap(target.bind(...args));
      if (key === 'run') return async () => {
        if (!intervened) {
          intervened = true;
          if (change === 'revoke') await run('DELETE FROM "grant" WHERE id=?', grants[1]);
          else if (change === 'demote') await run('UPDATE "grant" SET role=\'member\' WHERE id=?', grants[1]);
          else {
            const child = await db.prepare('SELECT language_id FROM assessment WHERE id=?').bind(f.aids[0]).first<any>();
            await run('INSERT INTO assessment(id,project_id,language_id,name,stage,created_at) VALUES(?,?,?,?,?,?)', `${f.pid}_new_child`, f.pid, child.language_id, 'Intervening private review', 'prepare', at);
          }
        }
        return target.run();
      };
      const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
    } });
    const racingDb = { prepare(sql: string) { const st = db.prepare(sql); return /^UPDATE project SET workspace_id\s*=/.test(sql) ? wrap(st) : st; }, batch: (statements: any[]) => db.batch(statements) } as any;
    expect.soft((await group(f, racingDb)).ok).toBe(false);
    expect(intervened).toBe(true);
    expect.soft(await containment(f.pid)).toBeNull();
    expect.soft((await call(f.inheritedOwner, 'cap.assessment.get', { id: f.aids[1] })).ok).toBe(false);
  });
  it('does not move a project if containment changes after its eligibility read', async () => {
    const f = await fixture(); for (const aid of f.aids) await grant(f.owner, 'assessment', aid, 'owner');
    const other = (await call(f.owner, 'cap.workspace.create', { name: 'Concurrent workspace' })).result.workspace.id;
    expect((await call(f.owner, 'cap.project.get', { id: f.pid })).result.project.grouping_eligible).toBe(true);
    let intervened = false;
    const wrap = (statement: any): any => new Proxy(statement, { get(target, key) {
      if (key === 'bind') return (...args: any[]) => wrap(target.bind(...args));
      if (key === 'run') return async () => { if (!intervened) { intervened = true; await run('UPDATE project SET workspace_id=? WHERE id=?', other, f.pid); } return target.run(); };
      const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
    } });
    const racingDb = { prepare(sql: string) { const st = db.prepare(sql); return /^UPDATE project SET workspace_id\s*=/.test(sql) ? wrap(st) : st; }, batch: (statements: any[]) => db.batch(statements) } as any;
    expect(await group(f, racingDb)).toMatchObject({ ok:false,error:{code:'STAGE_CONFLICT'} });
    expect(intervened).toBe(true); expect(await containment(f.pid)).toBe(other);
  });
  it('cannot use Undo of ungrouping to restore access after direct child authority is lost', async () => {
    const f = await fixture(); const direct = [];
    for (const aid of f.aids) direct.push(await grant(f.owner, 'assessment', aid, 'owner'));
    expect((await group(f)).ok).toBe(true);
    const removed = await call(f.owner, 'cap.workspace.remove_project', { id: f.wid, pid: f.pid });
    expect(removed.ok).toBe(true); expect(removed.receipt.undo_token).toBeTruthy();
    await run('DELETE FROM "grant" WHERE id=?', direct[1]);
    expect.soft(await call(f.owner, 'cap.ops.undo', { token: removed.receipt.undo_token })).toMatchObject({ ok: false, error: { code: 'NOT_AUTHORIZED_AT_SCOPE' } });
    expect.soft(await containment(f.pid)).toBeNull();
    expect.soft((await call(f.inheritedOwner, 'cap.assessment.get', { id: f.aids[1] })).ok).toBe(false);
  });
});

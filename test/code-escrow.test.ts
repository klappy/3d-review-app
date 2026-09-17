import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { execute } from "../src/dispatch";
import { redeem_code } from "../src/handlers/participant";
import { sha256 } from "../src/handlers/common";
import type { Ctx } from "../src/handlers/types";
import { b64url, checkConfirmToken, paramsHash } from "../src/receipt";
import { sourceSha } from "../src/registry";
import { codeHash } from "../src/code-escrow";

const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:"escrow",modules:true,script:"export default { fetch() { return new Response('ok') } }",d1Databases:{DB:"escrow-test-db"}}]}));
afterAll(()=>mf.dispose());
const at=new Date("2026-09-16T20:00:00.000Z");
const secret=b64url(Uint8Array.from({length:32},(_,i)=>i+1)); // synthetic test key only
function statements(db:D1Database,path:string) {
  const sql=readFileSync(new URL(path,import.meta.url),"utf8").split("\n").filter(line=>!line.trimStart().startsWith("--")).join("\n");
  return sql.split(";").map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s));
}

describe("one-time code escrow and confirmed release",()=>{
  it("issues IDs only, binds confirmation, releases one batch once, and supports revoke/redeem",async()=>{
    const db=await mf.getD1Database("DB");
    await db.batch(statements(db,"../migrations/0001_init.sql"));
    await db.batch(statements(db,"../migrations/0002_code_escrow.sql"));
    await db.batch(statements(db,"../migrations/0003_language_archive.sql"));
    await db.batch(statements(db,"../seed/synthetic.sql"));
    let serial=0;
    const logs:unknown[]=[];
    const context=(actor="person_mara",now=at):Ctx=>({env:{DB:db,SESSION_SECRET:"synthetic-confirm-secret",CODE_ESCROW_SECRET:secret},db,principal:{kind:"user",id:actor},traceId:`tr_escrow_${++serial}`,now:()=>now,log:(span,data)=>{logs.push({span,data});}});
    const issue=await execute(context(),"cap.survey.issue_codes",{aid:"assess_tavo_collect",sid:"survey_tavo",count:3},{tool:"write"});
    expect(issue.ok).toBe(true);
    if(!issue.ok) throw new Error("issue failed");
    expect(issue.receipt?.undo_token).toBeDefined(); // batch inverse: handlers/undo.ts revokes the whole batch or nothing
    expect(issue.receipt?.inverse).toBe("cap.survey.revoke_code");
    expect(Object.keys(issue.result).sort()).toEqual(["count","ids"]);
    const ids=issue.result.ids as string[];
    expect(ids).toHaveLength(3);
    const stored=await db.prepare("SELECT id, code_hash, code_ciphertext, code_iv, batch_id FROM access_code WHERE id IN (?, ?, ?) ORDER BY id").bind(...ids).all<{id:string;code_hash:string;code_ciphertext:string;code_iv:string;batch_id:string}>();
    expect(stored.results).toHaveLength(3);
    expect(new Set(stored.results.map(r=>r.code_iv)).size).toBe(3);
    expect(new Set(stored.results.map(r=>r.batch_id)).size).toBe(1);
    const params={aid:"assess_tavo_collect",sid:"survey_tavo",ids};
    const dry=await execute(context(),"cap.survey.export_codes",params,{tool:"danger",mode:"dry_run"});
    expect(dry.ok).toBe(true);
    if(!dry.ok) throw new Error("dry run failed");
    expect(JSON.stringify(dry)).not.toMatch(/"code":/);
    const token=dry.result.confirm_token as string;
    const intent={capability:"cap.survey.export_codes",params_hash:await paramsHash(params),actor:"person_mara",scope:"assessment:assess_tavo_collect",revision:sourceSha};
    expect(await checkConfirmToken("synthetic-confirm-secret",token,{...intent,actor:"person_ion"},at)).toBe("mismatch");
    expect(await checkConfirmToken("synthetic-confirm-secret",token,{...intent,scope:"assessment:other"},at)).toBe("mismatch");
    expect(await checkConfirmToken("synthetic-confirm-secret",token,{...intent,params_hash:await paramsHash({...params,ids:[ids[0]]})},at)).toBe("mismatch");
    expect(await checkConfirmToken("synthetic-confirm-secret",token,intent,new Date(at.getTime()+301_000))).toBe("expired");
    const wrongActor=await execute(context("person_ion"),"cap.survey.export_codes",params,{tool:"danger",mode:"execute",confirm_token:token});
    expect(wrongActor).toMatchObject({ok:false,error:{code:"NOT_AUTHORIZED_AT_SCOPE"}});
    const expired=await execute(context("person_mara",new Date(at.getTime()+301_000)),"cap.survey.export_codes",params,{tool:"danger",mode:"execute",confirm_token:token});
    expect(expired).toMatchObject({ok:false,error:{code:"CONFIRM_EXPIRED"}});
    const released=await execute(context(),"cap.survey.export_codes",params,{tool:"danger",mode:"execute",confirm_token:token});
    expect(released.ok).toBe(true);
    if(!released.ok) throw new Error("release failed");
    const codes=released.result.codes as {id:string;code:string}[];
    expect(codes).toHaveLength(3);
    for(const c of codes) {
      expect(stored.results.find(r=>r.id===c.id)?.code_hash).toBe(await codeHash(secret,c.code));
      expect(stored.results.find(r=>r.id===c.id)?.code_hash).not.toBe(await sha256(c.code));
    }
    const cleared=await db.prepare("SELECT code_ciphertext,code_iv,exported_at FROM access_code WHERE id IN (?, ?, ?)").bind(...ids).all<{code_ciphertext:string|null;code_iv:string|null;exported_at:string|null}>();
    expect(cleared.results.every(r=>r.code_ciphertext===null&&r.code_iv===null&&!!r.exported_at)).toBe(true);
    const exportReceipt=await db.prepare("SELECT confirm_token,prior_state_json FROM receipt WHERE capability = 'cap.survey.export_codes'").first<{confirm_token:string|null;prior_state_json:string}>();
    expect(exportReceipt?.confirm_token).toBeNull();
    expect(exportReceipt?.prior_state_json).not.toContain(token);
    const replay=await execute(context(),"cap.survey.export_codes",params,{tool:"danger",mode:"execute",confirm_token:token});
    expect(replay).toMatchObject({ok:false,error:{code:"STAGE_CONFLICT"}});
    const revoke=await execute(context(),"cap.survey.revoke_code",{aid:"assess_tavo_collect",sid:"survey_tavo",id:codes[0].id},{tool:"write"});
    expect(revoke.ok).toBe(true);
    await expect(redeem_code({...context(),principal:{kind:"anonymous",id:"anon"}},{code:codes[0].code})).rejects.toMatchObject({code:"NOT_FOUND_OR_NOT_VISIBLE"});
    const redeemed=await execute({...context(),principal:{kind:"anonymous",id:"anon"}},"cap.participant.redeem_code",{code:codes[1].code},{tool:"write"});
    expect(redeemed).toMatchObject({ok:true,result:{survey_id:"survey_tavo"}});
    expect(JSON.stringify(redeemed)).not.toContain(codes[1].code);

    const linkToken="synthetic-open-link-sentinel";
    await db.prepare("INSERT INTO invitation (id,scope_type,scope_id,assessment_survey_id,token_hash,role,status,created_by,created_at) VALUES (?, 'survey', ?, ?, ?, 'participant', 'pending', ?, ?)")
      .bind("invite_escrow_test","survey_tavo","survey_tavo",await sha256(linkToken),"person_mara",at.toISOString()).run();
    const opened=await execute({...context(),principal:{kind:"anonymous",id:"anon"}},"cap.participant.open_link",{token:linkToken},{tool:"write"});
    expect(opened).toMatchObject({ok:true,result:{survey_id:"survey_tavo"}});

    const loginEmail="escrow-auth@example.invalid", loginCode="948271";
    await db.prepare("INSERT INTO principal (id,email_hash,created_at) VALUES (?, ?, ?)").bind("person_escrow_login",await sha256(loginEmail),at.toISOString()).run();
    await db.prepare("INSERT INTO login_code (id,email_hash,code_hash,expires_at,created_at) VALUES (?, ?, ?, ?, ?)")
      .bind("lc_escrow_test",await sha256(loginEmail),await sha256(loginCode),Date.now()+600_000,Date.now()).run();
    const login=await execute({...context(),principal:{kind:"anonymous",id:"anon"}},"cap.auth.consume_link",{email:loginEmail,code:loginCode},{tool:"write"});
    expect(login.ok).toBe(true);
    if(!login.ok) throw new Error("login failed");
    const session=login.result.session as string;
    const arbitrary="generic-param-secret-sentinel";
    // logout revokes the credential the caller presented (sessionTokenHash from resolvePrincipal), never a param
    const withSession={...context(),principal:{kind:"user" as const,id:"person_escrow_login",sessionTokenHash:await sha256(session)}};
    const logout=await execute(withSession,"cap.auth.logout",{arbitrary},{tool:"write"});
    expect(logout.ok).toBe(true);

    const firstNotes=await execute(context(),"cap.assessment.notes.update",{id:"assess_tavo_collect",notes_reflection:"Synthetic first reflection"},{tool:"write"});
    expect(firstNotes.ok).toBe(true);
    const secondNotes=await execute(context(),"cap.assessment.notes.update",{id:"assess_tavo_collect",notes_reflection:"Synthetic second reflection"},{tool:"write"});
    expect(secondNotes.ok).toBe(true);
    if(!secondNotes.ok) throw new Error("notes update failed");
    const noteReceipt=await db.prepare("SELECT prior_state_json FROM receipt WHERE id = ?").bind(secondNotes.receipt?.id).first<{prior_state_json:string}>();
    expect(JSON.parse(noteReceipt!.prior_state_json)).toMatchObject({prior:{notes_reflection:"Synthetic first reflection"},params:{id:"assess_tavo_collect"}});
    const undone=await execute(context(),"cap.ops.undo",{token:secondNotes.receipt?.undo_token},{tool:"write"});
    expect(undone.ok).toBe(true);
    const restored=await db.prepare("SELECT notes_reflection FROM assessment WHERE id = ?").bind("assess_tavo_collect").first<{notes_reflection:string}>();
    expect(restored?.notes_reflection).toBe("Synthetic first reflection");
    const selected=await execute(context(),"cap.survey.select",{aid:"assess_tavo_collect",template_id:"tpl_audio",version:1},{tool:"write"});
    expect(selected.ok).toBe(true);
    if(!selected.ok) throw new Error("survey select failed");
    const selectedSid=selected.result.sid as string;
    const undoneSelection=await execute(context(),"cap.ops.undo",{token:selected.receipt?.undo_token},{tool:"write"});
    expect(undoneSelection.ok).toBe(true);
    expect(await db.prepare("SELECT id FROM assessment_survey WHERE id = ?").bind(selectedSid).first()).toBeNull();
    const selectedAgain=await execute(context(),"cap.survey.select",{aid:"assess_tavo_collect",template_id:"tpl_audio",version:1},{tool:"write"});
    expect(selectedAgain.ok).toBe(true);
    if(!selectedAgain.ok) throw new Error("second survey select failed");
    const deselected=await execute(context(),"cap.survey.deselect",{aid:"assess_tavo_collect",sid:selectedAgain.result.sid},{tool:"write"});
    expect(deselected.ok).toBe(true);
    expect(deselected.receipt?.inverse).toBe("none");
    expect(deselected.receipt?.undo_token).toBeUndefined();

    const audit=await db.prepare("SELECT prior_state_json,confirm_token FROM receipt").all<{prior_state_json:string;confirm_token:string|null}>();
    const traces=await db.prepare("SELECT spans_json FROM trace").all<{spans_json:string}>();
    const durable=JSON.stringify({audit:audit.results,traces:traces.results,logs});
    for(const forbidden of [...codes.map(c=>c.code),token,linkToken,loginCode,loginEmail,session,arbitrary]) {
      expect(durable).not.toContain(forbidden);
    }
  },30_000);
});

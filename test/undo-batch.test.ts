import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { execute } from "../src/dispatch";
import type { Ctx } from "../src/handlers/types";
import { b64url } from "../src/receipt";

const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:"undo",modules:true,script:"export default { fetch() { return new Response('ok') } }",d1Databases:{DB:"undo-batch-test-db"}}]}));
afterAll(()=>mf.dispose());
const at=new Date("2026-09-16T21:00:00.000Z");
const secret=b64url(Uint8Array.from({length:32},(_,i)=>i+7)); // synthetic test key only
function statements(db:D1Database,path:string) {
  const sql=readFileSync(new URL(path,import.meta.url),"utf8").split("\n").filter(line=>!line.trimStart().startsWith("--")).join("\n");
  return sql.split(";").map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s));
}

describe("cap.ops.undo on cap.survey.issue_codes revokes the whole batch or nothing",()=>{
  it("revokes every unredeemed code in one shot, consumes the token, refuses once a code is redeemed",async()=>{
    const db=await mf.getD1Database("DB");
    await db.batch(statements(db,"../migrations/0001_init.sql"));
    await db.batch(statements(db,"../migrations/0002_code_escrow.sql"));
    await db.batch(statements(db,"../seed/synthetic.sql"));
    let serial=0;
    const ctx=():Ctx=>({env:{DB:db,SESSION_SECRET:"synthetic-secret",CODE_ESCROW_SECRET:secret},db,principal:{kind:"user",id:"person_mara"},traceId:`tr_undo_${++serial}`,now:()=>at,log:()=>{}});
    const survey={aid:"assess_tavo_collect",sid:"survey_tavo"};
    const issue=await execute(ctx(),"cap.survey.issue_codes",{...survey,count:3},{tool:"write"});
    expect(issue.ok).toBe(true); if(!issue.ok) throw new Error("issue failed");
    const ids=issue.result.ids as string[]; expect(ids).toHaveLength(3);
    const token=issue.receipt?.undo_token; expect(token).toBeDefined();
    const count=async()=>(await db.prepare(`SELECT COUNT(*) AS n FROM access_code WHERE id IN (${ids.map(()=>"?").join(",")})`).bind(...ids).first<{n:number}>())!.n;
    expect(await count()).toBe(3);
    const undone=await execute(ctx(),"cap.ops.undo",{token},{tool:"write"});
    expect(undone.ok).toBe(true); if(!undone.ok) throw new Error("undo failed");
    expect(undone.result.count).toBe(3); expect(undone.result.via).toBe("cap.survey.revoke_code");
    expect(await count()).toBe(0);
    const again=await execute(ctx(),"cap.ops.undo",{token},{tool:"write"});
    expect(again.ok).toBe(false); if(!again.ok) expect(again.error.code).toBe("NOT_FOUND_OR_NOT_VISIBLE"); // one-use token

    // second batch: mark one code redeemed → the batch inverse refuses and deletes nothing
    const issue2=await execute(ctx(),"cap.survey.issue_codes",{...survey,count:2},{tool:"write"});
    if(!issue2.ok) throw new Error("issue2 failed");
    const ids2=issue2.result.ids as string[];
    await db.prepare("UPDATE access_code SET redeemed_at = ? WHERE id = ?").bind(at.toISOString(),ids2[0]).run();
    const refused=await execute(ctx(),"cap.ops.undo",{token:issue2.receipt?.undo_token},{tool:"write"});
    expect(refused.ok).toBe(false); if(!refused.ok) expect(refused.error.code).toBe("INVALID_PARAMS");
    expect((await db.prepare("SELECT COUNT(*) AS n FROM access_code WHERE id IN (?,?)").bind(...ids2).first<{n:number}>())!.n).toBe(2);
  },30_000);
});

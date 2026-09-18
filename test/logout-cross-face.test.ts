import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";

const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:"logout",modules:true,script:"export default { fetch() { return new Response('ok') } }",d1Databases:{DB:"logout-test-db"}}]}));
afterAll(()=>mf.dispose());
function statements(db:D1Database,path:string) {
  const sql=readFileSync(new URL(path,import.meta.url),"utf8").split("\n").filter(l=>!l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s));
}
const http=(env:any,method:string,path:string,bearer?:string)=>app.fetch(new Request("https://t.invalid"+path,{method,headers:bearer?{authorization:`Bearer ${bearer}`}:{}}),env);
const mcp=async(env:any,tool:string,capability:string,bearer?:string)=>{
  const r=await app.fetch(new Request("https://t.invalid/mcp",{method:"POST",headers:{"content-type":"application/json",...(bearer?{authorization:`Bearer ${bearer}`}:{})},
    body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:tool,arguments:{capability,params:{}}}})}),env);
  const j:any=await r.json(); return j.result?.structuredContent ?? j.result ?? j;
};

describe("logout revokes the presented credential at both faces (Astra 5706310753)",()=>{
  it("MCP logout → HTTP and MCP unauthorized; HTTP logout → both unauthorized; a stranger's __token is ignored",async()=>{
    const db=await mf.getD1Database("DB");
    for(const m of ["0001_init.sql","0002_code_escrow.sql","0003_language_archive.sql","0004_pinned_instruments.sql"]) await db.batch(statements(db,`../migrations/${m}`));
    await db.batch(statements(db,"../seed/synthetic.sql"));
    const env:any={DB:db,SESSION_SECRET:"synthetic-test-secret",ENVIRONMENT:"dev"};
    // MCP-first
    const a=await mintSession(env,"person_mara","user");
    expect((await mcp(env,"read","cap.auth.me",a)).ok).toBe(true);
    const out=await mcp(env,"write","cap.auth.logout",a);
    expect(out.ok).toBe(true); expect(out.result.signed_out).toBe(true);
    expect((await mcp(env,"read","cap.auth.me",a)).error?.code).toBe("NOT_AUTHENTICATED");
    expect((await http(env,"GET","/v2/me",a)).status).toBe(401);
    // second logout of a dead token is not a success
    expect((await mcp(env,"write","cap.auth.logout",a)).error?.code).toBe("NOT_AUTHENTICATED");
    // HTTP-first
    const b=await mintSession(env,"person_mara","user");
    expect((await http(env,"DELETE","/v2/auth/session",b)).status).toBe(200);
    expect((await http(env,"GET","/v2/me",b)).status).toBe(401);
    expect((await mcp(env,"read","cap.auth.me",b)).error?.code).toBe("NOT_AUTHENTICATED");
    // a caller cannot revoke someone else's session by naming it
    const victim=await mintSession(env,"person_mara","user"); const attacker=await mintSession(env,"person_mara","user");
    const r=await app.fetch(new Request("https://t.invalid/v2/auth/session",{method:"DELETE",headers:{authorization:`Bearer ${attacker}`,"content-type":"application/json"},body:JSON.stringify({__token:victim})}),env);
    expect(r.status).toBe(200);
    expect((await http(env,"GET","/v2/me",victim)).status).toBe(200);
    expect((await http(env,"GET","/v2/me",attacker)).status).toBe(401);
    // anonymous logout is not a success
    expect((await mcp(env,"write","cap.auth.logout")).error?.code).toBe("NOT_AUTHENTICATED");
  },30_000);
});

import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';

const catalog=JSON.parse(readFileSync(new URL('../contract/capabilities.json',import.meta.url),'utf8')).capabilities;
const yaml=readFileSync(new URL('../contract/openapi.yaml',import.meta.url),'utf8');
const blocks=yaml.split(/(?=      operationId: )/).slice(1);
const value=(s:string)=>s.startsWith('"')?JSON.parse(s):s.startsWith("'")?s.slice(1,-1).replace(/''/g,"'"):s;
it('all served OpenAPI role labels match the capability catalog, including alternate invitation acceptance',()=>{
  for(const block of blocks){
    const id=block.split('\n')[0].split(': ')[1];
    const c=catalog.find((c:any)=>c.id===id.replace(/\.by_invitation_id$/,''));
    if(!c)continue;
    const line=block.match(/^      x-roles: (.*)$/m);
    expect(line, id).toBeTruthy();
    expect(value(line![1]),id).toBe(c.roles);
    expect(value(block.match(/^      summary: (.*)$/m)![1]),id).toContain('roles: '+c.roles);
  }
});
it('OpenAPI carries current direct-grant and inherited-access rules for affected permission operations',()=>{
  const ids=['cap.workspace.add_project','cap.workspace.remove_project','cap.assessment.archive','cap.assessment.unarchive','cap.assessment.delete','cap.grant.invite','cap.grant.revoke_invitation','cap.grant.accept','cap.me.invitations','cap.grant.update_role','cap.grant.revoke','cap.grant.transfer_owner'];
  for(const id of ids){
    const c=catalog.find((c:any)=>c.id===id);
    const matching=blocks.filter(b=>b.startsWith('      operationId: '+id+'\n')||b.startsWith('      operationId: '+id+'.by_invitation_id\n'));
    expect(matching.length,id).toBeGreaterThan(0);
    for(const block of matching)expect(value(block.match(/^      description: (.*)$/m)![1]),id).toContain(c.notes);
  }
});

it('each operation has at most one description so current rules cannot be silently shadowed',()=>{
 for(const block of blocks)expect((block.match(/^      description:/gm)||[]).length,block.split('\n')[0]).toBeLessThanOrEqual(1);
});

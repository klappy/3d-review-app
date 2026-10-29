// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
// @ts-expect-error plain JS context helper
import { setLiveContext } from "../ui-next/src/screens/href.js";
import AccessCodes from "../ui-next/src/screens/actions/AccessCodes.svelte";
// @ts-expect-error plain JS controller
import { issueCodeBatch, codesCsv } from "../ui-next/src/app/access-codes.js";
const issue = { result: { ids: ["code_a", "code_b"] }, receipt: { undo_token: "undo_batch" } };
const preview = { result: { confirm_token: "confirm_batch" } };
const exported = { result: { codes: [{ id: "code_a", code: "AAAA1111" }, { id: "code_b", code: "BBBB2222" }] } };
const undo = { result: { undone: "cap.survey.issue_codes" } };
const args = (request: any, current = async () => true) => ({ aid: "a", sid: "s", count: 2, request, current });
beforeEach(() => { sessionStorage.clear(); setLiveContext(null); history.replaceState(null, "", "/"); });
describe("one-time code escrow controller", () => {
 it("uses actual returned IDs, export preview token and exact codes once", async () => {
  const request = vi.fn().mockResolvedValueOnce(issue).mockResolvedValueOnce(preview).mockResolvedValueOnce(exported);
  const out = await issueCodeBatch(args(request)); expect(out.stage).toBe("shown"); expect(out.codes).toEqual(exported.result.codes);
  expect(request.mock.calls.map(c => c[1].body)).toEqual([{ count: 2 }, { params: { ids: issue.result.ids }, mode: "dry_run" }, { params: { ids: issue.result.ids }, mode: "execute", confirm_token: "confirm_batch" }]);
 });
 it("undoes the entire unseen batch when export is refused", async () => {
  const request = vi.fn().mockResolvedValueOnce(issue).mockRejectedValueOnce({ status: 403 }).mockResolvedValueOnce(undo);
  const out = await issueCodeBatch(args(request)); expect(out.stage).toBe("unseen"); expect(out.batch.undone).toBe(true); expect(out.codes).toBeUndefined(); expect(request).toHaveBeenLastCalledWith('/v2/undo/undo_batch', {method:'POST'});
 });
 it("retains an undo-required batch when undo cannot be confirmed", async () => {
  const request = vi.fn().mockResolvedValueOnce(issue).mockResolvedValueOnce({result:{}}).mockRejectedValueOnce({status:503});
  const out=await issueCodeBatch(args(request));expect(out.batch.undone).toBe(false);expect(out.codes).toBeUndefined();
 });
 it("never exports or displays codes to an identity/route that changed", async () => {
  let checks=0;const request=vi.fn().mockResolvedValueOnce(issue).mockResolvedValueOnce(undo);
  const out=await issueCodeBatch(args(request,async()=>++checks===1));expect(out.stage).toBe('unseen');expect(out.batch.undone).toBe(true);expect(request).toHaveBeenCalledTimes(2);
 });
 it("discards and undoes an export received after identity changes", async () => {
  let checks=0;const request=vi.fn().mockResolvedValueOnce(issue).mockResolvedValueOnce(preview).mockResolvedValueOnce(exported).mockResolvedValueOnce(undo);
  const out=await issueCodeBatch(args(request,async()=>++checks<4));expect(out.codes).toBeUndefined();expect(out.batch.undone).toBe(true);
 });
 it("locks uncertain issuance rather than automatically creating a duplicate batch", async () => {
  const request=vi.fn().mockRejectedValue({status:0});const out=await issueCodeBatch(args(request));expect(out.stage).toBe('uncertain');expect(request).toHaveBeenCalledTimes(1);
 });
 it("rejects incomplete or mismatched export rather than showing a partial batch", async () => {
  const request=vi.fn().mockResolvedValueOnce(issue).mockResolvedValueOnce(preview).mockResolvedValueOnce({result:{codes:[{id:'other',code:'fake'}]}}).mockResolvedValueOnce(undo);
  const out=await issueCodeBatch(args(request));expect(out.codes).toBeUndefined();expect(out.batch.undone).toBe(true);
 });
 it("CSV contains actual code values, escapes fields and prevents spreadsheet formula execution", () => {
  const csv=codesCsv('=unsafe,"label"',exported.result.codes);expect(csv).toContain('"\'=unsafe,""label"""');expect(csv).toContain('"AAAA1111"');expect(csv).toContain('"BBBB2222"');
 });
});
function model(role='owner') {
 return { result: { assessment: {role}, surveys:[{id:'s',state:'selected',template_name:'Translation team'}] } };
}
function client(role='owner') {
 return vi.fn(async (url: string, opts?: any): Promise<any> => {
  if(url==='/v2/me')return {result:{principal:{id:'owner'}}};
  if(url==='/v2/assessments/a')return model(role);
  if(url.endsWith('/export'))return opts.body.mode==='dry_run'?preview:exported;
  if(url.startsWith('/v2/undo/'))return undo;
  return issue;
 });
}
describe('code controls',()=>{
 it('cancel issues nothing; explicit confirmation shows actual codes then undo clears them',async()=>{
  const request=client();const view=render(AccessCodes,{aid:'a',requestFactory:()=>request});
  await view.findByRole('button',{name:'Make access codes'});await fireEvent.input(view.getByLabelText('Number of codes'),{target:{value:'2'}});
  await fireEvent.click(view.getByRole('button',{name:'Make access codes'}));await fireEvent.click(view.getByRole('button',{name:'Cancel',exact:true}));
  expect(request.mock.calls.filter(c=>c[1]?.method==='POST')).toHaveLength(0);
  await fireEvent.click(view.getByRole('button',{name:'Make access codes'}));await fireEvent.click(view.getByRole('button',{name:'Issue and show codes'}));
  await view.findByRole('button',{name:'Download as CSV'});expect((view.getByLabelText('Access codes',{selector:'textarea'}) as HTMLTextAreaElement).value).toBe('AAAA1111\nBBBB2222');
  await fireEvent.click(view.getByRole('button',{name:'Undo this batch'}));await waitFor(()=>expect(view.queryByRole('button',{name:'Download as CSV'})).toBeNull());
 });
 it('viewer sees role refusal and cannot issue',async()=>{
  const request=client('viewer');const view=render(AccessCodes,{aid:'a',requestFactory:()=>request});await view.findByText('Only an owner or member can issue or export access codes.');expect(view.queryByRole('button',{name:'Make access codes'})).toBeNull();expect(request.mock.calls.filter(c=>c[1]?.method==='POST')).toHaveLength(0);
 });
});

it('clears shown code values when the active identity changes',async()=>{
 let user='owner'; const request=client();const base=request.getMockImplementation()!;
 request.mockImplementation((url,opts)=>url==='/v2/me'?Promise.resolve({result:{principal:{id:user}}}):base(url,opts));
 const view=render(AccessCodes,{aid:'a',requestFactory:()=>request});await view.findByRole('button',{name:'Make access codes'});
 await fireEvent.input(view.getByLabelText('Number of codes'),{target:{value:'2'}});await fireEvent.click(view.getByRole('button',{name:'Make access codes'}));await fireEvent.click(view.getByRole('button',{name:'Issue and show codes'}));
 await view.findByRole('button',{name:'Download as CSV'});user='other';await fireEvent.focus(window);
 await waitFor(()=>expect(view.queryByRole('button',{name:'Download as CSV'})).toBeNull());expect(view.queryByRole('textbox',{name:'Access codes'})).toBeNull();
});
it('keeps the already shown values available when undo is refused',async()=>{
 const request=client();const base=request.getMockImplementation()!;request.mockImplementation((url,opts)=>url.startsWith('/v2/undo/')?Promise.reject({status:400}):base(url,opts));
 const view=render(AccessCodes,{aid:'a',requestFactory:()=>request});await view.findByRole('button',{name:'Make access codes'});await fireEvent.input(view.getByLabelText('Number of codes'),{target:{value:'2'}});await fireEvent.click(view.getByRole('button',{name:'Make access codes'}));await fireEvent.click(view.getByRole('button',{name:'Issue and show codes'}));
 await view.findByRole('button',{name:'Undo this batch'});await fireEvent.click(view.getByRole('button',{name:'Undo this batch'}));await view.findByText(/Undo did not go through/);
 expect((view.getByLabelText('Access codes',{selector:'textarea'}) as HTMLTextAreaElement).value).toContain('AAAA1111');
});

it('preserves shown values and undo controls on a transient focus check failure',async()=>{
 let offline=false;const request=client();const base=request.getMockImplementation()!;request.mockImplementation((url,opts)=>url==='/v2/me'&&offline?Promise.reject({status:503}):base(url,opts));
 const view=render(AccessCodes,{aid:'a',requestFactory:()=>request});await view.findByRole('button',{name:'Make access codes'});await fireEvent.input(view.getByLabelText('Number of codes'),{target:{value:'2'}});await fireEvent.click(view.getByRole('button',{name:'Make access codes'}));await fireEvent.click(view.getByRole('button',{name:'Issue and show codes'}));await view.findByRole('button',{name:'Undo this batch'});
 offline=true;await fireEvent.focus(window);await view.findByText(/Your sign-in could not be checked/);expect((view.getByLabelText('Access codes',{selector:'textarea'}) as HTMLTextAreaElement).value).toContain('AAAA1111');expect(view.getByRole('button',{name:'Undo this batch'})).toBeTruthy();
});
it('navigation to Home invalidates pending issue and undoes the unseen batch',async()=>{
 setLiveContext({aid:'a'});let resolveIssue:any;const pending=new Promise(resolve=>{resolveIssue=resolve});const request=client();const base=request.getMockImplementation()!;request.mockImplementation((url,opts)=>url.endsWith('/codes')&&opts?.method==='POST'?pending:base(url,opts));
 const view=render(AccessCodes,{aid:'a',requestFactory:()=>request});await view.findByRole('button',{name:'Make access codes'});await fireEvent.input(view.getByLabelText('Number of codes'),{target:{value:'2'}});await fireEvent.click(view.getByRole('button',{name:'Make access codes'}));await fireEvent.click(view.getByRole('button',{name:'Issue and show codes'}));
 await waitFor(()=>expect(request.mock.calls.some(c=>c[0].endsWith('/codes'))).toBe(true));setLiveContext({});resolveIssue(issue);
 await waitFor(()=>expect(request.mock.calls.some(c=>c[0].startsWith('/v2/undo/'))).toBe(true));expect(view.queryByRole('button',{name:'Download as CSV'})).toBeNull();setLiveContext(null);
});

it('same-review route changes invalidate an unseen batch too',async()=>{
 history.replaceState(null,'','/#/review/a/share');setLiveContext({aid:'a'});let resolveIssue:any;const pending=new Promise(resolve=>{resolveIssue=resolve});const request=client();const base=request.getMockImplementation()!;request.mockImplementation((url,opts)=>url.endsWith('/codes')&&opts?.method==='POST'?pending:base(url,opts));
 const view=render(AccessCodes,{aid:'a',requestFactory:()=>request});await view.findByRole('button',{name:'Make access codes'});await fireEvent.input(view.getByLabelText('Number of codes'),{target:{value:'2'}});await fireEvent.click(view.getByRole('button',{name:'Make access codes'}));await fireEvent.click(view.getByRole('button',{name:'Issue and show codes'}));await waitFor(()=>expect(request.mock.calls.some(c=>c[0].endsWith('/codes'))).toBe(true));
 history.replaceState(null,'','/#/review/a/collect');resolveIssue(issue);await waitFor(()=>expect(request.mock.calls.some(c=>c[0].startsWith('/v2/undo/'))).toBe(true));expect(view.queryByRole('button',{name:'Download as CSV'})).toBeNull();setLiveContext(null);
});

it('treats server5xx issuance outcomes as uncertain rather than claiming refusal',async()=>{
 const request=vi.fn().mockRejectedValue({status:503});const out=await issueCodeBatch(args(request));expect(out.stage).toBe('uncertain');expect(out.message).toContain('Codes may exist');expect(request).toHaveBeenCalledTimes(1);
});

it('same Share component clears and reloads when the review hash changes',async()=>{
 history.replaceState(null,'','/#/review/a/share');setLiveContext({aid:'a'});const request=client();const base=request.getMockImplementation()!;request.mockImplementation((url,opts)=>url==='/v2/assessments/b'?Promise.resolve(model('viewer')):base(url,opts));
 const view=render(AccessCodes,{aid:'a',requestFactory:()=>request});await view.findByRole('button',{name:'Make access codes'});await fireEvent.input(view.getByLabelText('Number of codes'),{target:{value:'2'}});await fireEvent.click(view.getByRole('button',{name:'Make access codes'}));await fireEvent.click(view.getByRole('button',{name:'Issue and show codes'}));await view.findByRole('button',{name:'Download as CSV'});
 history.replaceState(null,'','/#/review/b/share');setLiveContext({aid:'b'});await fireEvent(window,new HashChangeEvent('hashchange'));await view.findByText('Only an owner or member can issue or export access codes.');expect(view.queryByRole('textbox',{name:'Access codes'})).toBeNull();expect(request.mock.calls.some(c=>c[0]==='/v2/assessments/b')).toBe(true);setLiveContext(null);
});
it('keeps the one-time batch when a responsive view is replaced under Share ownership',async()=>{
 const {createAccessCodesState}=await import('../ui-next/src/app/access-codes.svelte.js');
 const request=client();const flow=createAccessCodesState({aid:'a',requestFactory:()=>request});const dispose=flow.mount();
 const view=render(AccessCodes,{controller:flow});await view.findByRole('button',{name:'Make access codes'});await fireEvent.input(view.getByLabelText('Number of codes'),{target:{value:'2'}});await fireEvent.click(view.getByRole('button',{name:'Make access codes'}));await fireEvent.click(view.getByRole('button',{name:'Issue and show codes'}));await view.findByRole('button',{name:'Download as CSV'});
 view.unmount();const phone=render(AccessCodes,{controller:flow});expect((phone.getByLabelText('Access codes',{selector:'textarea'}) as HTMLTextAreaElement).value).toBe('AAAA1111\nBBBB2222');expect(phone.getByText('2 access codes in this batch · shown once. Download or copy before leaving.')).toBeTruthy();
 phone.unmount();dispose();expect(flow.state.codes).toHaveLength(0);
});

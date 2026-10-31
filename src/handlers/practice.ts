/** Unregistered scaffolding. Capability/schema/HTTP/undo integration is separately allocated. */
import type { Handler } from './types';
import { CapError } from '../errors';
import { createPractice, getPractice, listPractice, mutatePractice } from '../practice/store';
function only(params:Record<string,unknown>, keys:string[]) {
  for(const key of Object.keys(params)) if(!keys.includes(key)) throw new CapError('INVALID_PARAMS',`Unknown practice parameter: ${key}`);
}
export const create:Handler=async(ctx,p)=>{only(p,['id','operation_key']);return {result:{receipt:await createPractice(ctx,String(p.id??''),p.operation_key)}};};
export const get:Handler=async(ctx,p)=>{only(p,['id']);return {result:{practice:await getPractice(ctx,String(p.id??''))}};};
export const list:Handler=async(ctx,p)=>{only(p,['cursor']);return {result:await listPractice(ctx,p.cursor)};};
export const mutate=(kind:'simulate'|'reset'|'remove'|'undo'):Handler=>async(ctx,p)=>{
  only(p,['id','expected_revision','operation_key',...(kind==='simulate'?['scenario_id']:kind==='undo'?['operation_id']:[])]);
  return {result:{receipt:await mutatePractice(ctx,String(p.id??''),kind,p.expected_revision,p.operation_key,p.scenario_id??p.operation_id)}};
};

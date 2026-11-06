import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import contract from '../contract/capabilities.json';
const source=readFileSync(new URL('../contract/openapi.yaml',import.meta.url),'utf8');
// These contract nodes are JSON flow objects embedded in YAML. Parse their exact
// published bytes, rather than maintaining a second schema in the test.
function flow(key:string){
 const start=source.indexOf('{',source.indexOf(key)+key.length);let depth=0,quoted=false,escaped=false;
 for(let i=start;i<source.length;i++){const c=source[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&!--depth)return JSON.parse(source.slice(start,i+1));}
 throw Error('Missing contract flow node '+key);
}
export const reportPayloadSchema=flow('    SyntheticReportPayload:');
/** Assertion-keyword evaluator for the published report schemas (no runtime dependency). */
export function schemaErrors(schema:any,value:any,path='$'):string[]{
 if(schema.$ref){if(!/^(openapi.yaml)?#\/components\/schemas\/SyntheticReportPayload$/.test(schema.$ref))throw Error('Unexpected contract reference '+schema.$ref);return schemaErrors(reportPayloadSchema,value,path);}
 const errors:string[]=[];
 for(const kind of ['oneOf','anyOf'] as const)if(schema[kind]){const matches=schema[kind].filter((s:any)=>!schemaErrors(s,value,path).length).length;if(kind==='oneOf'?matches!==1:matches===0)errors.push(path+' '+kind);}
 if(schema.const!==undefined&&!isDeepStrictEqual(schema.const,value))errors.push(path+' const');
 if(schema.enum&&!schema.enum.some((x:any)=>isDeepStrictEqual(x,value)))errors.push(path+' enum');
 const types=Array.isArray(schema.type)?schema.type:[schema.type];
 if(schema.type&&!types.some((t:string)=>t==='null'?value===null:t==='array'?Array.isArray(value):t==='integer'?Number.isInteger(value):t==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):typeof value===t))errors.push(path+' type');
 if(typeof value==='number'){if(schema.minimum!==undefined&&value<schema.minimum)errors.push(path+' minimum');if(schema.maximum!==undefined&&value>schema.maximum)errors.push(path+' maximum');}
 if(typeof value==='string'){if(schema.minLength!==undefined&&Array.from(value).length<schema.minLength)errors.push(path+' minLength');if(schema.maxLength!==undefined&&Array.from(value).length>schema.maxLength)errors.push(path+' maxLength');}
 if(Array.isArray(value)){if(schema.maxItems!==undefined&&value.length>schema.maxItems)errors.push(path+' maxItems');if(schema.uniqueItems&&new Set(value.map(x=>JSON.stringify(x))).size!==value.length)errors.push(path+' uniqueItems');if(schema.items)value.forEach((v,i)=>errors.push(...schemaErrors(schema.items,v,path+'['+i+']')));}
 if(value!==null&&typeof value==='object'&&!Array.isArray(value)){for(const key of schema.required??[])if(!Object.hasOwn(value,key))errors.push(path+'.'+key+' required');for(const [key,v]of Object.entries(value)){if(schema.properties?.[key])errors.push(...schemaErrors(schema.properties[key],v,path+'.'+key));else if(schema.additionalProperties===false)errors.push(path+'.'+key+' additionalProperties');}}
 return errors;
}
export function reportResultErrors(capability:string,result:any){
 const c=contract.capabilities.find(c=>c.id===capability) as any;if(!c)throw Error('Missing capability');
 const route=capability==='cap.report.build'?'  /v2/assessments/{aid}/reports:\n    post:':'  /v2/reports/{id}:\n    get:';
 const op=flow(route),published=op.responses['200'].content['application/json'].schema.properties.result;
 return [...schemaErrors(c.result_schema,result,'capabilities'),...schemaErrors(published,result,'openapi')];
}

/** Audit the amendment-bearing form result against both actual published nodes. */
export function participantFormErrors(result:any){
 const capability=contract.capabilities.find(c=>c.id==='cap.response.form') as any;
 return [...schemaErrors(capability.result_schema,result,'capabilities'),...schemaErrors(flow('      operationId: cap.response.form').properties.result,result,'openapi')];
}

import amendment from './translation-brief-amendment.json';

/** Additive canonical instrument erratum from Decision 25, applied at every read
 * and validation boundary. Stored templates, versions, answers and capture hashes
 * remain immutable. This is one shared definition, never an assessment override.
 * Historical Other remains Other; no inference or answer conversion is performed. */
export const TRANSLATION_BRIEF_SOURCE = amendment.commit;
type Item = {id:string;source_type?:string;options?:{code:string;text:string;source_order?:number}[]};
function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
  return JSON.stringify(value);
}
function sourceQuestion(item:Item,sourceRef:unknown,amended=false):boolean {
  const pin=amendment.canonical_questions[item.id as keyof typeof amendment.canonical_questions];
  if(!pin||sourceRef!==pin.source_ref)return false;
  if(!amended)return canonical(item)===canonical(pin.item);
  // Compare the complete projected item, including all inserted option metadata,
  // ordering and Other's adjusted order; stripping the new option would let
  // altered score/weight/flag/notes masquerade as the canonical amendment.
  const option=amendment.options[item.id as keyof typeof amendment.options];
  const expected={...pin.item,options:pin.item.options.flatMap(o=>o.code==='other'?[option,{...o,source_order:option.source_order+1}]:[o])};
  return canonical(item)===canonical(expected);
}
export function translationBriefItems<T extends Item>(items:T[],sourceRef?:unknown):T[] {
  return items.map(item => {
    if (!Object.hasOwn(amendment.options, item.id)) return item;
    const option = amendment.options[item.id as keyof typeof amendment.options];
    if (!option || !sourceQuestion(item,sourceRef) || !item.options) return item;
    // Only extend the source translation-type question; do not reinterpret a
    // custom item that happens to reuse its identifier or replace a future option.
    const codes = new Set(item.options.map(o=>o.code));
    if (codes.has('no-brief') || !['corresponding','resembling','clarifying','simplifying','other'].every(c=>codes.has(c))) return item;
    const options = item.options.flatMap(o => o.code === 'other'
      ? [{...option}, {...o, source_order: option.source_order + 1}]
      : [o]);
    return {...item, options};
  });
}

/** Provenance for the effective presented instrument, without changing its stored version. */
export function translationBriefSource(items:Item[],sourceRef?:unknown):string|null {
  return items.some(item => Object.hasOwn(amendment.options,item.id) && sourceQuestion(item,sourceRef,true) &&
    item.options?.some(option=>option.code==='no-brief' && option.text===amendment.options[item.id as keyof typeof amendment.options].text))
    ? TRANSLATION_BRIEF_SOURCE : null;
}

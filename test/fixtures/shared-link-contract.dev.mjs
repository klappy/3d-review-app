// DEV-ONLY local contract fixture; not the API; replaced by the real API candidate at integration
// Since the API candidate landed, this file no longer fakes endpoints. It keeps only pure-module
// test inputs: an in-memory sessionStorage and a form shape matching /v2/participate/form's result.

export const FORM = {
  survey_id: 'survey_fixture', assessment: 'asmt_fixture', language: 'qaa', template: { id: 'tpl_team', version: 3 },
  items: [
    { id: 'q1', type: 'scale', text: 'Scale item', scale: { min: 1, max: 5 }, required: true },
    { id: 'q2', type: 'multi', text: 'Multi item', options: [{ code: 'a', label: 'A' }, { code: 'none', label: 'None', exclusive: true }], required: false },
  ],
};

// Independent browser context == independent sessionStorage.
export function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, get size() { return m.size; }, keys: () => [...m.keys()] };
}

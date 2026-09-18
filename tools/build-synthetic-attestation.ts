/** Offline build only. Never imported by production. Run with Node's type stripping. */
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { canonicalJson, parseBoundedJson, domainHash, sha256Bytes } from '../src/report-canonical-json.ts';
import type { Json } from '../src/report-canonical-json.ts';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');

export const SOURCE_PIN = 'f042cde553761a6a7f24132cef7802f956378ee0';
export const CANONICAL_VERSION = '3d-attestation-jcs-v1';
export const INPUT_DIGESTS = Object.freeze({
  answerSets: 'efc50c5ff9139d9235e4323233d27c54059527f92c54099e2f9dbf0cd71df1b5',
  manifest: 'a938ee980306d7a58940a27295d4aecd203239ca21e8ceb90c0d09d719568b62',
  migration: '7280369baba5d2abbd51cf2c8dc23c0e2014f53cf424e77fd99d98460462d91e',
  generator: '9f554ae50557f53e5b1cff59a3361839b9beee40200afd2dd94d6364122153c2',
});
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function refuse(): never { throw new Error('SOURCE_REFUSED'); }
function object(v: unknown): Record<string, any> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) refuse(); return v as Record<string, any>;
}
function str(v: unknown): string { if (typeof v !== 'string' || !v.length) refuse(); return v; }
export async function readPinnedSources(root = ROOT) {
  const paths = { answerSets: 'seed/synthetic/answer-sets.json', manifest: 'seed/synthetic/manifest.json', migration: 'migrations/0004_pinned_instruments.sql', generator: 'tools/synth_seed_sql.py' };
  const raws: Record<string, string> = {};
  for (const [key, path] of Object.entries(paths)) {
    const bytes = await readFile(resolve(root, path));
    if (await sha256Bytes(bytes) !== INPUT_DIGESTS[key as keyof typeof INPUT_DIGESTS]) refuse();
    raws[key] = bytes.toString('utf8');
  }
  // The bootstrap is local-only and exact-pinned too: no ambient database or remote command.
  const bootstrap = ['0001_init.sql', '0002_code_escrow.sql', '0003_language_archive.sql'];
  const digests = ['ba67850c2760adbfdc513c608f3dda482d1e1c9ce45b04daddd72a657122fcc9', 'f11f452682c9c9520f5e7ecd628c110880d2e694400c9a5f3f0f992afef96700', 'feded2ce55495fb96170b4587b24b3199e9b490db6b856c16324a5a5291f4df9'];
  for (let i = 0; i < bootstrap.length; i++) if (await sha256Bytes(await readFile(resolve(root, 'migrations', bootstrap[i]))) !== digests[i]) refuse();
  const manifest = object(parseBoundedJson(raws.manifest, 65536));
  if (canonicalJson(manifest.source) !== canonicalJson({ repo: 'klappy/3d-quality-review', pin: SOURCE_PIN, generator: 'survey-pipeline/run_synthetic_pipeline.py', reads_real_exports: false })) refuse();
  const db = new DatabaseSync(':memory:');
  let templates;
  try {
    for (const name of [...bootstrap, '0004_pinned_instruments.sql']) {
      db.exec(await readFile(resolve(root, 'migrations', name), 'utf8'));
    }
    // Preserve the original JSON transport's plain objects and SQLite scalar values.
    templates = JSON.parse(JSON.stringify(db.prepare('SELECT id,version,name,perspective,source_ref,items_json FROM survey_template WHERE version=2 ORDER BY id').all()));
  } finally { db.close(); }
  const records = parseBoundedJson(raws.answerSets, 4 * 1024 * 1024);
  if (!Array.isArray(records) || records.length !== 425 || !Array.isArray(templates)) refuse();
  return { records, templates };
}
/** Test collision seam exists only in this offline module, never in the runtime verifier. */
export async function buildIndex(records: unknown[], templateRows: unknown[], idDigest = (id: string) => sha256Bytes(new TextEncoder().encode(id))) {
  const forms = new Map<string, { preimage: any; digest: string; items: Map<string, any> }>();
  const templates: any[] = []; const templateBytes = new Map<string, string>();
  let itemCount = 0;
  for (const raw of templateRows) {
    const row = object(raw); if (row.version !== 2) refuse();
    const name = str(row.name); if (forms.has(name)) refuse();
    const items = parseBoundedJson(str(row.items_json), 65536); if (!Array.isArray(items)) refuse();
    const byId = new Map<string, any>();
    for (const rawItem of items) {
      const item = object(rawItem); const id = str(item.id); if (byId.has(id)) refuse();
      if (!['single', 'multi', 'text'].includes(item.type)) refuse();
      const codes = new Set<string>(), texts = new Set<string>();
      if (item.options !== undefined && !Array.isArray(item.options)) refuse();
      for (const o of item.options ?? []) {
        const option = object(o); const code = str(option.code), text = str(option.text);
        if (codes.has(code) || texts.has(text)) refuse(); codes.add(code); texts.add(text);
      }
      byId.set(id, item); itemCount++;
    }
    const preimage = { templateId: str(row.id), templateVersion: row.version, sourceRef: str(row.source_ref), perspective: str(row.perspective), items };
    const bytes = canonicalJson(preimage, 65536); const digest = await domainHash('3d-template-v1', preimage);
    if (templateBytes.has(digest) && templateBytes.get(digest) !== bytes) refuse();
    if (!templateBytes.has(digest)) templates.push({ templateDigest: digest, preimage });
    templateBytes.set(digest, bytes); forms.set(name, { preimage, digest, items: byId });
  }
  const sourceIds = new Set<string>(), responseIds = new Set<string>(), cycles = new Set<string>();
  const entries: any[] = [], captures: any[] = [], collisionAudit: any[] = [];
  let requiredOmissions = 0, optionalNulls = 0;
  for (const raw of records) {
    const r = object(raw); const submission = str(r.submission_id);
    if (sourceIds.has(submission)) refuse(); sourceIds.add(submission);
    const fullDigest = await idDigest(submission); if (!/^[0-9a-f]{64}$/.test(fullDigest)) refuse();
    const responseId = 'resp_syn_' + fullDigest.slice(0, 20);
    if (responseIds.has(responseId)) refuse(); responseIds.add(responseId);
    const t = forms.get(str(r.form_variant)); if (!t) refuse();
    const cycle = str(r.assessment_cycle); cycles.add(cycle);
    const answers: Record<string, Json> = Object.create(null);
    for (const [id, rawAnswer] of Object.entries(object(r.answers))) {
      const item = t.items.get(id); if (!item) refuse();
      const answer = object(rawAnswer); if (!Array.isArray(answer.selected)) refuse();
      if (item.type !== 'multi' && answer.selected.length > 1) refuse();
      const mapped: string[] = [];
      for (const value of answer.selected) {
        if (typeof value !== 'string') refuse();
        if (item.type === 'text') mapped.push(value);
        else {
          const matches = (item.options ?? []).filter((o: any) => o.text === value);
          if (matches.length !== 1) refuse(); mapped.push(matches[0].code);
        }
      }
      if (mapped.length) answers[id] = item.type === 'multi' ? mapped : mapped[0];
    }
    for (const [id, item] of t.items) {
      if (!Object.hasOwn(answers, id)) {
        if (item.required === false) { answers[id] = null; optionalNulls++; }
        else if (item.required === true) requiredOmissions++;
      }
    }
    const answersRaw = canonicalJson(answers, 8192);
    const preimage = {
      responseId, assessmentId: 'assess_syn_' + cycle,
      assessmentSurveyId: 'survey_syn_' + cycle + '_' + t.preimage.templateId.replace(/^tpl_/, ''),
      responseTemplateId: t.preimage.templateId, responseTemplateVersion: 2,
      selectedTemplateId: t.preimage.templateId, selectedTemplateVersion: 2,
      submittedAt: str(r.submitted_at), answersDigest: await domainHash('3d-answer-v1', answers), templateDigest: t.digest,
      canonicalVersion: CANONICAL_VERSION, sourcePin: SOURCE_PIN, manifestDigest: INPUT_DIGESTS.manifest,
    };
    entries.push({ responseDigest: await domainHash('3d-response-v1', preimage), preimage });
    const { answersDigest, templateDigest, canonicalVersion, sourcePin, manifestDigest, ...metadata } = preimage;
    captures.push({ ...metadata, answersRaw, templateRaw: canonicalJson(t.preimage, 65536) });
    collisionAudit.push({ submissionId: submission, fullDigest, responseId });
  }
  templates.sort((a, b) => a.templateDigest < b.templateDigest ? -1 : a.templateDigest > b.templateDigest ? 1 : 0);
  entries.sort((a, b) => a.preimage.responseId < b.preimage.responseId ? -1 : a.preimage.responseId > b.preimage.responseId ? 1 : 0);
  const index = { schemaVersion: '3d-attestation-index-v1', canonicalVersion: CANONICAL_VERSION, mappingVersion: '3d-synthetic-map-v1', sourcePin: SOURCE_PIN, inputDigests: INPUT_DIGESTS, templates, entries };
  const artifact = { indexRoot: await domainHash('3d-index-v1', index), index };
  const bytes = canonicalJson(artifact, 524288) + '\n';
  if (new TextEncoder().encode(bytes).length > 524288) refuse();
  return { artifact, bytes, captures, evidence: { count: records.length, cycles: cycles.size, itemCount, requiredOmissions, optionalNulls, templateCount: templates.length, collisionAudit } };
}
export async function generate(output: string, root = ROOT, testTransform?: (sources: Awaited<ReturnType<typeof readPinnedSources>>) => void, idDigest?: (id: string) => Promise<string>) {
  const sources = await readPinnedSources(root); testTransform?.(sources);
  const result = await buildIndex(sources.records, sources.templates, idDigest);
  if (result.evidence.count !== 425 || result.evidence.cycles !== 34 || result.evidence.itemCount !== 111 || result.evidence.requiredOmissions !== 301) refuse();
  // No output or temporary output exists until every mapping and pin check succeeded.
  const temporary = output + '.tmp-' + process.pid;
  try { await writeFile(temporary, result.bytes, { flag: 'wx' }); await rename(temporary, output); }
  finally { await unlink(temporary).catch(() => undefined); }
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv[2] ? resolve(process.argv[2]) : resolve(ROOT, 'src/synthetic-attestation-index.json');
  const result = await generate(output);
  console.log(JSON.stringify({ ...result.evidence, collisionAudit: undefined, indexRoot: result.artifact.indexRoot, rawBytes: Buffer.byteLength(result.bytes) }));
}

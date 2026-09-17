/** Pure internal attestation. No authorization, query completeness, report or route. */
import artifact from './synthetic-attestation-index.json';
import { ATTESTATION_TRUST as trust } from './synthetic-attestation-trust.js';
import { canonicalJson, parseBoundedJson, domainHash, sha256Bytes } from './report-canonical-json.js';

type Entry = (typeof artifact.index.entries)[number];
export type CaptureRow = Readonly<{
  responseId: string; assessmentId: string; assessmentSurveyId: string;
  responseTemplateId: string; responseTemplateVersion: number;
  selectedTemplateId: string; selectedTemplateVersion: number;
  submittedAt: string; answersRaw: string; templateRaw: string;
}>;
export type AttestationResult =
  | { eligible: true; responseIds: string[]; captureDigest: string }
  | { eligible: false; reason: 'INVALID_INPUT' | 'INDEX_INVALID' | 'IDENTITY_MISMATCH' };
const metadata = ['responseId', 'assessmentId', 'assessmentSurveyId', 'responseTemplateId', 'responseTemplateVersion', 'selectedTemplateId', 'selectedTemplateVersion', 'submittedAt'] as const;
const fields = [...metadata, 'answersRaw', 'templateRaw'];
const encoder = new TextEncoder();
const invalid = (): never => { throw new Error('INVALID_INPUT'); };
function primitiveId(value: unknown): value is string {
  if (typeof value !== 'string' || !value.length || encoder.encode(value).length > 4096) return false;
  try { canonicalJson(value); return true; } catch { return false; }
}
/** Snapshot descriptors before the first await: getters and mutable caller rows never cross it.
 * Internal JS data only. Arbitrary proxies cannot be inspected safely and are not supported. */
function snapshot(expected: string, rows: readonly CaptureRow[]): CaptureRow[] {
  if (!primitiveId(expected) || !Array.isArray(rows) || Object.getPrototypeOf(rows) !== Array.prototype || Object.getOwnPropertySymbols(rows).length || 'toJSON' in rows) invalid();
  const list: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(rows) as unknown as Record<string, PropertyDescriptor>;
  const length = list.length.value as number;
  if (length < 1 || length > 425 || Reflect.ownKeys(list).length !== length + 1) invalid();
  for (const key in rows) if (!Object.hasOwn(rows, key)) invalid();
  const result: CaptureRow[] = []; const ids = new Set<string>();
  for (let i = 0; i < length; i++) {
    const d = list[String(i)]; if (!d || !('value' in d) || !d.enumerable) invalid();
    const row = d.value;
    if (!row || typeof row !== 'object' || ![null, Object.prototype].includes(Object.getPrototypeOf(row)) || Object.getOwnPropertySymbols(row).length || 'toJSON' in row) invalid();
    for (const key in row) if (!Object.hasOwn(row, key)) invalid();
    const descriptors = Object.getOwnPropertyDescriptors(row);
    if (Object.keys(descriptors).length !== fields.length) invalid();
    const copy: Record<string, string | number> = Object.create(null);
    for (const key of fields) {
      const prop = descriptors[key]; if (!prop || !('value' in prop) || !prop.enumerable) invalid();
      const v = prop.value;
      if (key === 'answersRaw' || key === 'templateRaw') {
        const cap = key === 'answersRaw' ? 8192 : 65536;
        if (typeof v !== 'string' || v.length > cap || encoder.encode(v).length > cap) invalid();
      } else if (key === 'responseTemplateVersion' || key === 'selectedTemplateVersion') {
        if (!Number.isSafeInteger(v) || v < 1) invalid();
      } else if (!primitiveId(v)) invalid();
      copy[key] = v;
    }
    if (copy.assessmentId !== expected || ids.has(copy.responseId as string)) invalid();
    ids.add(copy.responseId as string); result.push(Object.freeze(copy) as CaptureRow);
  }
  return Object.freeze(result) as unknown as CaptureRow[];
}
let initialized: Promise<ReadonlyMap<string, Entry>> | undefined;
async function construct(): Promise<ReadonlyMap<string, Entry>> {
  // Read only own data descriptors; never invoke an artifact hook/getter. This is
  // compiled internal data, not an API for arbitrary proxy objects.
  if (!artifact || typeof artifact !== 'object' || ![null, Object.prototype].includes(Object.getPrototypeOf(artifact)) || Object.getOwnPropertySymbols(artifact).length || 'toJSON' in artifact) invalid();
  for (const key in artifact) if (!Object.hasOwn(artifact, key)) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(artifact);
  if (Object.keys(descriptors).sort().join(',') !== 'index,indexRoot') invalid();
  for (const d of Object.values(descriptors)) if (!('value' in d) || !d.enumerable) invalid();
  if (descriptors.indexRoot.value !== trust.indexRoot) invalid();
  // Canonicalize exactly once, then hash those SAME bytes and parse a private snapshot.
  // Reconstruct the exact envelope overhead when enforcing the artifact byte limit.
  const wrapperBytes = encoder.encode('{"index":,"indexRoot":"' + trust.indexRoot + '"}').length;
  const canonicalIndex = canonicalJson(descriptors.index.value, 524288 - wrapperBytes);
  const index = parseBoundedJson(canonicalIndex, 524288 - wrapperBytes) as unknown as typeof artifact.index;
  if (index.sourcePin !== trust.sourcePin || index.schemaVersion !== trust.schemaVersion || index.canonicalVersion !== trust.canonicalVersion || index.mappingVersion !== trust.mappingVersion || canonicalJson(index.inputDigests) !== canonicalJson(trust.inputDigests)) invalid();
  // Full cryptographic recomputation remains mandatory. Artifact self-hashes never
  // select trust; this compares the entire exact preimage with compiled authority.
  if (await sha256Bytes(encoder.encode('3d-index-v1\0' + canonicalIndex)) !== trust.indexRoot) invalid();
  // Exact compiled root binds all schemas and nested digests. Structural checks below
  // prevent accidental duplicate map entries and make the construction invariant explicit.
  if (index.entries.length !== 425 || index.templates.length !== 9) invalid();
  const entries = new Map<string, Entry>();
  let previous = '';
  for (const entry of index.entries) {
    if (entry.preimage.responseId <= previous) invalid();
    previous = entry.preimage.responseId; entries.set(previous, entry);
  }
  return entries;
}
function index(): Promise<ReadonlyMap<string, Entry>> { return initialized ??= construct(); }
/** For local initialization measurement; no trust injection or fixture factory exists. */
export async function initializeAttestation(): Promise<void> { await index(); }
export async function attestCapture(expectedAssessmentId: string, capture: readonly CaptureRow[]): Promise<AttestationResult> {
  let rows: CaptureRow[];
  try { rows = snapshot(expectedAssessmentId, capture); } catch { return { eligible: false, reason: 'INVALID_INPUT' }; }
  let entries: ReadonlyMap<string, Entry>;
  try { entries = await index(); } catch { return { eligible: false, reason: 'INDEX_INVALID' }; }
  try {
    const responses: { responseId: string; responseDigest: string }[] = [];
    for (const row of rows) {
      const expected = entries.get(row.responseId);
      if (!expected || metadata.some(k => row[k] !== expected.preimage[k])) return { eligible: false, reason: 'IDENTITY_MISMATCH' };
      const answers = parseBoundedJson(row.answersRaw, 8192);
      const template = parseBoundedJson(row.templateRaw, 65536);
      if (await domainHash('3d-answer-v1', answers) !== expected.preimage.answersDigest || await domainHash('3d-template-v1', template) !== expected.preimage.templateDigest) return { eligible: false, reason: 'IDENTITY_MISMATCH' };
      responses.push({ responseId: row.responseId, responseDigest: expected.responseDigest });
    }
    responses.sort((a, b) => a.responseId < b.responseId ? -1 : a.responseId > b.responseId ? 1 : 0);
    const captureDigest = await domainHash('3d-capture-v1', {
      schemaVersion: '3d-attestation-capture-v1', canonicalVersion: trust.canonicalVersion,
      indexRoot: trust.indexRoot, assessmentId: expectedAssessmentId, responses,
    });
    return { eligible: true, responseIds: responses.map(r => r.responseId), captureDigest };
  } catch { return { eligible: false, reason: 'INVALID_INPUT' }; }
}

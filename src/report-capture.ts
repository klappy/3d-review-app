/** Internal B1 only: one local-primary D1 capture, no report storage or route. */
import type { Ctx } from './handlers/types.js';
import { attestCapture, type CaptureRow } from './report-attestation.js';
import { canonicalJson } from './report-canonical-json.js';

// Exact approved B1 SQL8e3f51e2. The broader B2 target/report lookup is NOT used.
export const B1_CAPTURE_SQL = `-- PROPOSED, NOT EXECUTED. Common prefix for the separately reviewed query variants.
-- Numbered parameters: ?1 principal_kind, ?2 rid, ?3 aid, ?4 principal_id, ?5 minimum.
-- Values come from internal server code, never accepted as SQL text.
-- B1 capture only: aid selects assessment; rid must be NULL. No report table reference.
-- minimum is the literal server-owned value 'member' or 'viewer'.
WITH target AS (
  SELECT a.id
  FROM assessment a
  WHERE a.archived_at IS NULL
    AND ?1 IN ('user', 'support')
    AND ?2 IS NULL AND a.id = ?3
    AND EXISTS (
      SELECT 1 FROM "grant" g WHERE g.principal_id = ?4
        AND g.scope_type = 'assessment' AND g.scope_id = a.id
        AND (g.role IN ('owner', 'member') OR (?5 = 'viewer' AND g.role = 'viewer')))
), integrity AS (
  SELECT NOT EXISTS (
    SELECT 1 FROM response r
    LEFT JOIN assessment_survey s ON s.id = r.assessment_survey_id
    LEFT JOIN assessment a ON a.id = s.assessment_id
    LEFT JOIN survey_template rt ON rt.id = r.template_id AND rt.version = r.template_version
    LEFT JOIN survey_template st ON st.id = s.template_id AND st.version = s.template_version
    WHERE s.id IS NULL OR a.id IS NULL OR rt.id IS NULL OR st.id IS NULL
  ) AS valid
), members AS (
  SELECT r.id, s.assessment_id, r.assessment_survey_id,
    r.template_id, r.template_version,
    s.template_id AS selected_id, s.template_version AS selected_version,
    r.submitted_at, r.answers_json
  FROM response r
  LEFT JOIN assessment_survey s ON s.id = r.assessment_survey_id
  WHERE s.assessment_id = (SELECT id FROM target)
), template_rows AS (
  SELECT DISTINCT t.id, t.version, t.source_ref, t.perspective, t.items_json
  FROM members r
  LEFT JOIN survey_template t ON t.id = r.selected_id AND t.version = r.selected_version
), response_fragments AS (
  SELECT id,
    CASE WHEN template_id = selected_id AND template_version = selected_version
      AND typeof(id) = 'text' AND length(CAST(id AS BLOB)) BETWEEN 1 AND 256
      AND typeof(assessment_id) = 'text' AND length(CAST(assessment_id AS BLOB)) BETWEEN 1 AND 256
      AND typeof(assessment_survey_id) = 'text' AND length(CAST(assessment_survey_id AS BLOB)) BETWEEN 1 AND 256
      AND typeof(template_id) = 'text' AND length(CAST(template_id AS BLOB)) BETWEEN 1 AND 256
      AND typeof(selected_id) = 'text' AND length(CAST(selected_id AS BLOB)) BETWEEN 1 AND 256
      AND typeof(submitted_at) = 'text' AND length(CAST(submitted_at AS BLOB)) BETWEEN 1 AND 128
      AND typeof(answers_json) = 'text' AND length(CAST(answers_json AS BLOB)) <= 8192
    THEN json_array(id, assessment_id, assessment_survey_id,
      template_id, template_version, selected_id, selected_version,
      submitted_at, answers_json)
    ELSE NULL END AS fragment
  FROM members
), template_fragments AS (
  SELECT id, version,
    CASE WHEN typeof(id) = 'text' AND length(CAST(id AS BLOB)) BETWEEN 1 AND 256
      AND typeof(source_ref) = 'text' AND length(CAST(source_ref AS BLOB)) BETWEEN 1 AND 256
      AND typeof(perspective) = 'text' AND length(CAST(perspective AS BLOB)) BETWEEN 1 AND 256
      AND typeof(items_json) = 'text' AND length(CAST(items_json AS BLOB)) <= 65536
    THEN json_array(id, version, source_ref, perspective, items_json)
    ELSE NULL END AS fragment
  FROM template_rows
), bounds AS (
  SELECT
    (SELECT count(*) FROM response_fragments) AS response_count,
    (SELECT count(*) FROM template_fragments) AS template_count,
    (SELECT count(*) FROM response_fragments WHERE fragment IS NULL)
      + (SELECT count(*) FROM template_fragments WHERE fragment IS NULL) AS invalid_count,
    COALESCE((SELECT sum(length(CAST(fragment AS BLOB)) + 1) FROM response_fragments), 0)
      + COALESCE((SELECT sum(length(CAST(fragment AS BLOB)) + 1) FROM template_fragments), 0)
      + 16 AS packed_byte_upper_bound
), packed AS (
  SELECT target.id AS assessment_id,
    CASE WHEN integrity.valid = 1 AND bounds.response_count BETWEEN 1 AND 425
      AND bounds.template_count BETWEEN 1 AND 9 AND bounds.invalid_count = 0
      AND bounds.packed_byte_upper_bound <= 524288
    THEN json_array(
      json((SELECT json_group_array(json(fragment)) FROM
        (SELECT fragment FROM response_fragments ORDER BY id COLLATE BINARY))),
      json((SELECT json_group_array(json(fragment)) FROM
        (SELECT fragment FROM template_fragments ORDER BY id COLLATE BINARY, version)))
    ) ELSE NULL END AS capture_json
  FROM target CROSS JOIN integrity CROSS JOIN bounds
), captured AS (
  SELECT assessment_id, capture_json FROM packed
  WHERE capture_json IS NOT NULL AND length(CAST(capture_json AS BLOB)) <= 524288
)

SELECT assessment_id, capture_json FROM captured;
`;
// One shared producer retains every B1 membership/authority/packing predicate.
// Only the independently reviewed report-ID target is restored for B2 statements.
const CAPTURE_SUFFIX = '\nSELECT assessment_id, capture_json FROM captured;\n';
const TABLE_FREE_TARGET = '    AND ?2 IS NULL AND a.id = ?3';
const REPORT_TARGET = `    AND ((?2 IS NULL AND a.id = ?3)
      OR (?3 IS NULL AND EXISTS (
        SELECT 1 FROM synthetic_report m WHERE m.id = ?2 AND m.assessment_id = a.id)))`;
function reportCapturePrefix(): string {
  if (!B1_CAPTURE_SQL.endsWith(CAPTURE_SUFFIX) || B1_CAPTURE_SQL.split(TABLE_FREE_TARGET).length !== 2) throw new Error('CAPTURE_SQL_SHAPE');
  return B1_CAPTURE_SQL.slice(0, -CAPTURE_SUFFIX.length).replace(TABLE_FREE_TARGET, REPORT_TARGET)
    .replace('-- B1 capture only: aid selects assessment; rid must be NULL. No report table reference.', '-- B2: aid selects build/list; rid selects report get. Exactly one is set.');
}
export const REPORT_CAPTURE_CTE = reportCapturePrefix();
export const CAPTURE_LIMITS = Object.freeze({ packedBytes: 524288, responses: 425, templates: 9, answersBytes: 8192, itemsBytes: 65536, templateBytes: 65536, idBytes: 256, submittedBytes: 128 });
export type CapturedAssessment = Readonly<{
  assessmentId: string;
  packedCapture: string;
  rows: readonly CaptureRow[];
  responseIds: readonly string[];
  captureDigest: string;
  participant?: boolean;
}>;
export type CaptureResult =
  | { eligible: true; capture: CapturedAssessment }
  | { eligible: false; reason: 'HELD' | 'UNAVAILABLE' };
const encoder = new TextEncoder();
function refuse(): never { throw new Error('CAPTURE_REFUSED'); }
function text(v: unknown, max: number, nonempty = true): string {
  if (typeof v !== 'string' || (nonempty && !v.length) || v.length > max || encoder.encode(v).length > max) refuse();
  return v;
}
function scalar(v: unknown, max: number = CAPTURE_LIMITS.idBytes): string {
  const value = text(v, max); canonicalJson(value); return value;
}
function version(v: unknown): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 1) refuse(); return v;
}
function tuple(v: unknown, length: number): unknown[] {
  if (!Array.isArray(v) || v.length !== length) refuse(); return v;
}
/** Outer SQL envelope contains arrays/primitives only. Answers/items remain raw strings.
 * Object-valued envelope fields always refuse, so duplicate object keys cannot be
 * accepted by ordinary outer parsing. The strict A parser sees embedded raw JSON. */
export function decodePackedCapture(expectedAssessmentId: string, raw: string): readonly CaptureRow[] {
  const aid = scalar(expectedAssessmentId);
  let envelope: unknown;
  try { envelope = JSON.parse(text(raw, CAPTURE_LIMITS.packedBytes)); } catch { return refuse(); }
  const [responses, templates] = tuple(envelope, 2);
  if (!Array.isArray(responses) || responses.length < 1 || responses.length > CAPTURE_LIMITS.responses || !Array.isArray(templates) || templates.length < 1 || templates.length > CAPTURE_LIMITS.templates) refuse();
  const dictionary = new Map<string, string>();
  for (const value of templates) {
    const [id, ver, sourceRef, perspective, items] = tuple(value, 5);
    const templateId = scalar(id), templateVersion = version(ver);
    const key = JSON.stringify([templateId, templateVersion]); if (dictionary.has(key)) refuse();
    const itemsRaw = text(items, CAPTURE_LIMITS.itemsBytes);
    // Do not parse/stringify itemsRaw: that would erase duplicate keys before A.
    const templateRaw = '{"templateId":' + JSON.stringify(templateId) + ',"templateVersion":' + templateVersion + ',"sourceRef":' + JSON.stringify(scalar(sourceRef)) + ',"perspective":' + JSON.stringify(scalar(perspective)) + ',"items":' + itemsRaw + '}';
    text(templateRaw, CAPTURE_LIMITS.templateBytes); dictionary.set(key, templateRaw);
  }
  const ids = new Set<string>(), used = new Set<string>();
  const rows: CaptureRow[] = [];
  for (const value of responses) {
    const [id, assessment, survey, responseTemplate, responseVersion, selectedTemplate, selectedVersion, submitted, answers] = tuple(value, 9);
    const responseId = scalar(id), assessmentId = scalar(assessment), assessmentSurveyId = scalar(survey);
    if (assessmentId !== aid || ids.has(responseId)) refuse(); ids.add(responseId);
    const responseTemplateId = scalar(responseTemplate), selectedTemplateId = scalar(selectedTemplate);
    const responseTemplateVersion = version(responseVersion), selectedTemplateVersion = version(selectedVersion);
    if (responseTemplateId !== selectedTemplateId || responseTemplateVersion !== selectedTemplateVersion) refuse();
    const key = JSON.stringify([selectedTemplateId, selectedTemplateVersion]);
    const templateRaw = dictionary.get(key); if (!templateRaw) refuse(); used.add(key);
    rows.push(Object.freeze({ responseId, assessmentId, assessmentSurveyId, responseTemplateId, responseTemplateVersion, selectedTemplateId, selectedTemplateVersion, submittedAt: scalar(submitted, CAPTURE_LIMITS.submittedBytes), answersRaw: text(answers, CAPTURE_LIMITS.answersBytes), templateRaw }));
  }
  if (used.size !== dictionary.size) refuse();
  return Object.freeze(rows);
}
/** Internal adapter, not authorization: callers must obtain the token in one guarded SELECT. */
export async function attestPackedCapture(expectedAssessmentId: string, raw: string, participant = false): Promise<CaptureResult> {
  try {
    const rows = decodePackedCapture(expectedAssessmentId, raw);
    const result = await attestCapture(expectedAssessmentId, rows, participant === true);
    if (!result.eligible) return { eligible: false, reason: 'HELD' };
    return { eligible: true, capture: Object.freeze({ assessmentId: expectedAssessmentId, packedCapture: raw, rows, responseIds: Object.freeze(result.responseIds), captureDigest: result.captureDigest, participant: participant === true }) };
  } catch { return { eligible: false, reason: 'HELD' }; }
}
/** Server-owned member minimum and null report ID; no caller-supplied SQL/role selector.
 * Authority linearizes at this single SELECT. Later hashing does not reread mutable data.
 * A later store/disclosure operation must establish its own accepted fresh boundary. */
export async function captureForBuild(ctx: Pick<Ctx, 'db' | 'principal'>, assessmentId: string): Promise<CaptureResult> {
  let aid: string, principalId: string;
  try { aid = scalar(assessmentId); principalId = scalar(ctx.principal.id); }
  catch { return { eligible: false, reason: 'HELD' }; }
  const kind = ctx.principal.kind;
  if (kind !== 'user' && kind !== 'support') return { eligible: false, reason: 'HELD' };
  let result: { assessment_id: string; capture_json: string } | null;
  try { result = await ctx.db.prepare(B1_CAPTURE_SQL).bind(kind, null, aid, principalId, 'member').first(); }
  catch { return { eligible: false, reason: 'UNAVAILABLE' }; }
  if (!result || result.assessment_id !== aid) return { eligible: false, reason: 'HELD' };
  return attestPackedCapture(aid, result.capture_json);
}

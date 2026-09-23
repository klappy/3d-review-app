-- PROPOSED, NOT EXECUTED. Common prefix for the separately reviewed query variants.
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

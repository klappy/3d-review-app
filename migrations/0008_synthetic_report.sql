-- Design proposal only. No remote or local database execution has occurred.
-- Proposed publication path0008_synthetic_report.sql remains subject to reservation.
-- No dependency on report_snapshot / migration0005 for this selected pure-render path.
CREATE TABLE synthetic_report (
  id TEXT NOT NULL PRIMARY KEY CHECK(length(CAST(id AS BLOB)) BETWEEN 1 AND 256),
  assessment_id TEXT NOT NULL REFERENCES assessment(id),
  report_key TEXT NOT NULL CHECK(length(report_key)=64 AND report_key NOT GLOB '*[^0-9a-f]*'),
  capture_digest TEXT NOT NULL CHECK(length(capture_digest)=64 AND capture_digest NOT GLOB '*[^0-9a-f]*'),
  index_root TEXT NOT NULL CHECK(length(index_root)=64 AND index_root NOT GLOB '*[^0-9a-f]*'),
  source_pin TEXT NOT NULL CHECK(length(CAST(source_pin AS BLOB)) BETWEEN 1 AND 256),
  scorer_version TEXT NOT NULL CHECK(length(CAST(scorer_version AS BLOB)) BETWEEN 1 AND 256),
  narrative_version TEXT NOT NULL CHECK(length(CAST(narrative_version AS BLOB)) BETWEEN 1 AND 256),
  policy_version TEXT NOT NULL CHECK(length(CAST(policy_version AS BLOB)) BETWEEN 1 AND 256),
  output_schema_version TEXT NOT NULL CHECK(length(CAST(output_schema_version AS BLOB)) BETWEEN 1 AND 256),
  capture_json TEXT NOT NULL CHECK(length(CAST(capture_json AS BLOB))<=524288 AND json_valid(capture_json)),
  payload_json TEXT NOT NULL CHECK(length(CAST(payload_json AS BLOB))<=524288 AND json_valid(payload_json)),
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64 AND payload_sha256 NOT GLOB '*[^0-9a-f]*'),
  created_at TEXT NOT NULL CHECK(length(CAST(created_at AS BLOB)) BETWEEN 1 AND 128),
  created_by TEXT NOT NULL REFERENCES principal(id) CHECK(length(CAST(created_by AS BLOB)) BETWEEN 1 AND 256),
  UNIQUE(assessment_id, report_key)
);
CREATE INDEX synthetic_report_assessment_id_idx ON synthetic_report(assessment_id,id);
CREATE TRIGGER synthetic_report_no_update BEFORE UPDATE ON synthetic_report
BEGIN SELECT RAISE(ABORT,'synthetic reports are immutable'); END;
CREATE TRIGGER synthetic_report_no_delete BEFORE DELETE ON synthetic_report
BEGIN SELECT RAISE(ABORT,'synthetic reports are immutable'); END;

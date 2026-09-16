-- Internal immutable report evidence. This migration does not publish results.
-- Steve's pinned executable scoring is the gold standard; D7 disclosure is held.
CREATE TABLE report_snapshot (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessment(id),
  input_hash TEXT NOT NULL,
  algorithm_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('held', 'incompatible', 'insufficient')),
  evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json)),
  created_at TEXT NOT NULL,
  created_by TEXT REFERENCES principal(id),
  UNIQUE(assessment_id, input_hash, algorithm_version, policy_version)
);
CREATE INDEX report_snapshot_assessment_created_idx ON report_snapshot(assessment_id, created_at);
CREATE TRIGGER report_snapshot_no_update BEFORE UPDATE ON report_snapshot
BEGIN SELECT RAISE(ABORT, 'report snapshots are immutable'); END;
CREATE TRIGGER report_snapshot_no_delete BEFORE DELETE ON report_snapshot
BEGIN SELECT RAISE(ABORT, 'report snapshots are immutable'); END;

-- Passage files and links on an assessment (captain 2026-09-29, Teryl: bring back the Lovable "scripture files").
-- Additive only. A facilitator attaches the passage under review — USFM/SFM/USX text, a PDF, an MP3, or a link (e.g. a
-- sign-language video) — and participants open it from the survey. Files live in R2 (binding PASSAGES); this table holds
-- only metadata. No participant data. A `reference` row names the passage with no file or link ("Genesis 1"): the
-- survey then asks people to read or listen to it first (BCS demo 2026-09-29: instructions, not only uploads).
CREATE TABLE assessment_passage (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessment(id),
  kind TEXT NOT NULL CHECK (kind IN ('file', 'link', 'reference')),
  media TEXT NOT NULL CHECK (media IN ('text', 'pdf', 'audio', 'video', 'link', 'reference')),
  title TEXT NOT NULL,
  reference TEXT,
  filename TEXT,
  content_type TEXT,
  size INTEGER,
  object_key TEXT,
  url TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  archived_at TEXT
);
CREATE INDEX assessment_passage_assessment_idx ON assessment_passage(assessment_id);

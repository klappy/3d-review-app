-- Dynamic translation (captain ruling 2026-09-28). Additive only; 0.22.x ignores all of it.
-- lwc_json: the languages of wider communication (BCP 47 tags from src/languages.ts) a project / an assessment offers
-- participants for machine translation. The participant drop-down is the union (assessment first, then project).
ALTER TABLE project ADD COLUMN lwc_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(lwc_json));
ALTER TABLE assessment ADD COLUMN lwc_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(lwc_json));
-- translation_memory: one row per (target language, English source string). Deterministic: the first stored translation
-- is served forever (INSERT OR IGNORE); a string is never re-translated on read. status follows XLIFF-style review:
-- 'machine' (MT output), 'reviewed' (a speaker checked it), 'rejected' (never served; re-translated on next request).
-- source_hash = SHA-256 hex of the exact English text. No participant data is ever stored here.
CREATE TABLE translation_memory (
  locale TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  source_text TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'machine' CHECK (status IN ('machine', 'reviewed', 'rejected')),
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  PRIMARY KEY (locale, source_hash)
);

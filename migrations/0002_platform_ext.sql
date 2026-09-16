-- 0002_platform_ext (Lane B): confirm tokens for danger two-step; receipt params + undo state; participant fields on session.
CREATE TABLE IF NOT EXISTS confirm_token (token_hash TEXT PRIMARY KEY, capability TEXT NOT NULL, params_hash TEXT NOT NULL, actor TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT);
ALTER TABLE receipt ADD COLUMN params_json TEXT;
ALTER TABLE receipt ADD COLUMN undone_at TEXT;
ALTER TABLE session ADD COLUMN participant_survey_id TEXT;
ALTER TABLE session ADD COLUMN respondent_id TEXT;

-- Local phase-0 code escrow. Apply after 0001_init.sql:
-- wrangler d1 execute 3d-review --local --file=migrations/0002_code_escrow.sql
-- Ciphertext is AES-256-GCM, unique 96-bit IV per code, authenticated to
-- code id + survey id + batch id. No plaintext code is stored in D1.
ALTER TABLE access_code ADD COLUMN batch_id TEXT;
ALTER TABLE access_code ADD COLUMN code_ciphertext TEXT;
ALTER TABLE access_code ADD COLUMN code_iv TEXT;
ALTER TABLE access_code ADD COLUMN exported_at TEXT;
CREATE INDEX access_code_batch_idx ON access_code(batch_id);

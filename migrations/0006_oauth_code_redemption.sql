-- OAuth authorization-code redemption record (fix/pr15-auth-hardening, review #15 finding 2).
-- Ordinal 0006: 0005 is taken by 0005_report_snapshot.sql on review/report-baseline-20260916 (not merged here); this
-- migration is independent of it and must keep its filename when the branches meet.
-- The borrowed provider's "code already used" check is a KV read→check→write and is not atomic: N concurrent
-- POST /token with one code could all mint tokens. The provider's tokenExchangeCallback runs after the PKCE and
-- client checks and before the KV write; the worker inserts one row per grant there with INSERT OR FAIL, so the
-- PRIMARY KEY is the atomic single-use gate. grant_id is 1:1 with the authorization code (one grant per
-- completeAuthorization). Rows are small and only ever inserted; purge by redeemed_at is a recorded follow-up.
CREATE TABLE IF NOT EXISTS oauth_code_redemption (
  grant_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  redeemed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oauth_code_redemption_redeemed_at ON oauth_code_redemption(redeemed_at);

-- Greet by name (captain ruling a1, 2026-10-02): an optional display name on the account, asked at sign-up (skippable),
-- editable later through PATCH /v2/me (cap.auth.me_update), returned by GET /v2/me. Additive only: NULL = no name set,
-- and every screen that greets falls back to the email as before. Production promotion carries this as step 0 (HYGIENE 32).
ALTER TABLE principal ADD COLUMN display_name TEXT;

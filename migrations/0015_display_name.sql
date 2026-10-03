-- Optional account display name (captain ruling a1, 2026-10-02; cookbook
-- work/queued/2026-09-29-3d-train22-audit-backlog/RULING-2026-10-02-greet-alias.md).
-- Additive only. NULL = no name set: every greeting falls back to the email. Written only by the signed-in
-- account itself through cap.me.update (src/handlers/me.ts); trimmed, at most 60 characters, no control characters.
ALTER TABLE principal ADD COLUMN display_name TEXT;

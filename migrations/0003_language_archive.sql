-- cap.language.archive / unarchive (cookbook PR #12 @ 0f44137): the inverse of cap.language.create is archive, never delete.
ALTER TABLE language ADD COLUMN archived_at TEXT;

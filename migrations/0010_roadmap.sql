-- Live roadmap public projection and restricted publishing audit are separate stores.
-- No feedback rows, credentials, actor IDs or restricted references belong in public_json.
CREATE TABLE roadmap_clock (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, generation INTEGER NOT NULL);
INSERT INTO roadmap_clock VALUES (1, 0, 0);
CREATE TABLE roadmap_item (id TEXT PRIMARY KEY, public_json TEXT, updated_seq INTEGER NOT NULL);
CREATE TABLE roadmap_event (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key TEXT NOT NULL UNIQUE,
  item_id TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  public_json TEXT
);
CREATE INDEX roadmap_event_item_seq ON roadmap_event(item_id, seq);
CREATE TABLE roadmap_audit (
  seq INTEGER PRIMARY KEY REFERENCES roadmap_event(seq),
  actor TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  restricted_provenance TEXT NOT NULL
);

-- 0001_init.sql — 3D Review phase 0 schema (SQLite / Cloudflare D1 dialect).
-- Idempotent: every statement is CREATE ... IF NOT EXISTS.
-- Sources: cookbook 03 (scope graph, no inheritance), PRD R6/R12/R13/R14,
-- steve-SCHEMA.md (Project -> Language -> Assessment; rubric/item/provenance ideas kept,
-- app-side scope/grant/invitation/access_code/receipt/trace added — "bend, don't break").
-- Real participant data is never seeded here (CON-PRIV-003).

-- ---------------------------------------------------------------- principals / auth
CREATE TABLE IF NOT EXISTS principal (
  id            TEXT PRIMARY KEY,
  email_hash    TEXT UNIQUE,
  display_name  TEXT,
  provisioned   INTEGER NOT NULL DEFAULT 0,   -- D1: creation authority (workspace/project create)
  support       INTEGER NOT NULL DEFAULT 0,   -- D8: separately provisioned support capability
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
  token_hash    TEXT PRIMARY KEY,
  principal_id  TEXT NOT NULL,
  kind          TEXT NOT NULL,                -- user | participant | support | delegated
  delegated_by  TEXT,                         -- support actor when acts-as (D8), else NULL
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_principal ON session(principal_id);

CREATE TABLE IF NOT EXISTS login_code (
  email_hash    TEXT NOT NULL,
  code_hash     TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  used_at       TEXT,
  PRIMARY KEY (email_hash, code_hash)
);

-- ---------------------------------------------------------------- scope graph
CREATE TABLE IF NOT EXISTS workspace (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  archived_at   TEXT,
  created_at    TEXT NOT NULL,
  created_by    TEXT
);

CREATE TABLE IF NOT EXISTS project (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT REFERENCES workspace(id),   -- nullable: workspace is optional grouping
  name          TEXT NOT NULL,
  organization  TEXT,                            -- metadata only (03: not access structure)
  archived_at   TEXT,
  created_at    TEXT NOT NULL,
  created_by    TEXT
);
CREATE INDEX IF NOT EXISTS idx_project_workspace ON project(workspace_id);

CREATE TABLE IF NOT EXISTS language (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES project(id),
  code          TEXT,                            -- steve: target_language_iso
  name          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_language_project ON language(project_id);

CREATE TABLE IF NOT EXISTS assessment (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES project(id),
  language_id       TEXT NOT NULL REFERENCES language(id),   -- R6 / FIX-07
  name              TEXT NOT NULL,
  purpose           TEXT,
  period            TEXT,                                     -- steve: cycle_date
  format            TEXT,                                     -- steve: medium
  stage             TEXT NOT NULL DEFAULT 'prepare'
                    CHECK (stage IN ('prepare','collect','understand','improve')),
  notes_reflection  TEXT,
  notes_next_steps  TEXT,
  archived_at       TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assessment_project  ON assessment(project_id);
CREATE INDEX IF NOT EXISTS idx_assessment_language ON assessment(language_id);

-- ---------------------------------------------------------------- instrument
-- One row per template@version. items_json carries stable item ids, option codes and
-- sub-dimension groups (steve: rubric_item / rubric_option); scoring_json pins the
-- scoring version and band rules. Provenance per 14: source_ref = repo@commit + manifest hash.
CREATE TABLE IF NOT EXISTS survey_template (
  id            TEXT NOT NULL,
  name          TEXT NOT NULL,
  version       INTEGER NOT NULL,
  perspective   TEXT NOT NULL,                  -- lens: Translation Team | Community | Church
  source_ref    TEXT,
  items_json    TEXT NOT NULL,
  scoring_json  TEXT NOT NULL,
  published_at  TEXT,
  PRIMARY KEY (id, version)
);

CREATE TABLE IF NOT EXISTS assessment_survey (
  id                TEXT PRIMARY KEY,
  assessment_id     TEXT NOT NULL REFERENCES assessment(id),
  template_id       TEXT NOT NULL,
  template_version  INTEGER NOT NULL,
  state             TEXT NOT NULL DEFAULT 'selected'
                    CHECK (state IN ('selected','archived')),
  archived_at       TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assessment_survey_assessment ON assessment_survey(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_survey_template   ON assessment_survey(template_id, template_version);

-- ---------------------------------------------------------------- access
CREATE TABLE IF NOT EXISTS invitation (
  id            TEXT PRIMARY KEY,
  scope_type    TEXT NOT NULL,                  -- workspace | project | assessment | survey
  scope_id      TEXT NOT NULL,
  role          TEXT NOT NULL,                  -- owner | member | viewer | participant
  email_hash    TEXT,                           -- never the address (CON-PRIV-004)
  token_hash    TEXT UNIQUE,
  state         TEXT NOT NULL DEFAULT 'prepared'
                CHECK (state IN ('prepared','sent','accepted','revoked','expired')),
  expires_at    TEXT,
  created_by    TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invitation_scope ON invitation(scope_type, scope_id);

CREATE TABLE IF NOT EXISTS access_code (
  id                    TEXT PRIMARY KEY,
  assessment_survey_id  TEXT NOT NULL REFERENCES assessment_survey(id),
  code_hash             TEXT NOT NULL UNIQUE,
  -- code_value: credential column. Held so cap.survey.export_codes (confirmed effect,
  -- audited) can release the value; cleared on redeem/revoke; never read by any other
  -- handler and never returned by issue_codes. Sealing at rest is an open board item.
  code_value            TEXT,
  state                 TEXT NOT NULL DEFAULT 'issued'
                        CHECK (state IN ('issued','redeemed','revoked')),
  redeemed_at           TEXT,
  exported_at           TEXT,
  created_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_access_code_survey ON access_code(assessment_survey_id);

CREATE TABLE IF NOT EXISTS participant_session (
  id                    TEXT PRIMARY KEY,
  assessment_survey_id  TEXT NOT NULL REFERENCES assessment_survey(id),
  respondent_id         TEXT NOT NULL,          -- pseudonymous; assisted_next rotates it (D6)
  token_hash            TEXT NOT NULL UNIQUE,
  expires_at            TEXT NOT NULL,
  created_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_participant_session_survey ON participant_session(assessment_survey_id);

-- ---------------------------------------------------------------- responses (append-only, R12)
-- No handler issues UPDATE or DELETE on this table except cap.response.purge (danger, D5).
CREATE TABLE IF NOT EXISTS response (
  id                    TEXT PRIMARY KEY,
  assessment_survey_id  TEXT NOT NULL REFERENCES assessment_survey(id),
  respondent_id         TEXT NOT NULL,
  idempotency_key       TEXT NOT NULL UNIQUE,
  answers_json          TEXT NOT NULL,          -- {item_id: value|option_codes[]}; raw evidence
  perspective           TEXT NOT NULL,          -- lens of the presented template
  submitted_at          TEXT NOT NULL,
  source                TEXT NOT NULL DEFAULT 'web',   -- web | assisted | import (steve: mode)
  provenance_json       TEXT NOT NULL           -- template_id@version presented, session, trace, is_mock
);
CREATE INDEX IF NOT EXISTS idx_response_survey     ON response(assessment_survey_id);
CREATE INDEX IF NOT EXISTS idx_response_respondent ON response(respondent_id);

-- ---------------------------------------------------------------- grants (no inheritance, D2)
CREATE TABLE IF NOT EXISTS grant (
  id            TEXT PRIMARY KEY,
  principal_id  TEXT NOT NULL REFERENCES principal(id),
  scope_type    TEXT NOT NULL,                  -- workspace | project | assessment
  scope_id      TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner','member','viewer')),
  created_at    TEXT NOT NULL,
  UNIQUE (principal_id, scope_type, scope_id)
);
CREATE INDEX IF NOT EXISTS idx_grant_scope     ON grant(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_grant_principal ON grant(principal_id);

CREATE TABLE IF NOT EXISTS request (
  id            TEXT PRIMARY KEY,
  principal_id  TEXT NOT NULL REFERENCES principal(id),
  kind          TEXT NOT NULL,                  -- workspace | project | access
  target        TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'open'
                CHECK (state IN ('open','approved','declined','withdrawn')),
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_request_principal ON request(principal_id);

-- ---------------------------------------------------------------- receipts / traces
CREATE TABLE IF NOT EXISTS receipt (
  id                TEXT PRIMARY KEY,
  actor             TEXT NOT NULL,
  capability        TEXT NOT NULL,
  scope_type        TEXT,
  scope_id          TEXT,
  class             TEXT NOT NULL,
  inverse           TEXT,
  undo_token        TEXT,
  confirm_token     TEXT,
  trace_id          TEXT NOT NULL,
  prior_state_json  TEXT,
  at                TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipt_scope ON receipt(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_receipt_actor ON receipt(actor);
CREATE INDEX IF NOT EXISTS idx_receipt_trace ON receipt(trace_id);

CREATE TABLE IF NOT EXISTS trace (
  trace_id      TEXT PRIMARY KEY,
  actor         TEXT,
  spans_json    TEXT NOT NULL,                  -- redacted spans: no answers, addresses, bearers
  at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id            TEXT PRIMARY KEY,
  principal_id  TEXT,
  context       TEXT,
  text          TEXT NOT NULL,
  stripped      INTEGER NOT NULL DEFAULT 0,
  at            TEXT NOT NULL
);

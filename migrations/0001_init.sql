-- Phase 0 D1 schema. Timestamps are ISO-8601 text except session expiry/creation
-- (epoch milliseconds, matching src/auth.ts). No participant PII is required.
PRAGMA foreign_keys = ON;

CREATE TABLE principal (
  id TEXT PRIMARY KEY,
  email_hash TEXT UNIQUE,
  provisioned INTEGER NOT NULL DEFAULT 0 CHECK (provisioned IN (0, 1)),
  support INTEGER NOT NULL DEFAULT 0 CHECK (support IN (0, 1)),
  created_at TEXT NOT NULL
);
CREATE TABLE workspace (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT REFERENCES principal(id)
);
CREATE TABLE project (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspace(id),
  name TEXT NOT NULL,
  organization TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT REFERENCES principal(id)
);
CREATE INDEX project_workspace_idx ON project(workspace_id);
CREATE TABLE language (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id),
  code TEXT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(project_id, name)
);
CREATE INDEX language_project_idx ON language(project_id);
CREATE TABLE assessment (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id),
  language_id TEXT NOT NULL REFERENCES language(id),
  name TEXT NOT NULL,
  purpose TEXT,
  period TEXT,
  format TEXT,
  stage TEXT NOT NULL DEFAULT 'prepare' CHECK (stage IN ('prepare','collect','understand','improve')),
  notes_reflection TEXT,
  notes_next_steps TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT REFERENCES principal(id)
);
CREATE INDEX assessment_project_language_idx ON assessment(project_id, language_id);

-- Each published instrument version is immutable in application logic. The
-- composite key lets a selection bind the exact presented version.
CREATE TABLE survey_template (
  id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  name TEXT NOT NULL,
  perspective TEXT NOT NULL,
  source_ref TEXT,
  items_json TEXT NOT NULL CHECK (json_valid(items_json)),
  scoring_json TEXT NOT NULL CHECK (json_valid(scoring_json)),
  rubric_ref TEXT,
  published_at TEXT,
  PRIMARY KEY(id, version)
);
CREATE TABLE assessment_survey (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessment(id),
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'selected' CHECK (state IN ('selected','archived')),
  collection_status TEXT NOT NULL DEFAULT 'closed' CHECK (collection_status IN ('closed','open')),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(template_id, template_version) REFERENCES survey_template(id, version),
  UNIQUE(assessment_id, template_id, template_version)
);
CREATE INDEX assessment_survey_assessment_idx ON assessment_survey(assessment_id);

CREATE TABLE "grant" (
  id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL REFERENCES principal(id),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('workspace','project','assessment')),
  scope_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','member','viewer')),
  created_at TEXT NOT NULL,
  UNIQUE(principal_id, scope_type, scope_id)
);
CREATE INDEX grant_scope_idx ON "grant"(scope_type, scope_id);
-- Existing policy.ts reads grant_ while domain handlers write "grant".
CREATE VIEW grant_ AS SELECT id, principal_id, scope_type, scope_id, role, created_at FROM "grant";

CREATE TABLE invitation (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  assessment_survey_id TEXT REFERENCES assessment_survey(id),
  invitee_hash TEXT,
  token_hash TEXT UNIQUE,
  role TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT REFERENCES principal(id),
  created_at TEXT NOT NULL,
  expires_at TEXT,
  accepted_at TEXT
);
CREATE INDEX invitation_scope_idx ON invitation(scope_type, scope_id);
CREATE TABLE access_code (
  id TEXT PRIMARY KEY,
  assessment_survey_id TEXT NOT NULL REFERENCES assessment_survey(id),
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  redeemed_at TEXT,
  respondent_id TEXT
);
CREATE TABLE participant_session (
  id TEXT PRIMARY KEY,
  assessment_survey_id TEXT NOT NULL REFERENCES assessment_survey(id),
  respondent_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX participant_session_respondent_idx ON participant_session(assessment_survey_id, respondent_id);

-- Response is append-only: no UPDATE/DELETE in normal paths. Purge is danger
-- and must be recorded separately. Idempotency is scoped to a survey.
CREATE TABLE response (
  id TEXT PRIMARY KEY,
  assessment_survey_id TEXT NOT NULL REFERENCES assessment_survey(id),
  respondent_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  answers_json TEXT NOT NULL CHECK (json_valid(answers_json)),
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  provenance_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(provenance_json)),
  source TEXT NOT NULL DEFAULT 'participant',
  submitted_at TEXT NOT NULL,
  receipt_id TEXT,
  FOREIGN KEY(template_id, template_version) REFERENCES survey_template(id, version),
  UNIQUE(assessment_survey_id, idempotency_key)
);
CREATE INDEX response_survey_respondent_idx ON response(assessment_survey_id, respondent_id);

CREATE TABLE request (
  id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL REFERENCES principal(id),
  kind TEXT NOT NULL,
  scope_type TEXT,
  scope_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT REFERENCES principal(id)
);
CREATE TABLE receipt (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  capability TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  class TEXT NOT NULL,
  inverse TEXT NOT NULL,
  undo_token TEXT UNIQUE,
  confirm_token TEXT,
  trace_id TEXT NOT NULL,
  prior_state_json TEXT CHECK (prior_state_json IS NULL OR json_valid(prior_state_json)),
  at TEXT NOT NULL
);
CREATE INDEX receipt_actor_at_idx ON receipt(actor, at);
CREATE INDEX receipt_trace_idx ON receipt(trace_id);
CREATE TABLE trace (
  trace_id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  spans_json TEXT NOT NULL CHECK (json_valid(spans_json)),
  at TEXT NOT NULL
);
CREATE TABLE session (
  token_hash TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('user','participant','support')),
  delegated_by TEXT,
  participant_survey_id TEXT REFERENCES assessment_survey(id),
  respondent_id TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX session_principal_idx ON session(principal_id);
CREATE TABLE login_code (
  id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  redeemed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  actor TEXT,
  scope_type TEXT,
  scope_id TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

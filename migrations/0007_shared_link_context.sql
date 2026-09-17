-- Additive shared-link context; legacy participant sessions retain NULL association.
ALTER TABLE participant_session ADD COLUMN invitation_id TEXT REFERENCES invitation(id);
CREATE INDEX participant_session_invitation_idx ON participant_session(invitation_id);
CREATE UNIQUE INDEX participant_session_shared_respondent_uq
  ON participant_session(assessment_survey_id, respondent_id)
  WHERE invitation_id IS NOT NULL;
CREATE TABLE shared_response_claim (
  assessment_survey_id TEXT NOT NULL REFERENCES assessment_survey(id),
  respondent_id TEXT NOT NULL,
  client_key_digest TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  response_id TEXT NOT NULL UNIQUE REFERENCES response(id),
  PRIMARY KEY (assessment_survey_id, respondent_id)
);

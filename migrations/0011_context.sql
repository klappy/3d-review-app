-- B09 demographics (Bincy F06; captain ruling ASK F06 option 2). Additive only: optional context around the pinned
-- instrument. response.context_json = the respondent's optional age range / gender; assessment_survey.context_json =
-- the facilitator's group-level context (Kairos Laos fields) for that group. No name fields are ever stored.
ALTER TABLE response ADD COLUMN context_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(context_json));
ALTER TABLE assessment_survey ADD COLUMN context_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(context_json));

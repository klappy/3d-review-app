-- seed/synthetic.sql — ISOLATED SYNTHETIC fixtures for phase 0 demos and tests.
-- Every name, organization, language, person and answer here is invented.
-- No real project, place, participant or pilot data (CON-PRIV-003; 14 §1).
-- Items are minimal placeholders (3 per form) shaped like the pinned instrument
-- (stable ids, sub-dimension groups, 1–5 scale); the real 111-item rubric loads
-- from steve:rubric_csv in a later phase (CON-INT-005).

-- ---------------------------------------------------------------- principals
INSERT OR IGNORE INTO principal (id, email_hash, display_name, provisioned, support, created_at) VALUES
  ('prn_synth_owner',   'a1d5d4103d619e71d41f4d8e96798978615d95d0ed9f31a860b4524840fd8ccf', 'Synthetic Owner',   1, 0, '2026-09-01T09:00:00.000Z'),
  ('prn_synth_member',  '51a24665ea0d4738bf0d94287a8b0faf73626ab4356f775f49f836a4a94f9eb7', 'Synthetic Member',  0, 0, '2026-09-01T09:00:00.000Z'),
  ('prn_synth_support', '12428914246ff32c6d912f519ddc4f5f009b70739e0686fa68f0dab818f75541', 'Synthetic Support', 1, 1, '2026-09-01T09:00:00.000Z');

-- ---------------------------------------------------------------- scope graph
INSERT OR IGNORE INTO workspace (id, name, archived_at, created_at, created_by) VALUES
  ('ws_synth_riverbend', 'Riverbend Translation Partners', NULL, '2026-09-01T09:05:00.000Z', 'prn_synth_owner');

INSERT OR IGNORE INTO project (id, workspace_id, name, organization, archived_at, created_at, created_by) VALUES
  ('prj_synth_north', 'ws_synth_riverbend', 'Northwind Cluster',  'Northwind Scripture Alliance',  NULL, '2026-09-01T09:10:00.000Z', 'prn_synth_owner'),
  ('prj_synth_hal',   'ws_synth_riverbend', 'Halcyon Initiative', 'Halcyon Language Fellowship',   NULL, '2026-09-01T09:12:00.000Z', 'prn_synth_owner');

INSERT OR IGNORE INTO language (id, project_id, code, name) VALUES
  ('lang_synth_kelo',  'prj_synth_north', 'xkl', 'Kelo'),
  ('lang_synth_tamsi', 'prj_synth_hal',   'xtm', 'Tamsi');

INSERT OR IGNORE INTO assessment (id, project_id, language_id, name, purpose, period, format, stage, notes_reflection, notes_next_steps, archived_at, created_at) VALUES
  ('asm_synth_prepare',    'prj_synth_north', 'lang_synth_kelo',  'Kelo — Cycle 3 (planning)',  'Plan the next review cycle',          '2026-Q4', 'written', 'prepare',    NULL, NULL, NULL, '2026-09-10T10:00:00.000Z'),
  ('asm_synth_collect',    'prj_synth_hal',   'lang_synth_tamsi', 'Tamsi — Cycle 1',            'First community review of drafts',    '2026-Q3', 'audio',   'collect',    NULL, NULL, NULL, '2026-08-20T10:00:00.000Z'),
  ('asm_synth_understand', 'prj_synth_north', 'lang_synth_kelo',  'Kelo — Cycle 2',             'Second review after revisions',       '2026-Q2', 'written', 'understand', 'Synthetic reflection note.', 'Synthetic next step.', NULL, '2026-05-01T10:00:00.000Z');

-- ---------------------------------------------------------------- grants (no inheritance)
INSERT OR IGNORE INTO "grant" (id, principal_id, scope_type, scope_id, role, created_at) VALUES
  ('grant_synth_01', 'prn_synth_owner',  'workspace',  'ws_synth_riverbend',   'owner',  '2026-09-01T09:05:00.000Z'),
  ('grant_synth_02', 'prn_synth_owner',  'project',    'prj_synth_north',      'owner',  '2026-09-01T09:10:00.000Z'),
  ('grant_synth_03', 'prn_synth_owner',  'project',    'prj_synth_hal',        'owner',  '2026-09-01T09:12:00.000Z'),
  ('grant_synth_04', 'prn_synth_member', 'project',    'prj_synth_north',      'member', '2026-09-02T09:00:00.000Z'),
  ('grant_synth_05', 'prn_synth_member', 'assessment', 'asm_synth_collect',    'member', '2026-09-02T09:00:00.000Z'),
  ('grant_synth_06', 'prn_synth_member', 'workspace',  'ws_synth_riverbend',   'viewer', '2026-09-02T09:00:00.000Z');

-- ---------------------------------------------------------------- nine templates (14: nine form variants, three lenses)
INSERT OR IGNORE INTO survey_template (id, name, version, perspective, source_ref, items_json, scoring_json, published_at) VALUES
  ('tpl_validation', 'Validation', 1, 'Translation Team', 'klappy/3d-quality-review@f042cde:rubric_csv (placeholder items)',
   '[{"id":"TR-Q1","group":"source-understanding","text":"The team understands the meaning of the source passage.","type":"scale","scale":{"min":1,"max":5}},{"id":"TR-Q2","group":"naturalness","text":"The draft sounds natural to a fluent speaker.","type":"scale","scale":{"min":1,"max":5}},{"id":"TR-Q3","group":"process","text":"Feedback from checking sessions is applied to the draft.","type":"scale","scale":{"min":1,"max":5}}]',
   '{"scoring_version":"placeholder-v0","bands":{"low":[1,2.5],"mid":[2.5,3.75],"high":[3.75,5]},"held":["FIX-T01","FIX-T02","FIX-T03"]}', '2026-09-01T00:00:00.000Z'),
  ('tpl_mid_level', 'Mid-Level', 1, 'Translation Team', 'klappy/3d-quality-review@f042cde:rubric_csv (placeholder items)',
   '[{"id":"ML-Q1","group":"source-understanding","text":"Team members can explain the source meaning in their own words.","type":"scale","scale":{"min":1,"max":5}},{"id":"ML-Q2","group":"process","text":"Consultant feedback is tracked to resolution.","type":"scale","scale":{"min":1,"max":5}},{"id":"ML-Q10","group":"capability","text":"Which capabilities does the team hold? (select all that apply)","type":"multi","max_select":4,"standalone_indicator":true,"options":[{"code":"exegesis","text":"Exegesis","weight":4},{"code":"drafting","text":"Drafting","weight":3},{"code":"checking","text":"Checking","weight":2},{"code":"typesetting","text":"Typesetting","weight":1},{"code":"other","text":"Other","weight":0}]}]',
   '{"scoring_version":"placeholder-v0","bands":{"low":[1,2.5],"mid":[2.5,3.75],"high":[3.75,5]},"held":["FIX-T01","FIX-T02","FIX-T03"]}', '2026-09-01T00:00:00.000Z'),
  ('tpl_written', 'Written', 1, 'Community', 'klappy/3d-quality-review@f042cde:rubric_csv (placeholder items)',
   '[{"id":"CW-Q1","group":"clarity","text":"The written text is easy to read aloud.","type":"scale","scale":{"min":1,"max":5}},{"id":"CW-Q2","group":"naturalness","text":"The wording matches how people speak.","type":"scale","scale":{"min":1,"max":5}},{"id":"CW-Q9","group":"impact-use","text":"People in the community use this text at home.","type":"scale","scale":{"min":1,"max":5}}]',
   '{"scoring_version":"placeholder-v0","bands":{"low":[1,2.5],"mid":[2.5,3.75],"high":[3.75,5]},"held":["FIX-T01","FIX-T02","FIX-T03"]}', '2026-09-01T00:00:00.000Z'),
  ('tpl_audio', 'Audio', 1, 'Community', 'klappy/3d-quality-review@f042cde:rubric_csv (placeholder items)',
   '[{"id":"CA-Q1","group":"clarity","text":"The recording is clear when played on a phone.","type":"scale","scale":{"min":1,"max":5}},{"id":"CA-Q2","group":"naturalness","text":"The voice sounds like a local speaker.","type":"scale","scale":{"min":1,"max":5}},{"id":"CA-Q9","group":"impact-use","text":"People share the recording with others.","type":"scale","scale":{"min":1,"max":5}}]',
   '{"scoring_version":"placeholder-v0","bands":{"low":[1,2.5],"mid":[2.5,3.75],"high":[3.75,5]},"held":["FIX-T01","FIX-T02","FIX-T03"]}', '2026-09-01T00:00:00.000Z'),
  ('tpl_video_sign', 'Video-Sign', 1, 'Community', 'klappy/3d-quality-review@f042cde:rubric_csv (placeholder items)',
   '[{"id":"CV-Q1","group":"clarity","text":"The signing is easy to follow on a small screen.","type":"scale","scale":{"min":1,"max":5}},{"id":"CV-Q2","group":"naturalness","text":"The signing style feels local.","type":"scale","scale":{"min":1,"max":5}},{"id":"CV-Q9","group":"impact-use","text":"People watch the video together.","type":"scale","scale":{"min":1,"max":5}}]',
   '{"scoring_version":"placeholder-v0","bands":{"low":[1,2.5],"mid":[2.5,3.75],"high":[3.75,5]},"held":["FIX-T01","FIX-T02","FIX-T03"]}', '2026-09-01T00:00:00.000Z'),
  ('tpl_consultant', 'Consultant', 1, 'Translation Team', 'klappy/3d-quality-review@f042cde:rubric_csv (placeholder items)',
   '[{"id":"CS-Q1","group":"accuracy","text":"Key terms are rendered consistently.","type":"scale","scale":{"min":1,"max":5}},{"id":"CS-Q2","group":"accuracy","text":"Passages preserve the source meaning.","type":"scale","scale":{"min":1,"max":5}},{"id":"CS-Q3","group":"process","text":"The team responds to consultant notes.","type":"scale","scale":{"min":1,"max":5}}]',
   '{"scoring_version":"placeholder-v0","bands":{"low":[1,2.5],"mid":[2.5,3.75],"high":[3.75,5]},"held":["FIX-T01","FIX-T02","FIX-T03"]}', '2026-09-01T00:00:00.000Z'),
  ('tpl_involved_pastor', 'Involved-Pastor', 1, 'Church', 'klappy/3d-quality-review@f042cde:rubric_csv (placeholder items)',
   '[{"id":"CHIP-Q1","group":"trust","text":"I trust this translation for teaching.","type":"scale","scale":{"min":1,"max":5}},{"id":"CHIP-Q2","group":"trust","text":"Other leaders accept it.","type":"scale","scale":{"min":1,"max":5}},{"id":"CHIP-Q11","group":"impact-use","text":"It is read in gatherings.","type":"scale","scale":{"min":1,"max":5}}]',
   '{"scoring_version":"placeholder-v0","bands":{"low":[1,2.5],"mid":[2.5,3.75],"high":[3.75,5]},"held":["FIX-T01","FIX-T02","FIX-T03"]}', '2026-09-01T00:00:00.000Z'),
  ('tpl_community_pastor', 'Community-Pastor', 1, 'Church', 'klappy/3d-quality-review@f042cde:rubric_csv (placeholder items)',
   '[{"id":"CHCP-Q1","group":"trust","text":"I would recommend it to my congregation.","type":"scale","scale":{"min":1,"max":5}},{"id":"CHCP-Q12","group":"impact-use","text":"Households use it for devotions.","type":"scale","scale":{"min":1,"max":5}},{"id":"CHCP-Q13","group":"impact-use","text":"It is used in teaching children.","type":"scale","scale":{"min":1,"max":5}}]',
   '{"scoring_version":"placeholder-v0","bands":{"low":[1,2.5],"mid":[2.5,3.75],"high":[3.75,5]},"held":["FIX-T01","FIX-T02","FIX-T03"]}', '2026-09-01T00:00:00.000Z'),
  ('tpl_denom_leader', 'Denom-Leader', 1, 'Church', 'klappy/3d-quality-review@f042cde:rubric_csv (placeholder items)',
   '[{"id":"CHDL-Q1","group":"trust","text":"Our body recognizes this translation.","type":"scale","scale":{"min":1,"max":5}},{"id":"CHDL-Q2","group":"trust","text":"It fits our doctrinal expectations.","type":"scale","scale":{"min":1,"max":5}},{"id":"CHDL-Q3","group":"impact-use","text":"We plan to distribute it.","type":"scale","scale":{"min":1,"max":5}}]',
   '{"scoring_version":"placeholder-v0","bands":{"low":[1,2.5],"mid":[2.5,3.75],"high":[3.75,5]},"held":["FIX-T01","FIX-T02","FIX-T03"]}', '2026-09-01T00:00:00.000Z');

-- ---------------------------------------------------------------- assessment surveys
INSERT OR IGNORE INTO assessment_survey (id, assessment_id, template_id, template_version, state, archived_at, created_at) VALUES
  ('srv_synth_u_tt',   'asm_synth_understand', 'tpl_validation',      1, 'selected', NULL, '2026-05-02T10:00:00.000Z'),
  ('srv_synth_u_cw',   'asm_synth_understand', 'tpl_written',         1, 'selected', NULL, '2026-05-02T10:00:00.000Z'),
  ('srv_synth_u_chip', 'asm_synth_understand', 'tpl_involved_pastor', 1, 'selected', NULL, '2026-05-02T10:00:00.000Z'),
  ('srv_synth_c_tt',   'asm_synth_collect',    'tpl_validation',      1, 'selected', NULL, '2026-08-21T10:00:00.000Z');

-- ---------------------------------------------------------------- access codes on the collecting survey (synthetic credentials)
INSERT OR IGNORE INTO access_code (id, assessment_survey_id, code_hash, code_value, state, redeemed_at, exported_at, created_at) VALUES
  ('code_synth_01', 'srv_synth_c_tt', '964bd77970724f0a9db0e1b4c75816b11ad169f7328a0fa55fdfa67f1fcde58f', 'KELO-AA11', 'issued',   NULL, NULL, '2026-08-22T10:00:00.000Z'),
  ('code_synth_02', 'srv_synth_c_tt', '7fa6561f807772d4b99efa02f0f4555d911ebf5c72f730bcefa855a7920de3b7', 'KELO-BB22', 'issued',   NULL, NULL, '2026-08-22T10:00:00.000Z'),
  ('code_synth_03', 'srv_synth_c_tt', 'e26cb1132de23a0383720ffd0b9b65391a44c8ac28c1a801242c0aa9a191c3f0', NULL,       'redeemed', '2026-08-25T10:00:00.000Z', NULL, '2026-08-22T10:00:00.000Z'),
  ('code_synth_04', 'srv_synth_c_tt', '818ec76c22564ebd3131fba65b90379f23e328f83f401b0ecbdb71d3acd9f81f', NULL,       'revoked',  NULL, NULL, '2026-08-22T10:00:00.000Z');

-- one sent participant link on the collecting survey (token 'seed-link-token-1', synthetic)
INSERT OR IGNORE INTO invitation (id, scope_type, scope_id, role, email_hash, token_hash, state, expires_at, created_by, created_at) VALUES
  ('inv_synth_link_01', 'survey', 'srv_synth_c_tt', 'participant', NULL, '383666f42b2633626a764ae6a89900b32f378d5b97ac749c80855146950c5e4f', 'sent', '2027-01-01T00:00:00.000Z', 'prn_synth_owner', '2026-08-22T10:00:00.000Z');

-- ---------------------------------------------------------------- responses (synthetic; is_mock:true in provenance)
-- 12 on the 'understand' assessment: 5 Translation Team, 5 Community, 2 Church -> summary NOT suppressed
-- overall; Church cell (2) is suppressed per perspective.
INSERT OR IGNORE INTO response (id, assessment_survey_id, respondent_id, idempotency_key, answers_json, perspective, submitted_at, source, provenance_json) VALUES
  ('resp_synth_u01', 'srv_synth_u_tt',   'rsp_synth_u01', 'seed-u01', '{"TR-Q1":4,"TR-Q2":4,"TR-Q3":3}', 'Translation Team', '2026-05-10T10:00:00.000Z', 'web',      '{"template_id":"tpl_validation","template_version":1,"is_mock":true,"source_file":"seed/synthetic.sql"}'),
  ('resp_synth_u02', 'srv_synth_u_tt',   'rsp_synth_u02', 'seed-u02', '{"TR-Q1":5,"TR-Q2":4,"TR-Q3":4}', 'Translation Team', '2026-05-10T10:05:00.000Z', 'web',      '{"template_id":"tpl_validation","template_version":1,"is_mock":true,"source_file":"seed/synthetic.sql"}'),
  ('resp_synth_u03', 'srv_synth_u_tt',   'rsp_synth_u03', 'seed-u03', '{"TR-Q1":4,"TR-Q2":3,"TR-Q3":3}', 'Translation Team', '2026-05-10T10:10:00.000Z', 'assisted', '{"template_id":"tpl_validation","template_version":1,"is_mock":true,"source_file":"seed/synthetic.sql"}'),
  ('resp_synth_u04', 'srv_synth_u_tt',   'rsp_synth_u04', 'seed-u04', '{"TR-Q1":3,"TR-Q2":4,"TR-Q3":2}', 'Translation Team', '2026-05-10T10:15:00.000Z', 'assisted', '{"template_id":"tpl_validation","template_version":1,"is_mock":true,"source_file":"seed/synthetic.sql"}'),
  ('resp_synth_u05', 'srv_synth_u_tt',   'rsp_synth_u05', 'seed-u05', '{"TR-Q1":4,"TR-Q2":5,"TR-Q3":3}', 'Translation Team', '2026-05-10T10:20:00.000Z', 'web',      '{"template_id":"tpl_validation","template_version":1,"is_mock":true,"source_file":"seed/synthetic.sql"}'),
  ('resp_synth_u06', 'srv_synth_u_cw',   'rsp_synth_u06', 'seed-u06', '{"CW-Q1":3,"CW-Q2":2,"CW-Q9":2}', 'Community',        '2026-05-11T10:00:00.000Z', 'web',      '{"template_id":"tpl_written","template_version":1,"is_mock":true,"source_file":"seed/synthetic.sql"}'),
  ('resp_synth_u07', 'srv_synth_u_cw',   'rsp_synth_u07', 'seed-u07', '{"CW-Q1":4,"CW-Q2":3,"CW-Q9":2}', 'Community',        '2026-05-11T10:05:00.000Z', 'web',      '{"template_id":"tpl_written","template_version":1,"is_mock":true,"source_file":"seed/synthetic.sql"}'),
  ('resp_synth_u08', 'srv_synth_u_cw',   'rsp_synth_u08', 'seed-u08', '{"CW-Q1":2,"CW-Q2":2,"CW-Q9":1}', 'Community',        '2026-05-11T10:10:00.000Z', 'web',      '{"template_id":"tpl_written","template_version":1,"is_mock":true,"source_file":"seed/synthetic.sql"}'),
  ('resp_synth_u09', 'srv_synth_u_cw',   'rsp_synth_u09', 'seed-u09', '{"CW-Q1":3,"CW-Q2":3,"CW-Q9":3}', 'Community',        '2026-05-11T10:15:00.000Z', 'assisted', '{"template_id":"tpl_written","template_version":1,"is_mock":true,"source_file":"seed/synthetic.sql"}'),
  ('resp_synth_u10', 'srv_synth_u_cw',   'rsp_synth_u10', 'seed-u10', '{"CW-Q1":4,"CW-Q2":4,"CW-Q9":2}', 'Community',        '2026-05-11T10:20:00.000Z', 'web',      '{"template_id":"tpl_written","template_version":1,"is_mock":true,"source_file":"seed/synthetic.sql"}'),
  ('resp_synth_u11', 'srv_synth_u_chip', 'rsp_synth_u11', 'seed-u11', '{"CHIP-Q1":5,"CHIP-Q2":4,"CHIP-Q11":4}', 'Church',     '2026-05-12T10:00:00.000Z', 'web',      '{"template_id":"tpl_involved_pastor","template_version":1,"is_mock":true,"source_file":"seed/synthetic.sql"}'),
  ('resp_synth_u12', 'srv_synth_u_chip', 'rsp_synth_u12', 'seed-u12', '{"CHIP-Q1":4,"CHIP-Q2":4,"CHIP-Q11":5}', 'Church',     '2026-05-12T10:05:00.000Z', 'web',      '{"template_id":"tpl_involved_pastor","template_version":1,"is_mock":true,"source_file":"seed/synthetic.sql"}');

-- 2 on the 'collect' assessment -> suppressed (below D7-held working threshold of 5)
INSERT OR IGNORE INTO response (id, assessment_survey_id, respondent_id, idempotency_key, answers_json, perspective, submitted_at, source, provenance_json) VALUES
  ('resp_synth_c01', 'srv_synth_c_tt', 'rsp_synth_c01', 'seed-c01', '{"TR-Q1":3,"TR-Q2":3,"TR-Q3":3}', 'Translation Team', '2026-08-25T10:00:00.000Z', 'web', '{"template_id":"tpl_validation","template_version":1,"is_mock":true,"source_file":"seed/synthetic.sql"}'),
  ('resp_synth_c02', 'srv_synth_c_tt', 'rsp_synth_c02', 'seed-c02', '{"TR-Q1":4,"TR-Q2":2,"TR-Q3":3}', 'Translation Team', '2026-08-26T10:00:00.000Z', 'web', '{"template_id":"tpl_validation","template_version":1,"is_mock":true,"source_file":"seed/synthetic.sql"}');

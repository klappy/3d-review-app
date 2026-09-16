-- Invented demonstration identities and languages only; no real participants.
PRAGMA foreign_keys = ON;
INSERT INTO principal (id,email_hash,provisioned,support,created_at) VALUES
 -- SHA-256(lowercase('demo.owner@example.invalid')): local-only reserved-domain sign-in fixture.
 ('person_mara', 'd18a316e892d81bd12c1e2178a94eb8005c0ee9dffe74525c11ac25cd57e5cf5', 1, 0, '2026-09-16T12:00:00.000Z'),
 ('person_ion', 'synthetic_hash_ion', 0, 0, '2026-09-16T12:00:00.000Z');
INSERT INTO workspace (id,name,created_at,created_by) VALUES
 ('ws_cedar','Cedar Workshop','2026-09-16T12:00:00.000Z','person_mara');
INSERT INTO project (id,workspace_id,name,organization,created_at,created_by) VALUES
 ('proj_rill','ws_cedar','Rill Project','Invented Field Lab','2026-09-16T12:00:00.000Z','person_mara'),
 ('proj_aster','ws_cedar','Aster Project','Invented Field Lab','2026-09-16T12:00:00.000Z','person_mara');
INSERT INTO language (id,project_id,code,name,created_at) VALUES
 ('lang_tavo','proj_rill','qaa','Tavo (invented)','2026-09-16T12:00:00.000Z'),
 ('lang_melo','proj_aster','qab','Melo (invented)','2026-09-16T12:00:00.000Z');
INSERT INTO assessment (id,project_id,language_id,name,purpose,stage,created_at,created_by) VALUES
 ('assess_tavo_prepare','proj_rill','lang_tavo','Tavo readiness','Synthetic preparation','prepare','2026-09-16T12:00:00.000Z','person_mara'),
 ('assess_tavo_collect','proj_rill','lang_tavo','Tavo collection','Synthetic collection','collect','2026-09-16T12:00:00.000Z','person_mara'),
 ('assess_melo_understand','proj_aster','lang_melo','Melo review','Synthetic results','understand','2026-09-16T12:00:00.000Z','person_mara');
INSERT INTO survey_template (id,version,name,perspective,source_ref,items_json,scoring_json,published_at) VALUES
 ('tpl_validation',1,'Validation','Translation Team','synthetic-placeholder','[{"id":"Q1","group":"clarity","text":"Is the sample clear?","type":"scale","scale":{"min":1,"max":5}}]','{"status":"held"}','2026-09-16T12:00:00.000Z'),
 ('tpl_mid_level',1,'Mid-Level','Translation Team','synthetic-placeholder','[{"id":"Q1","group":"clarity","text":"Is the sample clear?","type":"scale","scale":{"min":1,"max":5}}]','{"status":"held"}','2026-09-16T12:00:00.000Z'),
 ('tpl_written',1,'Written','Community','synthetic-placeholder','[{"id":"Q1","group":"clarity","text":"Is the sample clear?","type":"scale","scale":{"min":1,"max":5}}]','{"status":"held"}','2026-09-16T12:00:00.000Z'),
 ('tpl_audio',1,'Audio','Community','synthetic-placeholder','[{"id":"Q1","group":"clarity","text":"Is the sample clear?","type":"scale","scale":{"min":1,"max":5}}]','{"status":"held"}','2026-09-16T12:00:00.000Z'),
 ('tpl_video_sign',1,'Video-Sign','Community','synthetic-placeholder','[{"id":"Q1","group":"clarity","text":"Is the sample clear?","type":"scale","scale":{"min":1,"max":5}}]','{"status":"held"}','2026-09-16T12:00:00.000Z'),
 ('tpl_consultant',1,'Consultant','Translation Team','synthetic-placeholder','[{"id":"Q1","group":"clarity","text":"Is the sample clear?","type":"scale","scale":{"min":1,"max":5}}]','{"status":"held"}','2026-09-16T12:00:00.000Z'),
 ('tpl_involved_pastor',1,'Involved-Pastor','Church','synthetic-placeholder','[{"id":"Q1","group":"clarity","text":"Is the sample clear?","type":"scale","scale":{"min":1,"max":5}}]','{"status":"held"}','2026-09-16T12:00:00.000Z'),
 ('tpl_community_pastor',1,'Community-Pastor','Church','synthetic-placeholder','[{"id":"Q1","group":"clarity","text":"Is the sample clear?","type":"scale","scale":{"min":1,"max":5}}]','{"status":"held"}','2026-09-16T12:00:00.000Z'),
 ('tpl_denom_leader',1,'Denom-Leader','Church','synthetic-placeholder','[{"id":"Q1","group":"clarity","text":"Is the sample clear?","type":"scale","scale":{"min":1,"max":5}}]','{"status":"held"}','2026-09-16T12:00:00.000Z');
INSERT INTO assessment_survey (id,assessment_id,template_id,template_version,state,collection_status,created_at) VALUES
 ('survey_tavo','assess_tavo_collect','tpl_validation',1,'selected','open','2026-09-16T12:00:00.000Z'),
 ('survey_melo','assess_melo_understand','tpl_written',1,'selected','closed','2026-09-16T12:00:00.000Z');
INSERT INTO "grant" (id,principal_id,scope_type,scope_id,role,created_at) VALUES
 ('grant_mara_ws','person_mara','workspace','ws_cedar','owner','2026-09-16T12:00:00.000Z'),
 ('grant_mara_rill','person_mara','project','proj_rill','owner','2026-09-16T12:00:00.000Z'),
 ('grant_mara_aster','person_mara','project','proj_aster','owner','2026-09-16T12:00:00.000Z'),
 ('grant_mara_tavo','person_mara','assessment','assess_tavo_collect','owner','2026-09-16T12:00:00.000Z'),
 ('grant_ion_tavo','person_ion','assessment','assess_tavo_collect','viewer','2026-09-16T12:00:00.000Z');
INSERT INTO response (id,assessment_survey_id,respondent_id,idempotency_key,answers_json,template_id,template_version,provenance_json,source,submitted_at) VALUES
 ('resp_synth_1','survey_melo','synthetic_respondent_1','synthetic_idem_1','{"Q1":4}','tpl_written',1,'{"fixture":"synthetic"}','participant','2026-09-16T12:00:00.000Z'),
 ('resp_synth_2','survey_melo','synthetic_respondent_2','synthetic_idem_2','{"Q1":3}','tpl_written',1,'{"fixture":"synthetic"}','participant','2026-09-16T12:00:01.000Z');

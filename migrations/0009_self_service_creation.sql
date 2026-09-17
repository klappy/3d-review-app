-- 0009_self_service_creation.sql — backfill for the captain ruling of 2026-09-17:
-- "everyone should have permission to create their own things". Every normal authenticated
-- principal (existing AND new) may create its OWN workspaces/projects with no manual
-- provisioning gate. Support principals are untouched (support = 1 keeps provisioned as-is).
-- Nothing else changes: other people's data, exact-scope grants, shared participant security,
-- support roles and existence-hiding are unaffected — this grants no cross-principal access.
UPDATE principal SET provisioned = 1 WHERE support = 0;

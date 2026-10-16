-- B19 (Bincy; ASK 17 option 1, captain 2026-10-16): setup step 1 asks where the assessment happens (location/community)
-- and who facilitates it. Additive only: two optional free-text columns on assessment; older builds ignore them.
ALTER TABLE assessment ADD COLUMN location TEXT;
ALTER TABLE assessment ADD COLUMN facilitator TEXT;

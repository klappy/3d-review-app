-- Text passages open as a PDF made by PTXprint (captain 2026-09-30 12:08 ET; src/passages.ts, src/ptxprint.ts).
-- Additive only. pdf_key names the R2 object beside the original (assessments/<aid>/<pid>.pdf); NULL = no PDF (not a
-- USFM/SFM file, PTXPRINT_MCP_URL unset, or the render failed) and the raw text is served as before.
ALTER TABLE assessment_passage ADD COLUMN pdf_key TEXT;

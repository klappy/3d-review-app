# Next: resources for weakest areas

The live Next step page shows a Resources for weakest areas section on desktop and phone. It uses the report model's existing weak-area list and the same category table as the current Improve page, `ui/assess/improve-resources.js` (dependency PR577). This does not call the reserved recommendation capabilities or add recommendations to a saved plan.

Resource maintainers add only delivered category/title/HTTP(S)-URL rows to `IMPROVE_RESOURCES`. Both UIs consume that table; do not create a Next-only copy. Matching uses the whole report label first and then the category after ` · `, case-insensitively. Missing categories display “More resources coming.” If no low-scoring area can be shown, the page says so without treating unavailable/suppressed scores as healthy. Valid links open a new tab with `noopener noreferrer`; malformed URLs are omitted. Closing that tab preserves the review context.

The shared table now contains supplied Pathways resources. Source provenance, explicit aliases, one excluded title/destination mismatch and destination-review limits are recorded in [pathways-resources.md](pathways-resources.md). Browser/design acceptance, independent release qualification and deployment remain separate gates. Synthetic test URLs prove wiring only and are never shipped resources.

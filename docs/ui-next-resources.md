# Next: resources for weakest areas

The live Next step page shows a Resources for weakest areas section on desktop and phone. It uses the report model's existing weak-area list and the same category table as the current Improve page, `ui/assess/improve-resources.js` (dependency PR577). This does not call the reserved recommendation capabilities or add recommendations to a saved plan.

Resource maintainers add only delivered category/title/HTTP(S)-URL rows to `IMPROVE_RESOURCES`. Both UIs consume that table; do not create a Next-only copy. Matching uses the whole report label first and then the category after ` · `, case-insensitively. Missing categories display “More resources coming.” If no low-scoring area can be shown, the page says so without treating unavailable/suppressed scores as healthy. Valid links open a new tab with `noopener noreferrer`; malformed URLs are omitted. Closing that tab preserves the review context.

The table is currently empty. This increment supplies UI wiring and empty states; resource delivery, actual destination checks, design screenshots, independent release qualification and deployment remain pending. A synthetic test URL proves navigation wiring only and is never a shipped resource.

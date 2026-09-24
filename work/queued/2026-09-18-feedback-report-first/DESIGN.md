# Bounded report-first correction

Source: public issue137, private original held by coordinator. Report came from production; loaded client version unknown. This is a newly identified task mismatch, not confirmed failed remediation.

First-time bug reporter: read a prompt asking what happened and what was expected, enter a description, send without answering any rating. Suggestion author: describe a desired improvement in the same note and send. Existing payload remains note plus require_authenticated; no new type/category contract.

Page order: title and short report invitation, existing privacy/account disclosure, note labeled “What happened, or what would you improve?”, concise examples supporting both bug and suggestion, optional collapsed “Rate your experience” disclosure holding helpfulness and existing scores/journey field, primary Send feedback and existing exit. Do not autofocus unexpectedly or attach page data. Optional means omitted when unanswered; ratings-only feedback stays compatible when deliberately chosen.

Fixed acceptance families: bug note without ratings; suggestion without ratings; optional rating disclosure and unchanged payload; cancel/navigation without submission; refusal and uncertain retry retaining draft and no automatic resend. Existing identity/receipt regressions remain. Actual local browser verify normal route, report-first order and optional disclosure on desktop/mobile if available. Test fixtures only; no live feedback writes. Local tests do not establish human comprehension or production resolution.

Separate small UI PATCH, paired canonical release record and independent review; MAIN/DEV first then identical-version/source production. No issue130 capture or community governance scope.

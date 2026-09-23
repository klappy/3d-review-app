## User-visible problem
A feedback report describes the changelog opening near its oldest/bottom content, requiring a scroll to the newest entry and another scroll to reach Close. The experienced artifact was not recorded, so the exact affected client version remains unknown.

## Bounded correction
Open the existing changelog at its top/newest entry each time. Keep an accessible close control persistently available, support dismissal by clicking the backdrop, and preserve native Escape and focus restoration. Use the existing canonical changelog/version source, not a second renderer or copied release data.

Acceptance: long-history modal opens at newest; scrolling then close/reopen resets to newest; close remains reachable while scrolled; actual backdrop click closes but content clicks do not; Escape and opener focus remain correct. Meaningful DOM/browser regressions, including async content loading and repeated open/close. No live writes or new feedback collection.

Separate PATCH0.14.2 after initial-version-label #143 / PR144; preserve that feature. This is a targeted modal interaction fix, not a changelog redesign. Real-user resolution is unconfirmed until same-scenario follow-up.

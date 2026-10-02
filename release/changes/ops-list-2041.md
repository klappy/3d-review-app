bump: minor
lane: 2041 · PR: #451
- Added - Support staff can list feedback received after a given time: `GET /v2/ops/feedback?since=<ISO-8601>&limit=<1..200, default 50>` (MCP `read cap.ops.feedback_list`) returns rows oldest first in the same shape as the per-id read, so the hourly triage no longer needs direct database access. Support role only; others get the existing refusal.

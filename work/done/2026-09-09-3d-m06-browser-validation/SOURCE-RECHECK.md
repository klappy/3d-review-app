# M06 independent source recheck

Candidate supplied by Auggie: `1b4154220189bf20b5932bac4202b03d1117a73d`.
Review basis: frozen local source, not a deployed-browser observation. Reviewer did not author implementation.

Locally verified SHA-256:
- index.html: `a47888e084a2f13b33fd1c805d4d7dcf27b32f8e936b3a69210a29eeab319c67`
- worker.mjs: `e41bb4e746162e755823a683f4e994f560285fded5e2ce3d893c93131b1ed714`

Disposition: prior source blockers are addressed sufficiently for Otto to proceed with the separately authorized provisional synthetic deployment. No remaining source finding from this bounded recheck blocks that preview. This is not complete acceptance or deployment authorization from the reviewer.

| Previous finding | Source recheck |
|---|---|
| Top-level module aliases bypass assessment guards | Canonical parser and routeAllowed reject aliases; assessment routes require current scoped access and exclude viewers. |
| Project null cycle; help lesson and created routes rejected | Project no longer dereferences null cycle; help/lesson and created IDs have explicit canonical handling. Inspected generated navigation destination patterns against parser. |
| Cached comparison/invitation/group preview reveals prior scope | Comparison and previews recheck current grants before rendering. |
| Participant version fixed at v1 | Template lookup uses current cycle templates; submission records and displayed keys use that helper. |
| Created project could not enter an assessment | Selectable created landing and startLocalCycle now create an empty cycle under its own projectId with explicit grants. Follow-up preserves parent. |
| Missing support scope | Support draft includes scoped case and filters receipts by current access. |
| Missing scan rejection | Explicit rejection clears extracted answers and submits nothing. |
| Empty-cycle seeded findings | Results and snapshots distinguish zero-response missing evidence from seeded low/present/suppressed fixtures. |

Open: all exact-deployment browser acceptance remains unproved. Desktop is available at observed 1363x936; exact browser version unavailable and mobile 390x844 unsupported by advertised browser API. Playback, print/download outputs, actual deployed payload/request privacy, full scope matrix, draft/back/reset/retry and all retained coverage rows require observations. Do not convert source dispositions into browser passes or a completion percentage.

# Independent K3a correction review — f52fce6 — 2026-09-22

**ACCEPT F1/F2/F3 code corrections only. K3a overall acceptance remains pending browser/reference/asset evidence.**

Exact source f52fce62d3294559ba3b39d26c91bc8bc8393a75, tree e81b161437b6f693739bf1c343aadf6107069317. Detached independent checkout /tmp/k3a-independent-f52. No tracked product edits. Reviewed delta after7dca20bd and prior b918 findings7096aa3, including Chris's exact Owner/Member/Viewer clarification recorded1c33fda6.

F1: retry and workspace/project reload now use guarded swap, checking current generation before DOM replacement and synchronizing the shell from the accepted page model. The independent held-p2-retry → navigatep1 → release disconfirmer now passes; previously failed atb918.

F2: ctx.go checks captured generation/identity before navigation. The independent held synthetic workspace-create → navigatep1 → release-success disconfirmer now passes; previously failed atb918. This prevents stale navigation, not an already dispatched write's server effect.

F3: no synthesized Member fallback. Independent direct model checks: loaded owner→Owner, member→Member, viewer→Viewer; unknown current scope→empty role, separate Signed in identity. Mixed Owner/Viewer projects preserve each node's explicit role without inventing a global role. This conforms to the user's named roles; it does not replace Viewer with a generic identity label.

Independent focused run59/59 passed: retained normal-root cases plus both original disconfirmers, app-adapter, scope and identity-reset suites. Evidence /tmp/k3a-f52-review-tests.txt. Reviewer scratch harness relies on actual automatic boot rather than manually calling boot; no authored source changed. Actual rendered phone/desktop, reproducible26-module bundle/source mapping, full required normal-root journeys and matched-reference proof are still author-in-progress, not passed by these JSDOM/model results. No broad rerun, merge or deployment. Fable retains exclusive cooking custody.

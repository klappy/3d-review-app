# Driver-seat delta — separate app-flow mock

Run 2026-09-09, Auggie, after reading the live driver's-seat lens and complete ticket/source spine.

The system is one assessment workspace with surrounding context navigation. Direct collaborator entry opens the assessment, not a role chooser or an onboarding funnel. Two sample assessments deliberately retain different phases and drafts, making context switching observable.

Changes made to the author contract:
- Fix the default route as an assessment view. Project context is above the four phase tabs; optional workspaces stay secondary.
- Make participant and viewer entry separate ordinary links, so the viewer surface cannot inherit authoring controls by accident.
- Limit the fixture to two projects/two assessments and a small illustrative response. Survey template names are predefined; actual instrument content remains explicitly illustrative.
- Keep report viewing a restrained screen with a return path. Do not rebuild the earlier approval/export/action engine.
- Require a source map distinguishing observed source direction, mock-only fixture choices and unresolved permissions.

Considered and rejected:
- Reusing PR6 as the UI baseline: it contains the rejected combined control-panel structure.
- Mandatory workspace setup: source calls workspace an optional grouping.
- Generic global role selector and permission debugger: those teach implementation mechanics instead of the user journey.
- Inventing answers to creation authority, inheritance or removal: source leaves these open.
- Replacing the successful glass presentation with a new framework: original static assets provide the requested visual family without new dependencies.

Disconfirmer: if the default page asks users to choose a role/workspace before reaching their invited assessment, or if the report screen grows policy/management machinery, the implementation has violated this contract. Source tests cannot prove rendered usability; independent review will name that boundary.


## Source-fidelity review correction

Root review identified two missing demonstrations in the first local candidate: the direct collaborator link still exposed parent selectors, and one assessment per project could not show switching to a past assessment within a project. The author contract now makes the invited scope explicit and requires two assessments in the same project. These correct source omissions; they do not add a global permission engine. The exact sidebar wording is being checked against the complete recovered source before final layout acceptance. Initial model/event checks are retained as partial evidence, not final source fidelity.


Exact complete-source recovery resolved the layout question: 10379165/3338790743 proposes a navigation side panel; 0747 positively receives it; 0751–0754 describes project/assessment navigation around the existing assessment. The study will implement that restrained side panel, with workspace navigation optional and hidden parent navigation for the assessment-only invitation. Earlier context-above wording was insufficiently specific; this is the selected source proposal, not a new universal layout rule.

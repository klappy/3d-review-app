// E1 (cookbook #16 c5720826786 E1-1): the functionality statement is GENERATED from this list, which each merged slice updates.
// It names what this shell mounts at this head and where the rest lives, by name. No "coming soon".
// Union with #62 (Auditor c5721001990): counts, the survey screen and the blank print are mounted at this head.
export const MOUNTED = ['entry (tour, example, survey code, sign-in)', 'workspaces', 'one workspace (its projects)', 'projects', 'one project (assessments, languages)', 'one assessment: Prepare · Collect · Understand · Improve · Permissions', 'stage move (one step, confirmed)', 'survey screen', 'survey counts', 'print blank survey', 'share survey: participant link (two-step), copy, QR, invitation sheet, revoke'];
export const ELSEWHERE = { where: 'Workspaces & people (legacy)', items: ['access codes', 'participant survey flow', 'shared links', 'invitations, role changes and ownership transfer', 'invitation acceptance'] };
export function whatsHere() { return `Here: ${MOUNTED.join(' · ')}. On ${ELSEWHERE.where}: ${ELSEWHERE.items.join(', ')}.`; }

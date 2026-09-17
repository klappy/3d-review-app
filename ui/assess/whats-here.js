// E1 (cookbook #16 c5720826786 E1-1): the functionality statement is GENERATED from this list, which each merged slice updates.
// It names what this shell mounts at this head and where the rest lives, by name. No "coming soon".
// Union with #62 (Auditor c5721001990): counts, the survey screen and the blank print are mounted at this head.
export const MOUNTED = ['assessment view', 'survey set (three lenses, include/remove)', 'survey counts', 'survey screen', 'print blank survey'];
export const ELSEWHERE = { where: 'Workspaces & people', items: ['workspaces', 'project and assessment creation', 'stage change', 'invitations and roles', 'survey links and codes', 'reports and results'] };
export function whatsHere() { return `Here: ${MOUNTED.join(' · ')}. On ${ELSEWHERE.where}: ${ELSEWHERE.items.join(', ')}.`; }

// E1 (cookbook #16 c5720826786 E1-1): the functionality statement is GENERATED from this list, which each merged slice updates.
// It names what this shell mounts at this head and where the rest lives, by name. No "coming soon".
export const MOUNTED = ['assessment view', 'survey set (three lenses, include/remove)'];
export const ELSEWHERE = { where: 'Workspaces & people', items: ['workspaces', 'project and assessment creation', 'stage change', 'invitations and roles', 'survey links and codes', 'reports and results'] };
export function whatsHere() { return `Here: ${MOUNTED.join(' · ')}. On ${ELSEWHERE.where}: ${ELSEWHERE.items.join(', ')}.`; }

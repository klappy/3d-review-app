// Client navigation is a projection of /v2/me, never an authorization grant.
export function hasProjectWork(me) {
  return !!me?.principal?.provisioned || (me?.grants || []).some(grant => grant.scope_type === 'project');
}

// The principal's OWN assessment grant rows from /v2/me; nothing is enumerated from a project.
export function assessmentGrants(me) {
  return (me?.grants || []).filter(grant => grant.scope_type === 'assessment');
}

// Report work is reachable for a project user and for an assessment-only grantee.
export function hasReportWork(me) {
  return hasProjectWork(me) || assessmentGrants(me).length > 0;
}

// Only an assessment-only grantee gets the granted picker; a project identity would otherwise hold
// two visible sources for one state.assessment and desync project-scoped writes.
export function hasSharedAssessmentEntry(me) {
  return !hasProjectWork(me) && assessmentGrants(me).length > 0;
}

export const codeEntryFailure = 'Could not open this code. Check it and try again.';

export function clearIdentityData(state, storage) {
  for (const key of ['session', 'participant', 'principal', 'project', 'projectView', 'assessment', 'survey', 'form', 'answers', 'responseKey', 'codeIds', 'confirmToken']) state[key] = null;
  for (const key of ['facilitatorToken', 'participantToken', 'responseKey']) storage.removeItem(key);
}

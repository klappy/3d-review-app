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

// Granted picker: exact assessment grants and no project grant. provisioned only unlocks
// create-project (self-service); it is not project work and must not hide this entry.
// A project grant still hides the picker so one state.assessment has one visible source.
export function hasSharedAssessmentEntry(me) {
  const hasProjectGrant = (me?.grants || []).some(grant => grant.scope_type === 'project');
  return !hasProjectGrant && assessmentGrants(me).length > 0;
}

export const codeEntryFailure = 'Could not open this code. Check it and try again.';

export function clearIdentityData(state, storage) {
  for (const key of ['session', 'participant', 'principal', 'project', 'projectView', 'assessment', 'survey', 'form', 'answers', 'responseKey', 'codeIds', 'confirmToken']) state[key] = null;
  for (const key of ['facilitatorToken', 'participantToken', 'responseKey']) storage.removeItem(key);
}

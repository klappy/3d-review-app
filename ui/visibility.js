// Client navigation is a projection of /v2/me, never an authorization grant.
export function hasProjectWork(me) {
  return !!me?.principal?.provisioned || (me?.grants || []).some(grant => grant.scope_type === 'project');
}

export const codeEntryFailure = 'Could not open this code. Check it and try again.';

export function clearIdentityData(state, storage) {
  for (const key of ['session', 'participant', 'principal', 'project', 'projectView', 'assessment', 'survey', 'form', 'answers', 'responseKey', 'codeIds', 'confirmToken']) state[key] = null;
  for (const key of ['facilitatorToken', 'participantToken', 'responseKey']) storage.removeItem(key);
}

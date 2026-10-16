/** Server-owned admission only; never an authorization or suppression bypass.
 * Production is off until its explicit disclosure-policy approval and rollout.
 * No request parameter can select this policy. Unknown environments fail closed.
 */
export function participantReportsAllowed(env?: { ENVIRONMENT?: string; PARTICIPANT_REPORTS?: string }): boolean {
  return env?.ENVIRONMENT === 'dev' ||
    (env?.ENVIRONMENT === 'production' && env.PARTICIPANT_REPORTS === 'enabled');
}

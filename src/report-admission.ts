import { SUPPRESSION_THRESHOLD } from './handlers/common.js';
/** Server-owned admission only; never an authorization or suppression bypass.
 * Production is off until its explicit disclosure-policy approval and rollout.
 * No request parameter can select this policy. Unknown environments fail closed.
 */
export function participantReportsAllowed(env?: { ENVIRONMENT?: string; PARTICIPANT_REPORTS?: string }): boolean {
  return env?.ENVIRONMENT === 'dev' ||
    (env?.ENVIRONMENT === 'production' && env.PARTICIPANT_REPORTS === 'enabled');
}
/** Server-owned report floor, never a request parameter. DEV builds a report from one participant response: every response
 * belongs to one lens, so each lens that was sent out and answered carries >=1, and a lens with none reads More input needed
 * (3d-review-cookbook work/active/2026-10-26-3d-report-threshold-coverage, REQ-0018/TEN-0008). Every other environment,
 * production included, keeps the approved SUPPRESSION_THRESHOLD until its own disclosure decision. */
export const DEV_REPORT_MINIMUM = 1;
export function participantReportMinimum(env?: { ENVIRONMENT?: string }): number {
  return env?.ENVIRONMENT === 'dev' ? DEV_REPORT_MINIMUM : SUPPRESSION_THRESHOLD;
}

let actor = null, credential = null, entries = [];
export function clearActivity() { actor = null; credential = null; entries = []; }
export function observeActivity(envelope, bearer) {
  if (credential !== bearer) { clearActivity(); credential = bearer; }
  const principal = envelope?.result?.principal?.id ?? envelope?.receipt?.actor;
  if (!principal) return;
  if (actor !== principal) { actor = principal; entries = []; }
  const receipt = envelope?.receipt;
  if (!receipt?.id || receipt.actor !== actor) return;
  // A strict allowlist: no URL, request/result body, token, email, note, grant or user identity is retained.
  entries.unshift({ at: receipt.at ?? '', receipt: receipt.id, trace: receipt.trace_id ?? envelope.trace_id ?? '', scope: receipt.scope?.type ?? '', kind: receipt.class ?? '', capability: /^cap\.[a-z0-9_.]+$/.test(envelope.capability ?? '') ? envelope.capability : '' });
  entries = entries.slice(0, 50);
}
export const activitySnapshot = () => entries.map(entry => ({ ...entry }));

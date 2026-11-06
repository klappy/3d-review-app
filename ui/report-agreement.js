/** Read-time categorical disclosure. Only immutable report evidence counts;
 * never live collection counts. Missing/malformed counts fail closed. */
export function translationAgreementFor(payload, minimum = 3) {
  const agreement = payload?.translation_type_agreement;
  if (!agreement || typeof agreement !== 'object') return null;
  const floor = Number.isInteger(minimum) && minimum >= 1 ? minimum : 3;
  const counts = {team: 0, church: 0}, invalid = new Set();
  for (const entry of Array.isArray(payload.evidence) ? payload.evidence : []) {
    const label = typeof entry?.label === 'string' ? entry.label.split(' — ')[0].trim().toLowerCase() : '';
    const side = ['team', 'translation team'].includes(label) ? 'team' : label === 'church' ? 'church' : null;
    if (!side) continue;
    if (!Number.isSafeInteger(entry.n) || entry.n < 0) { invalid.add(side); continue; }
    counts[side] += entry.n;
  }
  const visible = side => !invalid.has(side) && Number.isSafeInteger(counts[side]) && counts[side] >= floor;
  const team = visible('team'), church = visible('church');
  if (!team && !church) return null;
  const array = value => Array.isArray(value) ? value : [];
  const team_values = team ? array(agreement.team_values) : [];
  const church_values = church ? array(agreement.church_values) : [];
  const team_statuses = team ? array(agreement.team_statuses) : [];
  const church_statuses = church ? array(agreement.church_statuses) : [];
  if (![team_values, church_values, team_statuses, church_statuses].some(values => values.length)) return null;
  return {...agreement, team_values, church_values,
    ...('team_statuses' in agreement ? {team_statuses} : {}),
    ...('church_statuses' in agreement ? {church_statuses} : {}),
    agree: team && church && team_values.length && church_values.length ? agreement.agree : null};
}

/** Stored payloads and their hashes are unchanged; transport suppresses findings
 * after validation under the server-owned per-perspective minimum. */
export function discloseTranslationAgreement(payload, minimum = 3) {
  if (!payload || typeof payload !== 'object' || !payload.translation_type_agreement) return payload;
  return {...payload, translation_type_agreement: translationAgreementFor(payload, minimum)};
}

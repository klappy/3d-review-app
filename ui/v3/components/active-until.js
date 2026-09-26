// component: Active until (B41, captain ruling 19:50 2026-09-25; Bincy: "When" → "Active until"). Setup asks "Active until"
// (required) and "Starts" (optional, default today). No migration: both dates ride the assessment's existing free-text
// `period` as "Starts YYYY-MM-DD · Active until YYYY-MM-DD" (readable as written on older screens). A period in any
// other shape (reviews made before B41) is shown as written and never closes anything.
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PACKED = /^(?:Starts (\d{4}-\d{2}-\d{2}) · )?Active until (\d{4}-\d{2}-\d{2})$/;
const pad = n => String(n).padStart(2, '0');
export const todayIso = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const valid = s => ISO.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
export function packPeriod(starts, until) {
  const s = String(starts ?? '').trim(), u = String(until ?? '').trim();
  if (!valid(u)) return '';
  return valid(s) ? `Starts ${s} · Active until ${u}` : `Active until ${u}`;
}
export function parsePeriod(period) {
  const m = PACKED.exec(String(period ?? '').trim());
  return m && valid(m[2]) && (!m[1] || valid(m[1])) ? { starts: m[1] || null, until: m[2] } : null;
}
export const formatDate = iso => valid(String(iso ?? '')) ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }) : '';
// "Active until 31 October 2026" for a packed period; '' otherwise.
export function activeUntilLine(period) { const p = parsePeriod(period); return p ? `Active until ${formatDate(p.until)}` : ''; }
// What a participant or facilitator reads for a period: the plain line when packed, else the period as written.
export function periodText(period) { return activeUntilLine(period) || String(period ?? '').trim(); }
// Participant links: after the Active until date (the participant's own calendar day) the link shows one plain line.
export function closedLine(period, today = todayIso()) { const p = parsePeriod(period); return p && today > p.until ? `This survey closed on ${formatDate(p.until)}.` : ''; }
// Setup validation: Active until required; Starts optional and not after Active until.
export function periodErrors(starts, until) {
  const s = String(starts ?? '').trim(), u = String(until ?? '').trim(), errs = [];
  if (!valid(u)) errs.push('Choose the date the survey is active until.');
  if (s && !valid(s)) errs.push('Starts: choose a date, or leave it empty.');
  if (valid(s) && valid(u) && s > u) errs.push('Starts must be on or before Active until.');
  return errs;
}

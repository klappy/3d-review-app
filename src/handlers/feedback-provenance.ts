import { CapError } from './types';
import { APP_VERSION, APP_COMMIT, APP_STAMP, BUILD_UUID, RELEASE_SOURCE } from '../version';

const ENVIRONMENTS = ['dev', 'production', 'unknown'];
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const HASH = /^[0-9a-f]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = () => { throw new CapError('INVALID_PARAMS', 'Invalid feedback experience metadata'); };
function object(value: unknown, keys: string[]): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const row = value as Record<string, any>;
  if (Object.keys(row).some(k => !keys.includes(k))) return invalid();
  return row;
}
const utc = (value: unknown) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
function release(value: unknown) {
  const r = object(value, ['version','commit','release_source','build_uuid','environment']);
  if (!Object.keys(r).length) return invalid();
  if ('version' in r && (typeof r.version !== 'string' || r.version.length > 64 || !VERSION.test(r.version))) return invalid();
  for (const k of ['commit','release_source']) if (k in r && (typeof r[k] !== 'string' || !HASH.test(r[k]))) return invalid();
  if ('build_uuid' in r && r.build_uuid !== null && (typeof r.build_uuid !== 'string' || !UUID.test(r.build_uuid))) return invalid();
  if ('environment' in r && !ENVIRONMENTS.includes(r.environment)) return invalid();
  return { ...r };
}
/** Strict allowlist: metadata evidence only, never arbitrary URLs, hostnames or page content. */
export function feedbackExperience(value: unknown): Record<string, unknown> {
  const r = object(value, ['occurred_at','surface','host','client_release','api_release','context']);
  if (!Object.keys(r).length || new TextEncoder().encode(JSON.stringify(r)).length > 1536) return invalid();
  if ('occurred_at' in r && !utc(r.occurred_at)) return invalid();
  if ('surface' in r && !['web','mcp_panel','mcp_tool','http','unknown'].includes(r.surface)) return invalid();
  if ('host' in r && !['browser','chatgpt','claude','reference_host','other','unknown'].includes(r.host)) return invalid();
  if ('context' in r) { const c = object(r.context, ['page','component']); if (!['workspaces','workspace','projects','project','assessment','survey','permissions','feedback','unknown'].includes(c.page) || c.component !== 'app_feedback') return invalid(); }
  return { ...r, ...('client_release' in r ? {client_release:release(r.client_release)} : {}), ...('api_release' in r ? {api_release:release(r.api_release)} : {}) };
}
export function feedbackProvenance(environment: string | undefined, submittedAt: string, experience?: Record<string, unknown>) {
  return {
    submission: { source: 'server', submitted_at: submittedAt, version: APP_VERSION, commit: APP_COMMIT, build: APP_STAMP, build_uuid: BUILD_UUID, release_source: RELEASE_SOURCE, environment: ENVIRONMENTS.includes(environment ?? '') ? environment : 'unknown' },
    experience: experience ? { source: 'client_reported', ...experience } : null,
  };
}
/** Never synthesize current metadata for legacy rows. Malformed stored metadata is existence-hidden by caller. */
export function projectFeedbackProvenance(value: unknown) {
  if (value === undefined) return null;
  const p = object(value, ['submission','experience']);
  const s = object(p.submission, ['source','submitted_at','version','commit','build','build_uuid','release_source','environment']);
  if (Object.keys(s).length !== 8 || s.source !== 'server' || !utc(s.submitted_at)) return invalid();
  release({version:s.version,commit:s.commit,release_source:s.release_source,build_uuid:s.build_uuid,environment:s.environment});
  if (s.build !== `${s.version}+${s.commit.slice(0,7)}`) return invalid();
  let experience = null;
  if (p.experience !== null) {
    const {source, ...raw} = object(p.experience, ['source','occurred_at','surface','host','client_release','api_release','context']);
    if (source !== 'client_reported') return invalid();
    experience = {source:'client_reported', ...feedbackExperience(raw)};
  }
  return {submission:{...s},experience};
}

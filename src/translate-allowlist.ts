/**
 * What anonymous POST /v2/translate may translate and store (reviewer FAIL on #377, findings F1 and F2).
 *
 * The route is anonymous and its memory is shared first-write-wins, so it translates ONLY English strings whose
 * SHA-256 matches the published set, and it sends the upstream a context the server fixes:
 *   - `participant-ui`                 → the participant page's own words (mirror below; test/translate-allowlist.test.ts
 *                                        keeps it equal to ui/participate/i18n.js UI_EN, ui/participate/index.html, the
 *                                        practice wording in ui/participate/page.js and welcomeCopy in ui/participant-view.js)
 *                                        and the printed survey's words (ui/stage-screens.js PRINT_WORDS; S25).
 *   - `participant-form:<template id>` → item texts and choice labels of the PUBLISHED versions of that instrument
 *                                        (survey_template.published_at IS NOT NULL) plus the optional About-you fields.
 * Anything else is refused: never sent upstream, never stored, never served.
 */
import { RESPONDENT_FIELDS } from "./context-fields";

export type TranslateScope = { kind: "ui" } | { kind: "form"; templateId: string };

const FORM = /^participant-form:([A-Za-z0-9_.-]{1,100})$/;
/** The client's context names a scope; it is never forwarded as-is. */
export function parseScope(context: string): TranslateScope | null {
  if (context === "participant-ui") return { kind: "ui" };
  const m = FORM.exec(context);
  return m ? { kind: "form", templateId: m[1] } : null;
}
/** The context the upstream receives: server-built from the verified scope, never the caller's text. */
export const upstreamContext = (s: TranslateScope) => (s.kind === "ui" ? "participant-ui" : `participant-form:${s.templateId}`);

/** Mirror of ui/v3/components/privacy-line.js. */
export const PRIVACY_LINE = "Your responses are confidential.";

/** Participant page words: UI_EN values, the static page words, and the practice-survey variants. */
export const PARTICIPANT_UI_STRINGS: readonly string[] = Object.freeze([
  // ui/participate/i18n.js UI_EN
  "Language", "Translating…",
  "The first time can take up to a minute. After that it opens straight away. You can keep reading in English meanwhile.",
  "The first time can take up to a minute. After that it opens straight away. You can keep reading in {language} meanwhile.", // S21
  "phrases", "Try again", "Showing English. Check the internet connection, then try again.",
  "Translation is not available right now. Showing English.",
  "Machine translation. If anything is unclear, ask the person who shared the survey.",
  "Machine translation, not yet checked by a speaker of this language. If anything is unclear, ask the person who shared the survey.",
  "We would like your perspective", "Start", "Learn more",
  "No account, no sign-in. You can review your answers before you send them.",
  "Back", "Next", "Question {n} of {total}", "Answer required:", "An exclusion choice cannot be combined:",
  "Question", "of", // pre-S21 pages built the counter from these two words; kept while such pages are still open
  "An exclusion choice cannot be combined with any other choice.", "Choose all that apply.", "(optional)",
  "This survey contains an unsupported question. Ask the person who shared the survey for help.",
  "Change", "Skipped", "About you (optional)", "Choose (optional)", "Please describe", "Response saved",
  // S21: the thank-you and its reference line (ui/shared-link.js copy; the code variants say a code works once)
  "Thank you. Your answers stay with the team, grouped with others from the {perspective} perspective. Reopening your link shows this receipt again.",
  "Thank you. Your answers stay with the team, grouped with others from your group. Reopening your link shows this receipt again.",
  "Someone else can answer using the same link on their own device.",
  "Thank you. Your answers stay with the team, grouped with others from the {perspective} perspective.",
  "Thank you. Your answers stay with the team, grouped with others from your group.",
  "An access code works only once: entering it again will not reopen this survey. Anyone else who answers needs their own code or survey link.",
  "Reference",
  "The passage", "Read the passage", "Listen to the passage", "Watch the passage", "Open the passage", // S16 passage card (#385)
  "Please read or listen to the passage before you answer:", // S18 passage-first line (#387)
  // ui/participate/index.html (page.js STATIC selectors)
  "Your perspective matters", "No account is needed. Review your answers before sending them.", "Review answers",
  "Review your answers", "Edit answers", "Submit answers", "Check submission",
  // ui/participate/page.js practice survey (?demo=1)
  "Practice survey · nothing is sent",
  "Use the real survey flow with source-pinned synthetic sample questions. Answers stay in memory and disappear when you leave or reload.",
  "Finish practice — nothing sent", "Check practice",
  // S25 printed survey (ui/stage-screens.js PRINT_WORDS): the paper's words for the person answering, so Print survey in
  // a participant language reads in that language. Fixed app wording, like the page words above.
  "Blank survey", "Before you answer, read or listen to:", "Code (optional; legacy)", "Leave blank when answering from the shared link",
  // S31: the QR slot, the identity block labels and the footer (the paper now names its project, assessment and survey).
  "No shared link for this survey yet. Make one on its Share card, then print again.", "Helper: scan to enter this paper's answers",
  "Project", "Assessment", "Language evaluated", "Printed in", "Survey", "Codes are never printed. The QR is the survey's own link.",
  "Mark one circle ○ for each question. Where it says \"Choose all that apply\", mark every box ☐ that fits. Write on the lines where there are no choices.",
  "Write your response on the blank lines below each question.", "Choose all that apply", "Choose one",
]);

/** ui/participant-view.js welcomeCopy, the two assembled sentences. */
export const welcomeLead = (language?: string | null) => `${language ? `You were invited to say how the ${language} translation is going. ` : ""}${PRIVACY_LINE}`;
export const welcomeTime = (count: number) => `Time: about ${Math.max(5, Math.round(count * 0.6))} minutes · ${count} questions`;
export const MAX_FORM_ITEMS = 300;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const hashAll = async (texts: Iterable<string>, into = new Set<string>()) => { for (const t of new Set(texts)) into.add(await sha256Hex(t)); return into; };

/** The fixed participant-ui source: built once per isolate; a new deploy is a new isolate and a new source. */
const STATIC_UI_SOURCE: readonly string[] = Object.freeze([...PARTICIPANT_UI_STRINGS, welcomeLead(null), ...Array.from({ length: MAX_FORM_ITEMS }, (_, i) => welcomeTime(i + 1))]);
/**
 * Audit E2 (train 22): hashing is done once per isolate per source, never per request. The static page-word set is
 * memoized by the source array's identity (a different source is hashed afresh), and each welcome lead's hash by its
 * language name (bounded; cleared when full). Callers get a copy of the static set, so the memo is never mutated.
 */
const staticMemo = new WeakMap<readonly string[], Promise<Set<string>>>();
export function staticUiHashes(source: readonly string[] = STATIC_UI_SOURCE): Promise<Set<string>> {
  let p = staticMemo.get(source);
  if (!p) {
    p = hashAll(source);
    p.catch(() => staticMemo.delete(source));
    staticMemo.set(source, p);
  }
  return p;
}
const LEAD_MEMO_MAX = 512;
const leadMemo = new Map<string, Promise<string>>();
export function welcomeLeadHash(language: string): Promise<string> {
  let p = leadMemo.get(language);
  if (!p) {
    if (leadMemo.size >= LEAD_MEMO_MAX) leadMemo.clear();
    p = sha256Hex(welcomeLead(language));
    p.catch(() => leadMemo.delete(language));
    leadMemo.set(language, p);
  }
  return p;
}

type Item = { text?: unknown; options?: { text?: unknown; label?: unknown }[] };
/** The strings a participant form shows for one instrument's items (ui/participate/i18n.js formStrings). */
export function instrumentStrings(items: Item[]): string[] {
  const out: string[] = [];
  for (const it of Array.isArray(items) ? items : []) {
    if (typeof it?.text === "string" && it.text) out.push(it.text);
    for (const o of Array.isArray(it?.options) ? it.options : []) { const l = o?.label || o?.text; if (typeof l === "string" && l) out.push(l); }
  }
  for (const f of RESPONDENT_FIELDS) { out.push(f.label); for (const o of f.options ?? []) out.push(o.label); }
  return out;
}

/**
 * Language names are member-authored (cap.language.create sets no length or charset limit), and the welcome lead that
 * carries one reaches the participant-ui scope (a participant's own survey language only, W1). Security review on #377 (e): only names of a strict shape are
 * allowlisted — at most 60 characters and 6 words, Unicode letters/marks/spaces/hyphen/apostrophe/parentheses only — and
 * every allowed welcome lead is marked `isolated` so /v2/translate sends it upstream ALONE, never in the same batch as
 * the shared page words (an injected name cannot steer the translation of rows every project serves).
 */
export const MAX_LANGUAGE_NAME = 60;
const NAME_SHAPE = /^[\p{L}\p{M}][\p{L}\p{M} \-'’()]*$/u;
export function allowlistableLanguageName(name: unknown): name is string {
  if (typeof name !== "string" || !name || name.length > MAX_LANGUAGE_NAME || name !== name.trim()) return false;
  if (!NAME_SHAPE.test(name) || /\s{2,}/.test(name)) return false;
  return name.split(" ").length <= 6;
}

export interface ScopeAllowlist { allowed: Set<string>; isolated: Set<string> }

/** The one language a participant's welcome lead may name: its own survey's (the same join cap.response.form uses). */
const SURVEY_LANGUAGE_SQL = "SELECT l.name FROM assessment_survey s JOIN assessment a ON a.id = s.assessment_id JOIN language l ON l.id = a.language_id WHERE s.id = ?";

/**
 * SHA-256 hashes of every English string this scope may translate, and which of them must go upstream alone.
 * Security W1 (train 22 audit; signature and SQL from #397): a welcome lead that names a language is allowed ONLY for a
 * participant (`participantSurveyId` from its own token) and only for that survey's own language. An anonymous caller
 * gets the page words and the name-free lead, so /v2/translate can no longer be asked whether a language name exists.
 */
export async function allowedScope(db: D1Database | undefined, scope: TranslateScope, participantSurveyId: string | null = null): Promise<ScopeAllowlist> {
  const isolated = new Set<string>();
  if (scope.kind === "ui") {
    const allowed = new Set(await staticUiHashes());
    if (db && participantSurveyId) {
      try {
        const row = await db.prepare(SURVEY_LANGUAGE_SQL).bind(participantSurveyId).first<{ name: string }>();
        if (row && allowlistableLanguageName(row.name)) isolated.add(await welcomeLeadHash(row.name));
        for (const h of isolated) allowed.add(h);
      } catch { /* the page words still work */ }
    }
    return { allowed, isolated };
  }
  return { allowed: await formHashes(db, scope.templateId), isolated };
}
/** SHA-256 hashes of every English string this scope may translate. Unknown or unpublished template → empty set. */
export async function allowedHashes(db: D1Database | undefined, scope: TranslateScope, participantSurveyId: string | null = null): Promise<Set<string>> {
  return (await allowedScope(db, scope, participantSurveyId)).allowed;
}
async function formHashes(db: D1Database | undefined, templateId: string): Promise<Set<string>> {
  if (!db) return new Set();
  try {
    const { results } = await db.prepare("SELECT items_json FROM survey_template WHERE id = ? AND published_at IS NOT NULL").bind(templateId).all<{ items_json: string }>();
    if (!results.length) return new Set();
    const texts: string[] = [];
    for (const r of results) { try { texts.push(...instrumentStrings(JSON.parse(r.items_json))); } catch { /* skip a bad row */ } }
    return hashAll(texts);
  } catch { return new Set(); }
}

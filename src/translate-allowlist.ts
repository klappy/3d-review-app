/**
 * What anonymous POST /v2/translate may translate and store (reviewer FAIL on #377, findings F1 and F2).
 *
 * The route is anonymous and its memory is shared first-write-wins, so it translates ONLY English strings whose
 * SHA-256 matches the published set, and it sends the upstream a context the server fixes:
 *   - `participant-ui`                 → the participant page's own words (mirror below; test/translate-allowlist.test.ts
 *                                        keeps it equal to ui/participate/i18n.js UI_EN, ui/participate/index.html, the
 *                                        practice wording in ui/participate/page.js and welcomeCopy in ui/participant-view.js).
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
  "phrases", "Try again", "Showing English. Check the internet connection, then try again.",
  "Translation is not available right now. Showing English.",
  "Machine translation. If anything is unclear, ask the person who shared the survey.",
  "Machine translation, not yet checked by a speaker of this language. If anything is unclear, ask the person who shared the survey.",
  "We would like your perspective", "Start", "Learn more",
  "No account, no sign-in. You can review your answers before you send them.",
  "Back", "Next", "Question", "of", "Answer required:", "An exclusion choice cannot be combined:",
  "An exclusion choice cannot be combined with any other choice.", "Choose all that apply.", "(optional)",
  "This survey contains an unsupported question. Ask the person who shared the survey for help.",
  "Change", "Skipped", "About you (optional)", "Choose (optional)", "Please describe", "Response saved",
  // ui/participate/index.html (page.js STATIC selectors)
  "Your perspective matters", "No account is needed. Review your answers before sending them.", "Review answers",
  "Review your answers", "Edit answers", "Submit answers", "Check submission",
  // ui/participate/page.js practice survey (?demo=1)
  "Practice survey · nothing is sent",
  "Use the real survey flow with source-pinned synthetic sample questions. Answers stay in memory and disappear when you leave or reload.",
  "Finish practice — nothing sent", "Check practice",
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

let staticUi: Promise<Set<string>> | null = null; // per isolate
function staticUiHashes(): Promise<Set<string>> {
  staticUi ??= hashAll([...PARTICIPANT_UI_STRINGS, welcomeLead(null), ...Array.from({ length: MAX_FORM_ITEMS }, (_, i) => welcomeTime(i + 1))]);
  return staticUi;
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

/** SHA-256 hashes of every English string this scope may translate. Unknown or unpublished template → empty set. */
export async function allowedHashes(db: D1Database | undefined, scope: TranslateScope): Promise<Set<string>> {
  if (scope.kind === "ui") {
    const set = new Set(await staticUiHashes());
    if (db) {
      try { // welcome lead names the assessment's language (language.name); only names that exist are allowed
        const { results } = await db.prepare("SELECT DISTINCT name FROM language LIMIT 5000").all<{ name: string }>();
        await hashAll(results.map((r) => welcomeLead(r.name)), set);
      } catch { /* the page words still work */ }
    }
    return set;
  }
  if (!db) return new Set();
  try {
    const { results } = await db.prepare("SELECT items_json FROM survey_template WHERE id = ? AND published_at IS NOT NULL").bind(scope.templateId).all<{ items_json: string }>();
    if (!results.length) return new Set();
    const texts: string[] = [];
    for (const r of results) { try { texts.push(...instrumentStrings(JSON.parse(r.items_json))); } catch { /* skip a bad row */ } }
    return hashAll(texts);
  } catch { return new Set(); }
}

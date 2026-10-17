/** docs — the NLX front door. Role-aware, never role-leaking. Projected from contract/capabilities.json (edit the cookbook matrix, not this). */
import type { Ctx, Handler, Role, ScopeType } from "./types";
import { CapError } from "./types";
import { capabilities, byId, contractName, sourceSha, type Capability } from "../registry";
import { roleAt, requiredRole, roleMeets } from "../policy";

const CEILING = "klappy://canon/constraints/mcp-tool-surface-ceiling";
const TOPICS: Record<string, string> = {
  feedback: "Feedback is an append-only write without undo. HTTP accepts anonymous feedback; MCP requires connector authentication. Do not include private answers or credentials. Send feedback with write cap.ops.feedback and params {note: 'The feedback instructions were easy to find.'}. Use note for the message; body, message and comment are not accepted parameter names. No feedback fields are required by the API; note is a useful minimal submission. Read docs {capability:'cap.ops.feedback'} for the canonical accepted fields, types and required/optional lists. text is a legacy alias for note; do not send different values for both. HTTP POST /v2/feedback takes these fields directly as its JSON body, while MCP write wraps them in params. This is an append-only write, without undo or a public feedback list; the result contains recorded, stripped and feedback_id, not your text. Do not include private answers or credentials. answers/responses/response are stripped, not stored. HTTP accepts anonymous feedback; MCP requires connector authentication. Add require_authenticated:true when attribution is required: an anonymous resolved caller is refused before persistence. Omitted/false retains public HTTP behavior; the flag is not stored. On NOT_AUTHENTICATED, sign in before retrying. On INVALID_PARAMS, check the schema instead of guessing names. After an uncertain write result, do not resend automatically: the first submission may have succeeded.",
  glossary: "Workspace (optional grouping) › Project › Language › Assessment. An assessment owns the stage Prepare → Collect → Understand → Improve. Survey templates are platform-managed and versioned; an assessment survey is a template@version selected into an assessment. Participants answer by link or short access code and are pseudonymous. Perspective labels follow the instrument: Translator, community, church; four mid-level roles + Other.",
  permissions: "Grants are (principal, scope, role) with role owner/member/viewer at workspace, project or assessment. One inheritance edge: a workspace role applies to every project the workspace groups; an assessment opens only by its own grant. Raising anyone to owner, transferring ownership or grouping a project needs a direct grant at that scope. Members invite ≤ member; owners cannot be removed or demoted; the last owner is protected; transfer is dangerous. Participants are never collaborators. Unauthorized and nonexistent look identical (NOT_FOUND_OR_NOT_VISIBLE). Super admin is the support switch on an account; there is no separate super admin role yet. It opens everything: every workspace, project and assessment, reads and writes, template publishing and participant unlock, plus the app-wide totals read cap.ops.usage (counts and dates only). A signed-in session of that account (web sign-in or a session bearer) holds it; an agent connected through the OAuth MCP connector never does: connectors always act as a plain delegated user. Only a short, recorded list of core 3D Review team accounts holds it, starting with the product owner's. It is switched on or off for one account at a time by a recorded step that leaves a receipt naming who switched it and for whom; writes made with it still leave receipts as usual.",
  reversibility: "read: no side effect. write.reversible: receipt + undo_token only when a true inverse is declared (archive↔unarchive, rename restores prior). write.effect: sends/grants/releases — dry_run → confirm_token → execute; compensating control (revoke) not undo. write.dangerous: destructive — same two-step; inverse none. Submitting a response is append-only: no undo.",
  telemetry: "Every response carries trace_id. read cap.ops.trace {trace_id} returns your own span log (auth, policy, db timing) scoped and redacted; support sees all. A substituted trace id is NOT_FOUND_OR_NOT_VISIBLE. Telemetry never carries answers, codes or addresses.",
  privacy: "Small-cell suppression is always on for results.summary, response.list and every viewer route. Suppressed is a success: ok:true with suppressed:true — say 'results are hidden because too few people answered', never a number that reconstructs the cell. Threshold value is held (D7). Codes are never returned by issue_codes; export_codes is a confirmed disclosure.",
  stages: "prepare (set up, pick surveys) → collect (codes/links live, responses arrive) → understand (summary, suppression applies) → improve (notes: reflection, next steps). Moves are one step in either direction via cap.assessment.set_stage; browsing never advances a stage.",
  intro: "3D Review helps you assess the health of how Bible translation is being carried out. It gathers structured perspectives from the translation team, community and church so you can examine practices, understand differences and identify questions worth pursuing.\n\nYou can use it alongside your existing translation and checking tools. Its questions concern implementation and experience: how review works, how feedback is incorporated, how decisions are made, and how people understand, use and trust the translation.\n\nStart with the context of your assessment, the people who should contribute and the questionnaires appropriate to their perspectives. The documentation for each released workflow should explain what is available, what permissions it requires and what outcome you can verify.\n",
  faq: "**Can I use 3D Review with translationCore?**\nYes. Keep using translationCore for your translation-checking work. 3D Review adds questions about how your process is functioning and what the translation team, community and church observe.\n\n**Will it work alongside AQuA?**\nYes. AQuA can remain part of your chosen checking approach. 3D Review examines the surrounding practices and perspectives—how review and feedback work, how the team operates, and how people experience the translation.\n\n**Can we use it with Paratext or another tool?**\nYes. 3D Review is designed to accompany the tools and processes you choose. Its focus is the health of their implementation through three perspectives, so it does not depend on adopting one particular checking product.\n\n**What if our translation method is different?**\nYou can use 3D Review alongside different Bible translation methods. The questions examine how the method is being carried out in your context: the team's practices, the community's experience and the church's perspective.\n\n**Does 3D Review check our translated text?**\nIt gathers people's observations about the process, team and translation experience. It does not inspect verses for errors or certify textual accuracy. Continue using the checking and review practices appropriate to your work.\n\n**Does “compatible” mean the apps are connected?**\nCompatibility here means complementary use alongside your workflow. A built-in software integration is a separate feature and should be described only where it is actually available.\n",
};
const INTENTS = ["what", "how", "example", "take survey", "manage", "view results"];

function page(c: Capability) {
  const params = c.id === "cap.ops.feedback" ? { note: "The feedback instructions were easy to find." } : {};
  return {
    capability: c.id, class: c.class, tool: c.tool, http: `${c.http.method} ${c.http.path}`, roles: c.roles, slice: c.slice,
    status: c.status, section: c.section, ui_surface: c.ui_surface, rules: c.notes, inverse: c.inverse,
    ...(c.params_schema ? {
      params_schema: c.params_schema,
      required_params: c.params_schema.required ?? [],
      optional_params: Object.keys(c.params_schema.properties ?? {}).filter(k => !c.params_schema!.required?.includes(k)),
    } : {}),
    ...(c.result_schema ? { result_schema: c.result_schema } : {}),
    ...(c.id === "cap.ops.feedback" ? { guidance: TOPICS.feedback, next: { topic: "feedback" } } : {}),
    how_an_agent_calls_it: c.tool === "danger" ? "danger {capability, params, mode:'dry_run'} → impact + confirm_token → danger {…, mode:'execute', confirm_token}" : `${c.tool} {capability, params}`,
    errors: ["NOT_AUTHENTICATED", "NOT_AUTHORIZED_AT_SCOPE", "WRONG_TOOL_FOR_CLASS", "INVALID_PARAMS", "NOT_FOUND_OR_NOT_VISIBLE", ...(c.tool === "danger" ? ["CONFIRM_REQUIRED", "CONFIRM_EXPIRED"] : []), ...(c.slice === "v2.1-oct" ? ["RESERVED_NOT_BUILT"] : []), "RATE_LIMITED"], // every row: anonymous callers are metered per address on both faces (RL_HTTP_ANON / RL_MCP_ANON), four rows additionally by capability
    examples: { http: `${c.http.method} ${c.http.path}`, mcp: { tool: c.tool, arguments: { capability: c.id, params, ...(c.tool === "danger" ? { mode: "dry_run" } : {}) } } },
    ...(c.id === "cap.ops.feedback" ? { http_request: { method: c.http.method, path: c.http.path, headers: { "content-type": "application/json" }, body: params } } : {}),
    projected_from: `${contractName} @ cookbook ${sourceSha}`,
  };
}
const index = () => {
  const g: Record<string, string[]> = {};
  for (const c of capabilities) (g[c.section] ??= []).push(c.id + (c.slice === "v2.1-oct" ? " (v2.1-oct, not built)" : ""));
  return g;
};
const NEXT_BEST = { prepare: "cap.survey.select", collect: "cap.survey.issue_codes", understand: "cap.results.summary", improve: "cap.assessment.notes.update" } as const;
export const allowedFor = (role: Role | "anonymous" | "participant" | "support") =>
  capabilities.filter((c) => {
    if (role === "support") return true;
    if (role === "anonymous") return c.public;
    if (role === "participant") return c.roles.startsWith("P") || c.public;
    // Viewer: public rows, plus read rows the server's own role table (policy.requiredRole) lets a viewer call.
    if (role === "viewer") return c.public || (c.class === "read" && !/^(S|P)/.test(c.roles) && roleMeets("viewer", requiredRole(c.roles)));
    if (role === "member") return !/^(O$|S)/.test(c.roles) && !c.roles.startsWith("P") && c.roles !== "provisioned creator (D1)";
    return !/^S$/.test(c.roles) && !c.roles.startsWith("P");
  }).map((c) => c.id);


/** Frozen Auth Slice0 stopword allowlist (B1 seed). Byte-identical lock in test/docs-search.test.ts. */
export const DOCS_SEARCH_STOPWORDS = Object.freeze([
  "a", "an", "the", "how", "do", "i", "my", "for", "to",
] as const);

const STOPWORD_SET = new Set<string>(DOCS_SEARCH_STOPWORDS);

/** The one docs-search normalization: lowercase, every non-alphanumeric run → a word break. */
const wordsOf = (text: string) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter(Boolean);

/** Normalize + tokenize a docs `q`; drops frozen stopwords. Empty ⇒ truthful miss. */
export function tokenizeDocsQuery(q: string): string[] {
  return wordsOf(q).filter((t) => !STOPWORD_SET.has(t));
}

/**
 * Glue words the honest-miss gate does not count (they are kept for ranking). Plain English joins a
 * guessed name to a real word with them ("feedback with inventedparam", "create xyzzy and the"); the
 * docs prose uses them too, so as "known" words they would carry a guess past the gate. Not the
 * frozen stopword list above, which still governs tokenization.
 */
const GATE_FILLER = new Set<string>([
  "and", "or", "with", "without", "is", "are", "was", "be", "it", "its", "this", "that", "these", "those",
  "of", "in", "on", "at", "by", "from", "into", "as", "so", "but", "not", "no", "all", "any", "some",
]);

function idTokens(c: Capability): Set<string> {
  return new Set(wordsOf(c.id));
}

function proseTokens(c: Capability): Set<string> {
  return new Set(wordsOf(`${c.notes ?? ""} ${c.ui_surface ?? ""}`));
}

/**
 * Words a schema documents: property names and descriptions, never JSON Schema keywords or types.
 * Walks every place a subschema can sit: properties, items, additionalProperties (when a schema) and
 * the oneOf/anyOf/allOf branches, so a field under a composed schema (cap.survey.issue_link's
 * `entry_fragment`) is docs vocabulary like any other.
 */
function schemaWords(schema: unknown, out: string[] = []): string[] {
  if (!schema || typeof schema !== "object") return out;
  if (Array.isArray(schema)) {
    for (const sub of schema) schemaWords(sub, out);
    return out;
  }
  const s = schema as Record<string, unknown>;
  if (typeof s.description === "string") out.push(...wordsOf(s.description));
  if (s.properties && typeof s.properties === "object") {
    for (const [name, sub] of Object.entries(s.properties as Record<string, unknown>)) {
      out.push(...wordsOf(name));
      schemaWords(sub, out);
    }
  }
  if (s.items) schemaWords(s.items, out);
  if (s.additionalProperties && typeof s.additionalProperties === "object") schemaWords(s.additionalProperties, out);
  for (const k of ["oneOf", "anyOf", "allOf"] as const) if (Array.isArray(s[k])) schemaWords(s[k], out);
  return out;
}

type SearchIndex = {
  n: number;
  df: Map<string, number>;
  vocab: Set<string>;
  bags: Map<string, { id: Set<string>; prose: Set<string> }>;
};
let searchIndex: SearchIndex | null = null;
/**
 * Built once from the static registry: per-capability id/prose bags, document frequency, and the docs
 * vocabulary — the words the registry rows use (id, notes, UI surface, section, roles, schema property
 * names and descriptions), TOPICS and INTENTS. JSON Schema keywords ("minProperties", "additionalProperties",
 * "maxLength") are not docs vocabulary.
 */
function docsSearchIndex(): SearchIndex {
  if (searchIndex) return searchIndex;
  const df = new Map<string, number>();
  const bags = new Map<string, { id: Set<string>; prose: Set<string> }>();
  const vocab = new Set<string>([...Object.values(TOPICS), ...INTENTS].flatMap(wordsOf));
  for (const c of capabilities) {
    const bag = { id: idTokens(c), prose: proseTokens(c) };
    bags.set(c.id, bag);
    for (const t of new Set([...bag.id, ...bag.prose])) df.set(t, (df.get(t) ?? 0) + 1);
    for (const t of [...bag.id, ...bag.prose, ...wordsOf(c.section ?? ""), ...wordsOf(c.roles ?? ""), ...schemaWords(c.params_schema), ...schemaWords(c.result_schema)]) vocab.add(t);
  }
  return (searchIndex = { n: capabilities.length, df, vocab, bags });
}

/**
 * Query tokens that can tell capabilities apart, each counted once: drops repeats, 1-char and numeric
 * tokens, and tokens every capability carries (the shared `cap` id prefix), which match everything
 * and so mean nothing.
 */
function informativeTokens(tokens: string[], idx: SearchIndex): string[] {
  return [...new Set(tokens)].filter((t) => t.length > 1 && !/^[0-9]+$/.test(t) && (idx.df.get(t) ?? 0) < idx.n);
}

/** Singular of a plural query word ("workspaces" → "workspace"), or null. */
const singular = (t: string) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : null);

/**
 * Partial overlap (NLX-MCP-001 phrases): plain phrases carry filler words ("someone", "last thing"),
 * so one non-matching token no longer zeroes a capability. A capability qualifies when a query token
 * hits its id, or when its prose covers at least half the query tokens (rounded up). Hits are weighted
 * by rarity (rare "invite" outranks common "assessment"); id hits weigh 10x prose hits. The honest-miss
 * gate is query-level, in `docs` below: see `mostlyUnknown`.
 */
function scoreCapability(c: Capability, tokens: string[], idx: SearchIndex): number {
  if (tokens.length === 0) return 0;
  const bag = idx.bags.get(c.id)!;
  let idHit = false;
  let proseHits = 0;
  let score = 0;
  for (const t of tokens) {
    const weight = Math.log((idx.n + 1) / ((idx.df.get(t) ?? 0) + 1)) + 1;
    const one = singular(t);
    if (bag.id.has(t)) { idHit = true; score += 10 * weight; }
    else if (bag.prose.has(t) || (one && (bag.id.has(one) || bag.prose.has(one)))) {
      // A plural that only matches as its singular ("workspaces" vs cap.workspace.list) weighs like a
      // prose hit, so it can break a tie between id rows without outranking a real id hit.
      proseHits += 1; score += weight;
    }
  }
  if (!idHit && proseHits < Math.ceil(tokens.length / 2)) return 0;
  return score;
}

/**
 * Honest miss: a query in which at least half the tokens (glue words not counted) are words the docs
 * never use anywhere (registry rows, schema fields, topics) reads as guessed names or noise —
 * "feedback inventedparam", "feedback with inventedparam", "xyzzy flurble create" — and returns no hits
 * rather than a guess (TOPICS: check the schema instead of guessing names). A real phrase with one
 * stray word ("invite someone to my assessment", "invite authentication") is mostly vocabulary and
 * still ranks.
 */
function mostlyUnknown(tokens: string[], idx: SearchIndex): boolean {
  const counted = tokens.filter((t) => !GATE_FILLER.has(t));
  const unknown = counted.filter((t) => !idx.vocab.has(t) && !idx.vocab.has(singular(t) ?? "")).length;
  return unknown * 2 >= counted.length;
}

const DOCS_SEARCH_HIT_CAP = 5;

export const docs: Handler = async (ctx, a) => {
  if (a.capability) {
    const c = byId.get(a.capability);
    if (!c) return { result: { message: `unknown capability ${a.capability}`, index: index() } };
    const p = page(c);
    if (ctx.principal.kind === "user" && /^(O$|S)/.test(c.roles)) {
      // never leak: describe availability in plain words, not a 403
      return { result: { ...p, availability: c.roles === "S" ? "not available to collaborators; KCS support only" : "owners only — ask an owner" } };
    }
    return { result: p };
  }
  if (a.topic) {
    const t = TOPICS[a.topic];
    return { result: t ? { topic: a.topic, text: t } : { message: `unknown topic ${a.topic}`, topics: Object.keys(TOPICS) } };
  }
  if (a.q) {
    const raw = String(a.q);
    const q = raw.toLowerCase();
    const idx = docsSearchIndex();
    const tokens = informativeTokens(tokenizeDocsQuery(raw), idx);
    const ranked = (mostlyUnknown(tokens, idx) ? [] : capabilities)
      .map((c) => ({ c, score: scoreCapability(c, tokens, idx) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id))
      .slice(0, DOCS_SEARCH_HIT_CAP)
      .map(({ c }) => ({ id: c.id, class: c.class, section: c.section }));
    return { result: { q, hits: ranked } };
  }
  if (a.role || a.scope) {
    let role: any = a.role ?? ctx.principal.kind;
    if (a.scope?.type && a.scope?.id && ctx.principal.kind === "user") {
      const r = await roleAt(ctx, a.scope as { type: ScopeType; id: string });
      if (!r) throw new CapError("NOT_FOUND_OR_NOT_VISIBLE", "not found or not visible");
      role = r;
    } else if (ctx.principal.kind === "user" && !a.role) role = "member";
    const can = allowedFor(role);
    // next_best never names a verb the role cannot call (U16): stages whose step is outside `can` are omitted.
    const next_best = Object.fromEntries(Object.entries(NEXT_BEST).filter(([, id]) => can.includes(id)));
    return { result: { role, scope: a.scope ?? null, can, next_best } };
  }
  const roles = ctx.principal.kind === "user" ? (await ctx.db.prepare("SELECT scope_type, scope_id, role FROM grant WHERE principal_id = ?").bind(ctx.principal.id).all()).results : [];
  return { result: {
    what: TOPICS.intro,
    tools: { docs: "explain", read: "class=read", write: "class=write.reversible (+ undo)", danger: "write.effect and write.dangerous, two-step" },
    tool_surface: { count: 4, governed_by: CEILING, reason: "read/write/danger split is the host-level permission boundary; telemetry rides read cap.ops.trace and trace_id on every envelope" },
    auth: "Collaborators sign in by Cloudflare email code → web session. Agents and connectors use OAuth 2.1 on /mcp (discovery at /.well-known/oauth-authorization-server, dynamic client registration, PKCE): the user signs in by email code, approves the named app, and the app acts as that user — auth.me shows delegated_by = oauth:<client_id>; write cap.auth.logout disconnects it. /mcp without a credential answers 401 + WWW-Authenticate. Participants: access code or invitation link → participant token bound to one survey. Agents act as a user, never as a role.",
    topics: Object.keys(TOPICS),
    intents: INTENTS, index: index(), your_roles: roles, contract: `${contractName} @ ${sourceSha}`,
  } };
};

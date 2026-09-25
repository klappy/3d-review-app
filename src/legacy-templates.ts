import type { Ctx } from "./handlers/types";
import midLevelV1Items from "./legacy/mid-level-v1.items.json";

/**
 * Legacy instruments carried verbatim from the Lovable 3D Review builds so responses
 * collected on them can be imported exactly as answered (captain ruling 2026-09-24 18:22).
 * DEV only: seeded lazily with INSERT OR IGNORE, never overwritten, never on production.
 * Unscored: scoring stays held; no crosswalk to the pinned v2 instruments.
 */
export const LEGACY_MID_LEVEL_V1 = {
  id: "tpl_mid_level_v1_legacy",
  version: 1,
  name: "Mid-Level v1 (legacy)",
  perspective: "Translation Team",
  source_ref: "lovable:e9d47eee-2a71-4f45-9b87-41004d2f8cd5@79ccb852a02f5bc216fee450e92806bf290920b2:src/lib/surveys/mid-level.ts",
  rubric_ref: "none: legacy Lovable ML1-ML12 instrument, unscored",
  items: midLevelV1Items,
  scoring: { status: "held", no_score_calculation: true, legacy: true },
} as const;

const LEGACY = [LEGACY_MID_LEVEL_V1];
export const LEGACY_TEMPLATE_IDS = new Set<string>(LEGACY.map((t) => t.id));

export async function ensureLegacyTemplates(ctx: Pick<Ctx, "env" | "db">): Promise<void> {
  if (ctx.env.ENVIRONMENT !== "dev") return;
  await ctx.db.batch(LEGACY.map((t) => ctx.db
    .prepare("INSERT OR IGNORE INTO survey_template (id, version, name, perspective, source_ref, items_json, scoring_json, rubric_ref, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(t.id, t.version, t.name, t.perspective, t.source_ref, JSON.stringify(t.items), JSON.stringify(t.scoring), t.rubric_ref, "2026-09-25T00:00:00.000Z")));
}

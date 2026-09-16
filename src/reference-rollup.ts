/**
 * Exact arithmetic shape of pinned f042cde survey-pipeline/pipeline/04_aggregate.py.
 * This is an internal reference projection, not a D7-safe disclosure or a new
 * policy ruling. In particular the subdimension mean is over SCORED RESPONSE
 * ROWS, not equalized per item. The source's ≥2-item reportability draft is
 * not enforced by its executable rollup; preserve both facts as a tension.
 */
export const REFERENCE_ROLLUP_VERSION = "steve-f042cde-04-aggregate-rowmean-v1";

export interface ScoredRow {
  assessment_id: string;
  item_id: string;
  lens: string;
  sub_dimension: string;
  score: number | null;
  standalone_indicator?: boolean;
}
export interface SubdimensionResult {
  assessment_id: string; lens: string; sub_dimension: string;
  score: number; n_items_included: number;
}
export interface LensResult {
  assessment_id: string; lens: string;
  score: number; n_subdims_included: number;
}
export interface IndicatorResult {
  assessment_id: string; item_id: string; score: number; n_responses: number;
}
export interface CrossLensResult {
  assessment_id: string; construct_code: string;
  triangulated_mean: number; agreement_range: number | null;
  n_lenses_included: number; per_lens: { lens: string; score: number }[];
}

function mean(values: number[]): number { return values.reduce((sum, v) => sum + v, 0) / values.length; }
function key(parts: string[]): string { return JSON.stringify(parts); }
function parts(value: string): string[] { return JSON.parse(value) as string[]; }
function sorted<T>(rows: T[], sortKey: (row: T) => string): T[] {
  return rows.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

/**
 * includedSubdimensions is projected from pinned rubric_csv/SubDimensions.csv.
 * Keys are JSON.stringify([lens,sub_dimension]), avoiding name collisions.
 */
export function rollupReference(rows: ScoredRow[], includedSubdimensions: ReadonlySet<string>): {
  subdimensions: SubdimensionResult[]; lenses: LensResult[]; indicators: IndicatorResult[];
} {
  const subGroups = new Map<string, { values: number[]; items: Set<string> }>();
  const indicatorGroups = new Map<string, number[]>();
  for (const row of rows) {
    if (row.score === null) continue;
    if (!Number.isFinite(row.score) || row.score < 0 || row.score > 100) throw new Error("invalid source score");
    if (row.standalone_indicator) {
      const k = key([row.assessment_id, row.item_id]);
      const values = indicatorGroups.get(k) ?? [];
      values.push(row.score); indicatorGroups.set(k, values);
      continue;
    }
    const k = key([row.assessment_id, row.lens, row.sub_dimension]);
    const group = subGroups.get(k) ?? { values: [], items: new Set<string>() };
    group.values.push(row.score); group.items.add(row.item_id); subGroups.set(k, group);
  }
  const subdimensions = sorted([...subGroups].map(([k, group]) => {
    const [assessment_id, lens, sub_dimension] = parts(k);
    return { assessment_id, lens, sub_dimension, score: mean(group.values), n_items_included: group.items.size };
  }), r => key([r.assessment_id, r.lens, r.sub_dimension]));
  const indicators = sorted([...indicatorGroups].map(([k, values]) => {
    const [assessment_id, item_id] = parts(k);
    return { assessment_id, item_id, score: mean(values), n_responses: values.length };
  }), r => key([r.assessment_id, r.item_id]));
  const lensGroups = new Map<string, number[]>();
  for (const row of subdimensions) {
    if (!includedSubdimensions.has(key([row.lens, row.sub_dimension]))) continue;
    const k = key([row.assessment_id, row.lens]);
    const values = lensGroups.get(k) ?? [];
    values.push(row.score); lensGroups.set(k, values);
  }
  const lenses = sorted([...lensGroups].map(([k, values]) => {
    const [assessment_id, lens] = parts(k);
    return { assessment_id, lens, score: mean(values), n_subdims_included: values.length };
  }), r => key([r.assessment_id, r.lens]));
  return { subdimensions, lenses, indicators };
}

/** Pinned source computes per-lens item-row means, then mean and raw range. */
export function crossLensReference(rows: ScoredRow[], constructs: Record<string, readonly string[]>): CrossLensResult[] {
  const out: CrossLensResult[] = [];
  for (const [construct_code, itemIds] of Object.entries(constructs)) {
    const eligible = new Set(itemIds);
    const groups = new Map<string, Map<string, number[]>>();
    for (const row of rows) {
      if (row.score === null || row.standalone_indicator || !eligible.has(row.item_id)) continue;
      const lensMap = groups.get(row.assessment_id) ?? new Map<string, number[]>();
      const values = lensMap.get(row.lens) ?? [];
      values.push(row.score); lensMap.set(row.lens, values); groups.set(row.assessment_id, lensMap);
    }
    for (const [assessment_id, lensMap] of groups) {
      const per_lens = sorted([...lensMap].map(([lens, values]) => ({ lens, score: mean(values) })), r => r.lens);
      const values = per_lens.map(x => x.score);
      out.push({ assessment_id, construct_code, triangulated_mean: mean(values),
        // `agreement` in Steve's DB is raw max-min, not draft 100-range.
        agreement_range: values.length >= 2 ? Math.max(...values) - Math.min(...values) : null,
        n_lenses_included: values.length, per_lens });
    }
  }
  return sorted(out, r => key([r.assessment_id, r.construct_code]));
}

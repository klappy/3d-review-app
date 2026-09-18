/**
 * Private port of pinned f042cde narrative.py and trajectory_narrative.py.
 * Descriptive relative comparisons only; these strings are not a quality
 * verdict or permission to disclose report values while D7 is held.
 */
export const REFERENCE_NARRATIVE_VERSION = "steve-f042cde-rule-narrative-v1";

export interface NarrativeSubdimension {
  sub_dimension: string;
  score: number | null;
  n_items_included: number;
}
export interface NarrativeLens {
  lens: string;
  score: number | null;
  sub_dimensions: NarrativeSubdimension[];
}
export interface NarrativeCrossLens {
  construct_name: string;
  agreement: number | null; // Source name, but value is a raw range.
  lens_scores: { lens: string; score: number }[];
}
export interface NarrativeEvidence { n: number; form_type?: string }
export interface TrendPoint { cycle_date: string; score: number | null }

// Python f"{value:.0f}" uses half-even rounding, unlike JS toFixed.
function whole(value: number): string {
  if (!Number.isFinite(value)) throw new Error("invalid narrative score");
  const abs = Math.abs(value);
  const floor = Math.floor(abs);
  const fraction = abs - floor;
  const rounded = fraction > 0.5 ? floor + 1 : fraction < 0.5 ? floor : floor % 2 === 0 ? floor : floor + 1;
  return String(value < 0 && rounded !== 0 ? -rounded : rounded);
}

export function buildReferenceNarrative(
  lenses: NarrativeLens[], crossLens: NarrativeCrossLens[], evidence: NarrativeEvidence[],
): string[] {
  const notes: string[] = [];
  const scored = lenses.filter((lens): lens is NarrativeLens & { score: number } => lens.score !== null);
  if (scored.length >= 2) {
    const highest = scored.reduce((best, lens) => lens.score > best.score ? lens : best);
    const lowest = scored.reduce((best, lens) => lens.score < best.score ? lens : best);
    if (highest.lens !== lowest.lens)
      notes.push(`Of the ${scored.length} lenses with data this cycle, ${highest.lens} scored highest at ${whole(highest.score)}; ${lowest.lens} was lowest at ${whole(lowest.score)} — a ${whole(highest.score - lowest.score)}-point spread.`);
    else notes.push(`All lenses with data this cycle scored the same: ${whole(highest.score)}.`);
  } else if (scored.length === 1)
    notes.push(`Only the ${scored[0].lens} lens has scored data this cycle, at ${whole(scored[0].score)}.`);
  else notes.push("No lens has scored data yet this cycle.");

  for (const lens of lenses) {
    const subdims = lens.sub_dimensions.filter((sd): sd is NarrativeSubdimension & { score: number } => sd.score !== null);
    if (subdims.length < 2) continue;
    const weakest = subdims.reduce((best, sd) => sd.score < best.score ? sd : best);
    const caveat = weakest.n_items_included < 2 ? " (a single-item indicator, not a full sub-dimension score)" : "";
    notes.push(`Within ${lens.lens}, ${weakest.sub_dimension} scored lowest at ${whole(weakest.score)}${caveat}.`);
  }

  const flagged = crossLens.filter(c => c.agreement !== null && c.agreement >= 10);
  if (flagged.length) {
    for (const construct of flagged) {
      if (!construct.lens_scores.length) throw new Error("divergent construct without lens scores");
      const low = construct.lens_scores.reduce((best, score) => score.score < best.score ? score : best);
      const high = construct.lens_scores.reduce((best, score) => score.score > best.score ? score : best);
      const tier = construct.agreement! >= 20 ? "high divergence" : "some divergence";
      notes.push(`For ${construct.construct_name}, ${high.lens} (${whole(high.score)}) and ${low.lens} (${whole(low.score)}) see it differently — ${tier} (${whole(construct.agreement!)}-point gap).`);
    }
  } else if (crossLens.length)
    notes.push("Where lenses overlap, they agree closely on every shared construct this cycle.");

  if (evidence.length) {
    const n = evidence.reduce((sum, row) => sum + row.n, 0);
    notes.push(`These results are based on ${n} submission${n !== 1 ? "s" : ""} across ${evidence.length} form type${evidence.length !== 1 ? "s" : ""}.`);
  }
  return notes;
}

/** Source STEADY_BAND=10 and SHARP_DROP_THRESHOLD=15. */
export function buildReferenceTrendNarrative(series: Record<string, TrendPoint[]>): string[] {
  const notes: string[] = [];
  for (const lens of Object.keys(series).sort()) {
    const points = series[lens].filter((point): point is TrendPoint & { score: number } => point.score !== null);
    if (points.length < 2) continue;
    const first = points[0], last = points[points.length - 1];
    const delta = last.score - first.score;
    if (delta >= 10)
      notes.push(`${lens} rose from ${whole(first.score)} to ${whole(last.score)} over ${points.length} cycles (${first.cycle_date} → ${last.cycle_date}, +${whole(delta)}).`);
    else if (delta <= -10)
      notes.push(`${lens} fell from ${whole(first.score)} to ${whole(last.score)} over ${points.length} cycles (${first.cycle_date} → ${last.cycle_date}, ${whole(delta)}).`);
    else notes.push(`${lens} held steady across ${points.length} cycles (${whole(first.score)} → ${whole(last.score)}).`);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1], curr = points[i];
      if (curr.score - prev.score <= -15)
        notes.push(`${lens} dropped sharply between ${prev.cycle_date} and ${curr.cycle_date} (${whole(prev.score)} → ${whole(curr.score)}) — worth investigating what changed.`);
    }
  }
  if (!notes.length) notes.push("Not enough scored cycles yet on any lens to describe a trend.");
  return notes;
}

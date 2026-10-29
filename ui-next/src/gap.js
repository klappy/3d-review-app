// UI Next (v4) layout gap guard. Status: provisional. Gaps are the --sp-1..8 steps (design-system.md 8.2) via data-gap.
export function gapAttr(gap, who) {
  if (gap === undefined || gap === null) return undefined;
  if (!Number.isInteger(gap) || gap < 1 || gap > 8) throw new TypeError(`${who}: gap must be an integer 1..8 (the --sp-* step), got ${String(gap)}`);
  return String(gap);
}

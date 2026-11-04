// Dates stay readable in notes_next_steps. The existing v3 notes serializer owns
// areas/completion metadata; these helpers operate on its parsed text only.
const LABEL = Object.freeze({ followUp: "Follow up on: ", reviewAgain: "Review again on: " });
const BLOCK = /(?:^|\n\n)Follow up on: (\d{4}-\d{2}-\d{2}|—)\nReview again on: (\d{4}-\d{2}-\d{2}|—)$/;
export function validPlanDate(value) {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function readPlanDates(text = "") {
  const value = String(text ?? ""), match = value.match(BLOCK);
  if (!match || ![match[1], match[2]].every(v => v === "—" || validPlanDate(v))) return { text: value, followUp: "", reviewAgain: "" };
  return { text: value.slice(0, match.index), followUp: match[1] === "—" ? "" : match[1], reviewAgain: match[2] === "—" ? "" : match[2] };
}
export function writePlanDates(text, dates) {
  const parsed = readPlanDates(text), followUp = String(dates.followUp ?? parsed.followUp), reviewAgain = String(dates.reviewAgain ?? parsed.reviewAgain);
  if (![followUp, reviewAgain].every(validPlanDate)) throw new Error("Choose valid calendar dates for the plan.");
  if (!followUp && !reviewAgain) return parsed.text;
  return `${parsed.text}${parsed.text ? "\n\n" : ""}${LABEL.followUp}${followUp || "—"}\n${LABEL.reviewAgain}${reviewAgain || "—"}`;
}

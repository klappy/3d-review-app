// A report ID is usable only when the assessment's authorized list contains it.
// An explicit stale/wrong-scope ID is an error, never silently replaced by newest.
export function orderedReports(reports = []) {
  return reports.filter((r) => typeof r?.id === "string" && r.id).slice()
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) || a.id.localeCompare(b.id));
}

export function selectedReport(reports, requested = null) {
  const ordered = orderedReports(reports);
  if (!requested) return ordered[0] ?? null;
  const found = ordered.find((r) => r.id === requested);
  if (!found) throw new Error("This report is not available in this review. Return to the review to choose an available report.");
  return found;
}

export async function readSelectedReport(reports, requested, read) {
  const entry = selectedReport(reports, requested);
  if (!entry) return null;
  const report = entry.payload ? entry : await read(entry.id);
  if (!report || report.id !== entry.id) throw new Error("The selected report could not be confirmed. Try again.");
  return report;
}

export function reportLabel(report) {
  const raw = String(report?.created_at ?? "");
  const date = new Date(raw);
  return `${Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString()} · ${report.id}`;
}

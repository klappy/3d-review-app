// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import History from "../ui-next/src/app/ReportHistory.svelte";
import Results from "../ui-next/src/screens/results/Results.svelte";
import Report from "../ui-next/src/screens/results/Report.svelte";
import Detailed from "../ui-next/src/screens/results/ReportDetailed.svelte";
import Context from "../ui-next/src/screens/results/ReportContext.svelte";
import { orderedReports, readSelectedReport, selectedReport } from "../ui-next/src/app/report-selection.js";
import { imagery, setImagery } from "../ui-next/src/imagery.svelte.js";
const reports = [{ id: "older", created_at: "2026-10-01T12:00:00Z" }, { id: "newest", created_at: "2026-10-29T12:00:00Z" }];
afterEach(() => { cleanup(); setImagery("bars"); localStorage.clear(); });
it("keeps explicit older selection; default chooses newest without mutating server order", async () => {
  const read = vi.fn(async (id) => ({ id, payload: { marker: id } }));
  expect((await readSelectedReport(reports, "older", read))?.payload.marker).toBe("older");
  expect(selectedReport(reports)?.id).toBe("newest");
  expect(reports[0].id).toBe("older");
  expect(orderedReports(reports).map((r) => r.id)).toEqual(["newest", "older"]);
});
it("refuses unknown/wrong-assessment IDs before any individual report read", async () => {
  const read = vi.fn();
  await expect(readSelectedReport(reports, "other-review-report", read)).rejects.toThrow("not available in this review");
  expect(read).not.toHaveBeenCalled();
});
it("refuses mismatched response identity rather than rendering another report", async () => {
  await expect(readSelectedReport(reports, "older", async () => ({ id: "newest", payload: {} }))).rejects.toThrow("could not be confirmed");
});
it("offers every saved version and carries the selected version in a reloadable URL", async () => {
  const view = render(History, { aid: "review/id", reports, selected: "newest", screen: "report-detailed" });
  await fireEvent.change(view.getByLabelText("Report version"), { target: { value: "older" } });
  expect(location.hash).toBe("#/review/review%2Fid/report/detailed?report=older");
  expect(view.getAllByRole("option")).toHaveLength(2);
});
it("retains narrative, indicators, agreement, evidence and escaped provenance from the saved payload", () => {
  const view = render(Context, { report: { reportId: "older", created_at: "2026-10-01", payload: {
    synthetic: true, source_commit: "source-sha", versions: { scorer: "scorer", narrative: "narrator", policy: "policy" },
    narrative: ["<img src=x onerror=alert(1)>"], standalone_indicators: [{ question_text: "Is it clear?", lens: "community", sub_dimension: "clarity", score: 82.5, n_responses: 9 }],
    translation_type_agreement: { team_values: ["meaning-based"], church_values: ["literal"], agree: false }, evidence: [{ label: "Team form", n: 4 }],
  } } });
  expect(view.container.textContent).toContain("Score (out of 100): 82.5");
  expect(view.container.textContent).toContain("Responses: 9");
  expect(view.container.textContent).toContain("Agreed: Meaning-based · Seen as: Literal · Differs");
  expect(view.container.textContent).toContain("Team form · Submissions: 4");
  expect(view.container.textContent).toContain("Report: older");
  expect(view.container.textContent).toContain("<img src=x onerror=alert(1)>");
  expect(view.container.querySelector("img")).toBeNull();
});
for (const [name, Component, phone] of [["phone results", Results, true], ["phone overview", Report, true], ["desktop overview", Report, false], ["phone detailed", Detailed, true], ["desktop detailed", Detailed, false]] as const) {
  it(`${name} exposes the existing persisted metaphor selector`, async () => {
    const view = render(Component, { phone });
    await fireEvent.click(view.getByRole("radio", { name: "Plants" }));
    expect(imagery.skin).toBe("plants");
    expect(localStorage.getItem("ui_next_imagery")).toBe("plants");
    expect(view.container.querySelector(".app")?.getAttribute("data-imagery")).toBe("plants");
  });
}

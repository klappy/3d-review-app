// UI Next (v4) results lane screens for /next/?ui_next=on&screen=<name>. Status: provisional.
// Owned by the results lane cook of the screens fanout: only that lane edits this file (and the rest of screens/results/).
// Default export maps screen name -> Svelte component; names are lowercase kebab-case, unique across all lanes and the
// built-in views (registry.js throws otherwise). The route passes props { phone, theme, state }: phone from ?w=phone,
// theme "light" | "dark", state the raw ?state= value (undefined when absent).
// Boards (cookbook design/2026-10-15-glass-redesign/canvas): Results(+Phone), ResultsAnswers(+Phone), ResultsGaps(+Phone),
// ResultsHeld(+Phone), Report(+ReportPhone), ReportDetailed; a phone twin is the same name with &w=phone.
import Results from "./Results.svelte";
import ResultsAnswers from "./ResultsAnswers.svelte";
import ResultsGaps from "./ResultsGaps.svelte";
import ResultsHeld from "./ResultsHeld.svelte";
import Report from "./Report.svelte";
import ReportDetailed from "./ReportDetailed.svelte";

export default {
  results: Results,
  "results-answers": ResultsAnswers,
  "results-gaps": ResultsGaps,
  "results-held": ResultsHeld,
  report: Report,
  "report-detailed": ReportDetailed,
};

// UI Next (v4) participant lane screens for /next/?ui_next=on&screen=<name>. Status: provisional.
// Owned by the participant lane cook of the screens fanout: only that lane edits this file (and the rest of screens/participant/).
// Default export maps screen name -> Svelte component; names are lowercase kebab-case, unique across all lanes and the
// built-in views (registry.js throws otherwise). The route passes props { phone, theme, state }: phone from ?w=phone,
// theme "light" | "dark", state the raw ?state= value (undefined when absent).
// Boards (cookbook design/2026-10-15-glass-redesign/canvas, all 390x844 phone boards, so each is measured at &w=phone):
//   PWelcome -> p-welcome · PCode -> p-code · PCodeError -> p-code&state=error · PPassage -> p-passage · PAbout -> p-about
//   PQuestion -> p-question · PReview -> p-review · PReceipt -> p-receipt · PProblem -> p-problem (PProblemBusy retired, cookbook PR 198)
// Not boards: p-review&state=all (every answer, "Show all 13 answers"), p-question&q=<n> (question n; the review's Change links).
// An unknown ?state= (or ?q=) renders the default state. Every in-screen link is built with the shared ../href.js href().
import PWelcome from "./PWelcome.svelte";
import PCode from "./PCode.svelte";
import PPassage from "./PPassage.svelte";
import PAbout from "./PAbout.svelte";
import PQuestion from "./PQuestion.svelte";
import PReview from "./PReview.svelte";
import PReceipt from "./PReceipt.svelte";
import PProblem from "./PProblem.svelte";
export default {
  "p-welcome": PWelcome,
  "p-code": PCode,
  "p-passage": PPassage,
  "p-about": PAbout,
  "p-question": PQuestion,
  "p-review": PReview,
  "p-receipt": PReceipt,
  "p-problem": PProblem,
};

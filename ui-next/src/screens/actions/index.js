// UI Next (v4) actions lane screens for /next/?ui_next=on&screen=<name>. Status: provisional.
// Owned by the actions lane cook of the screens fanout: only that lane edits this file (and the rest of screens/actions/).
// Default export maps screen name -> Svelte component; names are lowercase kebab-case, unique across all lanes and the
// built-in views (registry.js throws otherwise). The route passes props { phone, theme, state }: phone from ?w=phone,
// theme "light" | "dark", state the raw ?state= value (undefined when absent).
// Boards (cookbook design/2026-10-15-glass-redesign/canvas): NextStep(+Phone) -> next-step, ActionPlan(+Phone) -> action-plan,
// Print(+Phone) -> print, Share(+Phone) -> share, Sandbox(+Phone) -> sandbox, PaperEntry(+Phone) -> paper-entry, MenuPhone -> menu (phone only).
import NextStep from "./NextStep.svelte";
import ActionPlan from "./ActionPlan.svelte";

export default { "next-step": NextStep, "action-plan": ActionPlan };

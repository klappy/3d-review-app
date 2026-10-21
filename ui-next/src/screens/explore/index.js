// UI Next (v4) explore lane screens for /next/?ui_next=on&screen=<name>. Status: provisional.
// Owned by the explore lane cook of the screens fanout: only that lane edits this file (and the rest of screens/explore/).
// Default export maps screen name -> Svelte component; names are lowercase kebab-case, unique across all lanes and the
// built-in views (registry.js throws otherwise). The route passes props { phone, theme, state }: phone from ?w=phone,
// theme "light" | "dark", state the raw ?state= value (undefined when absent).
// Boards (cookbook design/2026-10-15-glass-redesign/canvas) -> screens:
//   Explore -> explore · ExplorePhone -> explore&w=phone · ExploreFiltersPhone -> explore&w=phone&state=filters
//   Feedback -> feedback · FeedbackPhone -> feedback&w=phone · Help -> help · HelpPhone -> help&w=phone
import Explore from "./Explore.svelte";
import Feedback from "./Feedback.svelte";
import Help from "./Help.svelte";

export default { explore: Explore, feedback: Feedback, help: Help };

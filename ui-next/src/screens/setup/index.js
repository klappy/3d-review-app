// UI Next (v4) setup lane screens for /next/?ui_next=on&screen=<name>. Status: provisional.
// Owned by the setup lane cook of the screens fanout: only that lane edits this file (and the rest of screens/setup/).
// Default export maps screen name -> Svelte component; names are lowercase kebab-case, unique across all lanes and the
// built-in views (registry.js throws otherwise). The route passes props { phone, theme, state }: phone from ?w=phone,
// theme "light" | "dark", state the raw ?state= value (undefined when absent).
// Boards (cookbook design/2026-10-15-glass-redesign/canvas): setup1..setup5 = Setup1..Setup5.dc.html; their &w=phone twins are
// Setup1Phone, Setup2Phone, SetupPhone (step 3 on a phone), Setup4Phone, Setup5Phone; project = Project.dc.html, &w=phone ProjectPhone.
import Setup1 from "./Setup1.svelte";
import Setup2 from "./Setup2.svelte";
import Setup3 from "./Setup3.svelte";
import Setup4 from "./Setup4.svelte";
import Setup5 from "./Setup5.svelte";
import Project from "./Project.svelte";

export default { setup1: Setup1, setup2: Setup2, setup3: Setup3, setup4: Setup4, setup5: Setup5, project: Project };

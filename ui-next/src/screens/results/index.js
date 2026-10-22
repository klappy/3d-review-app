// UI Next (v4) results lane screens for /next/?ui_next=on&screen=<name>. Status: provisional.
// Owned by the results lane cook of the screens fanout: only that lane edits this file (and the rest of screens/results/).
// Default export maps screen name -> Svelte component; names are lowercase kebab-case, unique across all lanes and the
// built-in views (registry.js throws otherwise). The route passes props { phone, theme, state }: phone from ?w=phone,
// theme "light" | "dark", state the raw ?state= value (undefined when absent). Example:
//   import Example from "./Example.svelte";
//   export default { "example-screen": Example };
export default {};

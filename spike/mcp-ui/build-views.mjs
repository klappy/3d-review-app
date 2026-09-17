// Generates the two self-contained view files: design-system CSS copied inline,
// spike CSS inline, SDK bundle marker for server.mjs to inline at read time.
import { readFileSync, writeFileSync } from "node:fs";
const S = import.meta.dirname;
const B = `${S}/views/src`;
const tokens = readFileSync(`${S}/views/vendor/tokens.css`, "utf8");
const components = readFileSync(`${S}/views/vendor/components.css`, "utf8");
const spikeCss = `
/* spike-only additions (not part of the app design system) */
.wrap { max-width: 72rem; margin: 0 auto; padding: 1.5rem; }
.fixture-badge { display: inline-block; margin: 0 0 .5rem; padding: .15rem .6rem; border-radius: 999px;
  background: rgba(255, 196, 0, .18); border: 1px solid rgba(255, 196, 0, .5); font-size: .8rem; letter-spacing: .02em; }
.lens-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 1rem; }
.lens-group h2 { margin-top: 0; font-size: 1.05rem; }
.lens-included { list-style: none; padding: 0; margin: .5rem 0 0; }
.lens-included li { padding: .3rem 0; border-top: 1px solid rgba(255,255,255,.08); font-size: .92rem; }
.response-total { font-weight: 600; margin: .1rem 0 .3rem; }
.view-header h1 { margin: .2rem 0; }
.view-footer { display: flex; gap: .75rem; align-items: center; margin-top: 1.25rem; flex-wrap: wrap; }
.envelope { white-space: pre-wrap; padding: .75rem; border-radius: .5rem; background: rgba(0,0,0,.28);
  border: 1px solid rgba(255,255,255,.12); font-size: .85rem; overflow-x: auto; }
.check { display: flex; align-items: center; gap: .45rem; }
.pending-flag { font-weight: 600; }
input:disabled + span { opacity: .65; }
.note { font-size: .85rem; opacity: .85; }
`;
const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<!-- Design tokens and components copied from ui/design-system/ of klappy/3d-review-app @ main b0bb9c9.
     Copied, not linked: the served resource must be self-contained.
     One deliberate edit to the copy: the Google Fonts @import at components.css:4 is stripped
     (no-CDN rule). body carries class="rv" because the app's components.css is scoped under .rv
     (ui/index.html: <body class="rv" ...>). -->
<style>
${tokens}
${components}
${spikeCss}
</style>
<script>
/*__APP_SDK_BUNDLE__*/
</script>
</head>
<body class="rv" data-view-state="loading">
${body}
</body>
</html>
`;
writeFileSync(`${S}/views/overview.html`, page("3d-review assessment overview (spike)", readFileSync(`${B}/overview-body.html`, "utf8")));
writeFileSync(`${S}/views/selector.html`, page("3d-review survey selector (spike)", readFileSync(`${B}/selector-body.html`, "utf8")));
console.log("views written");

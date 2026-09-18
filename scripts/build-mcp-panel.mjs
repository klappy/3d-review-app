// Builds src/mcp-panel.html (served by src/mcp.ts as resource ui://3d-review/panel.html) from ui/mcp/panel-src.html.
// Inlines: the MCP Apps app SDK bundle (@modelcontextprotocol/ext-apps app-with-deps), the shell's design tokens/styles
// (ui/assess/index.html <style>, same visual family as the browser shell) and the shared cards (ui/assess/cards.js).
// The output must fetch nothing off-origin: asserted here and in ui/mcp/panel.test.mjs.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sdk = readFileSync(require.resolve('@modelcontextprotocol/ext-apps/app-with-deps'), 'utf8');
// ESM bundle → global: strip the trailing export and expose the App class as window.McpApps.App
const m = /export\s*\{([^}]*)\}\s*;?\s*$/.exec(sdk.trimEnd());
if (!m) throw new Error('unexpected SDK bundle shape');
const exportsMap = Object.fromEntries(m[1].split(',').map(s => s.trim()).filter(Boolean).map(s => { const [local, exported] = s.split(/\s+as\s+/); return [(exported || local).trim(), local.trim()]; }));
if (!exportsMap.App) throw new Error('SDK bundle exports no App');
const sdkGlobal = sdk.slice(0, m.index) + `\nwindow.McpApps = { App: ${exportsMap.App} };\n`;
const shell = readFileSync(new URL('../ui/assess/index.html', import.meta.url), 'utf8');
const style = /<style>([\s\S]*?)<\/style>/.exec(shell)[1];
const cards = readFileSync(new URL('../ui/assess/cards.js', import.meta.url), 'utf8').replace(/^export\s+(const|function)\s/gm, '$1 ');
const src = readFileSync(new URL('../ui/mcp/panel-src.html', import.meta.url), 'utf8');
const extra = `.panel-head{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid var(--edge)}body{padding:0 16px 32px;max-width:1120px;margin:auto}.crumbs{display:flex;flex-wrap:wrap;gap:6px;font-size:13px;margin:10px 0}.view-tabs a{flex:1;text-align:center;padding:9px 8px;color:var(--muted);border-radius:11px;font-weight:600;text-decoration:none}.view-tabs a[aria-current=page]{color:var(--ink);background:#ffffffd0}@media (max-width:650px){.view-tabs{flex-wrap:wrap}.view-tabs a{flex:1 1 30%;padding:8px 6px;font-size:14px;min-width:0}}.grid.start{align-items:start}#status.alert{color:#8a2a1c}.grants{width:100%;border-collapse:collapse}.grants td,.grants th{text-align:left;padding:6px 4px;border-bottom:1px solid var(--line)}.entity-card{display:block;text-decoration:none;color:inherit}`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>3D Review</title><style>${style}${extra}</style></head><body>${src.replace('/*__APP_SDK_BUNDLE__*/', () => sdkGlobal).replace('/*__CARDS__*/', () => cards)}</body></html>`;
for (const bad of [/\bsrc=["']https?:/i, /\bhref=["']https?:/i, /@import\s+url\(\s*["']?https?:/i]) if (bad.test(html)) throw new Error('off-origin reference in panel: ' + bad);
writeFileSync(new URL('../src/mcp-panel.html', import.meta.url), html);
console.log('src/mcp-panel.html', html.length, 'bytes');

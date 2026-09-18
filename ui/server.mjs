import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const upstream = process.env.UI_API_ORIGIN || 'http://127.0.0.1:8787';
const files = { '/participant-view.js': ['participant-view.js', 'text/javascript'], '/participant-view.css': ['participant-view.css', 'text/css'], '/workspace-overview.js': ['workspace-overview.js', 'text/javascript'], '/workspace-overview.css': ['workspace-overview.css', 'text/css'], '/stage-composition.js': ['stage-composition.js', 'text/javascript'], '/stage-composition.css': ['stage-composition.css', 'text/css'], '/stage-screens.js': ['stage-screens.js', 'text/javascript'], '/stage-screens.css': ['stage-screens.css', 'text/css'], '/report-card.js': ['report-card.js', 'text/javascript'], '/report-cards.css': ['report-cards.css', 'text/css'], '/public-entry.js': ['public-entry.js', 'text/javascript'], '/shared-link.js': ['shared-link.js', 'text/javascript'], '/changelog.js': ['changelog.js', 'text/javascript'], '/report-view.js': ['report-view.js', 'text/javascript'], '/context-tree.js': ['context-tree.js', 'text/javascript'], '/design-system/tokens.css': ['design-system/tokens.css', 'text/css'], '/design-system/components.css': ['design-system/components.css', 'text/css'], '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/language.js': ['language.js', 'text/javascript'], '/present.js': ['present.js', 'text/javascript'], '/visibility.js': ['visibility.js', 'text/javascript'], '/participant-resume.js': ['participant-resume.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/diagnostic-path.js': ['diagnostic-path.js', 'text/javascript'], '/collab-mount.js': ['collab-mount.js', 'text/javascript'], '/workspace-manager.js': ['workspace-manager.js', 'text/javascript'], '/workspace-manager.css': ['workspace-manager.css', 'text/css'], '/scope-invitations.js': ['scope-invitations.js', 'text/javascript'], '/scope-invitations.css': ['scope-invitations.css', 'text/css'], '/entity-screen.js': ['entity-screen.js', 'text/javascript'], '/entity-screen.css': ['entity-screen.css', 'text/css'], '/lens-surveys.js': ['lens-surveys.js', 'text/javascript'], '/lens-surveys.css': ['lens-surveys.css', 'text/css'], '/context-tree.css': ['context-tree.css', 'text/css'], '/public-choices.css': ['public-choices.css', 'text/css'], '/assess/': ['assess/index.html', 'text/html'], '/legacy/': ['legacy/index.html', 'text/html'], '/assess/cards.js': ['assess/cards.js', 'text/javascript'], '/assess/scope.js': ['assess/scope.js', 'text/javascript'], '/assess/views.js': ['assess/views.js', 'text/javascript'], '/assess/share.js': ['assess/share.js', 'text/javascript'], '/assess/permissions.js': ['assess/permissions.js', 'text/javascript'], '/assess/vendor-qrcode.js': ['assess/vendor-qrcode.js', 'text/javascript'], '/shared-link.js': ['shared-link.js', 'text/javascript'], '/assess/assess.js': ['assess/assess.js', 'text/javascript'], '/assess/whats-here.js': ['assess/whats-here.js', 'text/javascript'] };
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path.startsWith('/v2/')) {
    try {
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await new Promise((resolve, reject) => {
        const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject);
      });
      const headers = {};
      for (const name of ['accept', 'content-type', 'authorization', 'cookie']) if (req.headers[name]) headers[name] = req.headers[name];
      const response = await fetch(new URL(req.url, upstream), { method: req.method, headers, body });
      const outgoing = Object.fromEntries(response.headers);
      // Node fetch has already decoded the body; these upstream wire headers
      // must not describe the decoded bytes sent by this local proxy.
      for (const name of ['content-encoding', 'content-length', 'transfer-encoding', 'connection']) delete outgoing[name];
      res.writeHead(response.status, outgoing);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Local Worker is not reachable' } })); }
    return;
  }
  const file = files[path];
  if (!file) { res.writeHead(404); res.end(); return; }
  try { const body = await readFile(join(root, file[0])); res.writeHead(200, { 'content-type': file[1], 'cache-control': 'no-store' }); res.end(body); }
  catch { res.writeHead(500); res.end(); }
}).listen(Number(process.env.UI_PORT || 5174), '127.0.0.1', () => console.log('Temporary UI shell: http://127.0.0.1:' + (process.env.UI_PORT || 5174)));

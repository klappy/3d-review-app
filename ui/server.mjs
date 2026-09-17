import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const upstream = process.env.UI_API_ORIGIN || 'http://127.0.0.1:8787';
const files = { '/shared-link.js': ['shared-link.js', 'text/javascript'], '/changelog.js': ['changelog.js', 'text/javascript'], '/report-view.js': ['report-view.js', 'text/javascript'], '/context-tree.js': ['context-tree.js', 'text/javascript'], '/design-system/tokens.css': ['design-system/tokens.css', 'text/css'], '/design-system/components.css': ['design-system/components.css', 'text/css'], '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/language.js': ['language.js', 'text/javascript'], '/present.js': ['present.js', 'text/javascript'], '/visibility.js': ['visibility.js', 'text/javascript'], '/participant-resume.js': ['participant-resume.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
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
  try { res.writeHead(200, { 'content-type': file[1], 'cache-control': 'no-store' }); res.end(await readFile(join(root, file[0]))); }
  catch { res.writeHead(500); res.end(); }
}).listen(Number(process.env.UI_PORT || 5174), '127.0.0.1', () => console.log('Temporary UI shell: http://127.0.0.1:' + (process.env.UI_PORT || 5174)));

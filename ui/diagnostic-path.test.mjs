import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {redactDiagnosticPath} from './diagnostic-path.js';

const SENTINEL='SENTINEL_TOKEN_9f3b1c7e2a';
test('invitation accept token is redacted, other paths untouched',()=>{
  assert.equal(redactDiagnosticPath(`/v2/invitations/${SENTINEL}/accept`),'/v2/invitations/[redacted]/accept');
  assert.equal(redactDiagnosticPath(`/v2/invitations/${encodeURIComponent('a b/'+SENTINEL)}/accept`),'/v2/invitations/[redacted]/accept');
  assert.equal(redactDiagnosticPath(`/v2/invitations/${SENTINEL}/accept?x=1#y`),'/v2/invitations/[redacted]/accept');
  for(const p of ['/v2/invitations/inv_123','/v2/workspaces/ws_1/invitations','/v2/me','/v2/invitations//accept'])
    assert.equal(redactDiagnosticPath(p),p);
  assert.ok(!redactDiagnosticPath(`/v2/invitations/${SENTINEL}/accept`).includes(SENTINEL));
});
test('app.js applies the redaction to the #events line and nowhere logs the raw url',()=>{
  const app=readFileSync(fileURLToPath(new URL('./app.js',import.meta.url)),'utf8');
  assert.ok(app.includes("import { redactDiagnosticPath } from './diagnostic-path.js';"));
  assert.ok(app.includes("li.textContent = `${method} ${redactDiagnosticPath(url)} ·"));
  assert.ok(!/console\.(log|info|warn|error)\([^)]*\burl\b/.test(app.slice(app.indexOf('async function api('),app.indexOf('async function run('))),'api() never console-logs the url');
});

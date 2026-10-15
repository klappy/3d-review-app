import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sandboxToolsEnabled } from './sandbox-tools.js';

test('sandbox presentation requires explicit opt-in on an exact DEV or loopback host', () => {
  for (const hostname of ['dev.3dreview.app', 'localhost', '127.0.0.1', '[::1]']) {
    assert.equal(sandboxToolsEnabled({ hostname, search: '?dev-tools=signin' }), true);
    for (const search of ['', '?dev-tools=true', '?demo=1']) assert.equal(sandboxToolsEnabled({ hostname, search }), false);
  }
  for (const hostname of ['3dreview.app', 'www.3dreview.app', 'dev.3dreview.app.example.com', '']) {
    assert.equal(sandboxToolsEnabled({ hostname, search: '?dev-tools=signin' }), false);
  }
});

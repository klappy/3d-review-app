import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandCard, bandLegend, BAND_LEGEND } from './band-card.js';
test('bandCard: lens, word, escaped, caller body kept', () => {
  const h = bandCard({ lens: 'Church', word: 'Growing', bodyHtml: '<p>b</p>' });
  assert.match(h, /class="glass band lens church" data-v3-band="Church" data-v3-band-word="Growing"/);
  assert.match(h, /<div class="word">Growing<\/div><p>b<\/p>/);
  assert.match(bandCard({ lens: '<x>', word: 'a"b' }), /&lt;x&gt;.*a&quot;b/);
});
test('bandLegend: five token dots', () => {
  const h = bandLegend();
  assert.equal(BAND_LEGEND.length, 5);
  for (const [w, v] of BAND_LEGEND) assert.ok(h.includes(`<i class="dot" style="background:var(${v})" aria-hidden="true"></i>${w}`), w);
});

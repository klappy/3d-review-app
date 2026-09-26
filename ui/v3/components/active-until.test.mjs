import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packPeriod, parsePeriod, formatDate, activeUntilLine, periodText, closedLine, periodErrors, todayIso } from './active-until.js';

test('B41: Starts optional, Active until required, packed into the existing period field', () => {
  assert.equal(packPeriod('2026-09-25', '2026-10-31'), 'Starts 2026-09-25 · Active until 2026-10-31');
  assert.equal(packPeriod('', '2026-10-31'), 'Active until 2026-10-31');
  assert.equal(packPeriod('2026-09-25', ''), '');
  assert.deepEqual(parsePeriod('Starts 2026-09-25 · Active until 2026-10-31'), { starts: '2026-09-25', until: '2026-10-31' });
  assert.deepEqual(parsePeriod('Active until 2026-10-31'), { starts: null, until: '2026-10-31' });
  for (const old of ['October 2026', '', null, 'Active until soon']) assert.equal(parsePeriod(old), null, String(old));
});

test('B41: plain lines for Collect and participant links', () => {
  assert.equal(formatDate('2026-10-31'), '31 October 2026');
  assert.equal(activeUntilLine('Starts 2026-09-25 · Active until 2026-10-31'), 'Active until 31 October 2026');
  assert.equal(activeUntilLine('October 2026'), '');
  assert.equal(periodText('October 2026'), 'October 2026');
  assert.equal(closedLine('Active until 2026-10-31', '2026-10-31'), '', 'open through the Active until day');
  assert.equal(closedLine('Active until 2026-10-31', '2026-11-01'), 'This survey closed on 31 October 2026.');
  assert.equal(closedLine('October 2026', '2099-01-01'), '', 'older free-text periods never close a link');
  assert.match(todayIso(new Date(2026, 8, 5)), /^2026-09-05$/);
});

test('B41: setup validation', () => {
  assert.equal(periodErrors('', '').length, 1);
  assert.deepEqual(periodErrors('', '2026-10-31'), []);
  assert.deepEqual(periodErrors('2026-09-25', '2026-10-31'), []);
  assert.equal(periodErrors('2026-11-01', '2026-10-31').length, 1);
});

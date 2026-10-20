import { describe, expect, it } from 'vitest';
import { buildReferenceNarrative, narrativeConstructName, NO_CONSTRUCT_NAME, type NarrativeCrossLens } from '../src/reference-narrative';
import { constructName, NO_NAME } from '../ui/report-lenses.js';

const lensScores = [{ lens: 'church', score: 40 }, { lens: 'team', score: 65 }];
const cross = (construct_name: NarrativeCrossLens['construct_name']): NarrativeCrossLens => ({ construct_name, agreement: 25, lens_scores: lensScores });
const constructNote = (name: NarrativeCrossLens['construct_name']) => buildReferenceNarrative([], [cross(name)], []).find(n => n.startsWith('For '));

describe('reference narrative construct name', () => {
  it('prints an em dash for a missing, null, empty or whitespace-only construct name', () => {
    for (const name of [undefined, null, '', '   ', '\t\n']) {
      const note = constructNote(name);
      expect(note).toBe('For —, team (65) and church (40) see it differently — high divergence (25-point gap).');
      expect(note).not.toMatch(/undefined|null|For ,|For\s{2,}/);
    }
  });
  it('leaves non-blank names unchanged, including surrounding spaces', () => {
    expect(constructNote('Scripture Use')).toBe('For Scripture Use, team (65) and church (40) see it differently — high divergence (25-point gap).');
    expect(constructNote(' Padded ')).toContain('For  Padded , team');
  });
  it('matches the UI constructName() rule value for value', () => {
    expect(NO_CONSTRUCT_NAME).toBe(NO_NAME);
    for (const name of [undefined, null, '', '  ', 'Name', ' x ', 0, 'null'])
      expect(narrativeConstructName(name)).toBe(constructName(name));
  });
});

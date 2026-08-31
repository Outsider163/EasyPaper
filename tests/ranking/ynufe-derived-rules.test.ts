import { describe, expect, it } from 'vitest';

import { ccf2026SeedMatcher } from '../../src/ranking/registry';

describe('YNUFE 2026 CCF-derived rules', () => {
  it('maps CCF A/B to school C when no higher appendix rank exists', () => {
    expect(ccf2026SeedMatcher.match({ candidate: 'CIKM' })).toMatchObject({
      status: 'matched',
      venue: {
        ccf: { rank: 'B' },
        school: { rank: 'C', catalog: '云南财经大学', edition: '2026' },
      },
    });
  });

  it('maps CCF C to school D when no higher appendix rank exists', () => {
    expect(ccf2026SeedMatcher.match({ candidate: 'APWeb' })).toMatchObject({
      status: 'matched',
      venue: {
        ccf: { rank: 'C' },
        school: { rank: 'D', catalog: '云南财经大学', edition: '2026' },
      },
    });
  });
});

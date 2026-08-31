import { describe, expect, it } from 'vitest';

import { createVenueMatcher } from '../../src/ranking/matcher';
import {
  normalizeVenueAcronym,
  normalizeVenueName,
} from '../../src/ranking/normalize';
import { ccf2026SeedMatcher } from '../../src/ranking/registry';
import type { VenueRecord } from '../../src/ranking/types';

const TEST_VENUES: VenueRecord[] = [
  {
    id: 'venue:alpha',
    type: 'conference',
    canonicalName: 'Alpha Conference on Testing',
    aliases: ['Proceedings of Alpha Testing'],
    acronyms: ['ACT', 'A.C.T.'],
  },
  {
    id: 'venue:beta',
    type: 'journal',
    canonicalName: 'Beta Journal',
    aliases: [],
    acronyms: ['BJ'],
  },
];

describe('venue normalization', () => {
  it('normalizes Unicode form, NBSP, case, and repeated whitespace', () => {
    expect(normalizeVenueName('  Ａｌｐｈａ\u00a0  Conference  ')).toBe(
      'alpha conference',
    );
  });

  it('keeps semantically meaningful symbols distinct', () => {
    expect(normalizeVenueName('Science & Technology')).not.toBe(
      normalizeVenueName('Science and Technology'),
    );
    expect(normalizeVenueName('IEEE/ACM')).not.toBe(
      normalizeVenueName('IEEE ACM'),
    );
    expect(normalizeVenueName('C++')).not.toBe(normalizeVenueName('C'));
  });

  it('folds dots and spaces only for acronym keys', () => {
    expect(normalizeVenueAcronym('A. C. T.')).toBe('act');
  });
});

describe('venue matcher', () => {
  const matcher = createVenueMatcher(TEST_VENUES);

  it('matches canonical names and curated aliases with high confidence', () => {
    expect(
      matcher.match({ candidate: 'ALPHA   CONFERENCE ON TESTING' }),
    ).toMatchObject({
      status: 'matched',
      matchedBy: 'canonicalName',
      confidence: 'high',
    });
    expect(
      matcher.match({ candidate: 'Proceedings of Alpha Testing' }),
    ).toMatchObject({
      status: 'matched',
      matchedBy: 'alias',
      confidence: 'high',
    });
  });

  it('matches curated acronyms with medium confidence', () => {
    expect(matcher.match({ candidate: 'A.C.T.' })).toMatchObject({
      status: 'matched',
      matchedBy: 'acronym',
      confidence: 'medium',
    });
  });

  it('refuses truncated, substring, and misspelled candidates', () => {
    expect(
      matcher.match({
        candidate: 'Alpha Conference on Testing',
        sourceTruncated: true,
      }),
    ).toMatchObject({ status: 'unmatched', reason: 'truncated-source' });
    expect(matcher.match({ candidate: 'Alpha Conference' })).toMatchObject({
      status: 'unmatched',
      reason: 'no-exact-match',
    });
    expect(matcher.match({ candidate: 'Alfa Conference on Testing' })).toMatchObject({
      status: 'unmatched',
      reason: 'no-exact-match',
    });
  });

  it('returns ambiguous when two venues share an acronym', () => {
    const conflicting = createVenueMatcher([
      ...TEST_VENUES,
      {
        id: 'venue:gamma',
        type: 'conference',
        canonicalName: 'Gamma Conference',
        aliases: [],
        acronyms: ['ACT'],
      },
    ]);

    expect(conflicting.match({ candidate: 'ACT' })).toMatchObject({
      status: 'ambiguous',
      reason: 'key-conflict',
    });
  });

  it('reports missing candidates without throwing', () => {
    expect(matcher.match({ candidate: undefined })).toMatchObject({
      status: 'unmatched',
      reason: 'missing-candidate',
    });
  });
});

describe('bundled CCF seventh-edition registry', () => {
  it('keeps the one same-name journal/conference pair explicitly ambiguous', () => {
    expect(ccf2026SeedMatcher.conflicts).toEqual([
      expect.objectContaining({
        namespace: 'name',
        key: 'computational visual media',
      }),
    ]);
    expect(
      ccf2026SeedMatcher.match({ candidate: 'Computational Visual Media' }),
    ).toMatchObject({ status: 'ambiguous', reason: 'key-conflict' });
  });

  it('matches Scholar proceedings names to CCF A venues', () => {
    const neurips = ccf2026SeedMatcher.match({
      candidate: 'Advances in Neural Information Processing Systems',
    });
    const cvpr = ccf2026SeedMatcher.match({
      candidate:
        'Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition',
    });

    expect(neurips).toMatchObject({
      status: 'matched',
      venue: { ccf: { rank: 'A' } },
    });
    expect(cvpr).toMatchObject({
      status: 'matched',
      venue: { ccf: { rank: 'A' } },
    });
  });
});

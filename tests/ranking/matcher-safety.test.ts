import { describe, expect, it } from 'vitest';

import {
  CCF_7TH_PDF_ROW_COUNT,
  CCF_7TH_VENUES,
} from '../../src/ranking/data/ccf-7th';
import { BUNDLED_CATALOG_STATS } from '../../src/ranking/data/bundled';
import { YNUFE_2026_VENUES } from '../../src/ranking/data/ynufe-2026';
import { createVenueMatcher } from '../../src/ranking/matcher';
import { normalizeVenueAcronym } from '../../src/ranking/normalize';
import { ccf2026SeedMatcher } from '../../src/ranking/registry';
import type { VenueRecord } from '../../src/ranking/types';

function venue(
  id: string,
  canonicalName: string,
  options: Pick<VenueRecord, 'aliases' | 'acronyms'> = { aliases: [] },
): VenueRecord {
  return {
    id,
    type: 'conference',
    canonicalName,
    aliases: options.aliases,
    acronyms: options.acronyms,
  };
}

describe('venue matcher safety boundaries', () => {
  it('preserves ordinary acronym spaces but folds dotted initialisms', () => {
    expect(normalizeVenueAcronym('Foo Bar')).toBe('foo bar');
    expect(normalizeVenueAcronym('N. I. P. S.')).toBe('nips');

    const matcher = createVenueMatcher([
      venue('venue:foobar', 'Foobar Symposium', {
        aliases: [],
        acronyms: ['FOOBAR'],
      }),
    ]);
    expect(matcher.match({ candidate: 'foo bar' })).toMatchObject({
      status: 'unmatched',
      reason: 'no-exact-match',
    });
  });

  it('reports conflicts spanning the strict-name and acronym indexes', () => {
    const matcher = createVenueMatcher([
      venue('venue:name', 'ACT'),
      venue('venue:acronym', 'Another Conference on Testing', {
        aliases: [],
        acronyms: ['ACT'],
      }),
    ]);

    expect(matcher.conflicts).toEqual([
      expect.objectContaining({ namespace: 'cross', key: 'act' }),
    ]);
    expect(matcher.match({ candidate: 'ACT' })).toMatchObject({
      status: 'ambiguous',
      reason: 'key-conflict',
    });
  });

  it('rejects duplicate ids instead of silently merging records', () => {
    expect(() =>
      createVenueMatcher([
        venue('venue:duplicate', 'First Venue'),
        venue('venue:duplicate', 'Second Venue'),
      ]),
    ).toThrow('Duplicate venue id: venue:duplicate');
  });

  it('deduplicates repeated keys on one venue without creating ambiguity', () => {
    const matcher = createVenueMatcher([
      venue('venue:repeat', 'Repeated Venue', {
        aliases: ['Repeated Venue', 'Repeated Venue'],
        acronyms: ['RV', 'RV'],
      }),
    ]);

    expect(matcher.conflicts).toEqual([]);
    expect(matcher.match({ candidate: 'Repeated Venue' })).toMatchObject({
      status: 'matched',
      matchedBy: 'canonicalName',
    });
  });

  it('detects a canonical-name versus alias conflict', () => {
    const matcher = createVenueMatcher([
      venue('venue:canonical', 'Shared Venue'),
      venue('venue:alias', 'Other Venue', { aliases: ['Shared Venue'] }),
    ]);

    expect(matcher.conflicts).toEqual([
      expect.objectContaining({ namespace: 'name', key: 'shared venue' }),
    ]);
    expect(matcher.match({ candidate: 'Shared Venue' })).toMatchObject({
      status: 'ambiguous',
    });
  });

  it('rejects exact-looking input when truncated and rejects added years', () => {
    const matcher = createVenueMatcher([
      venue('venue:alpha', 'Alpha Conference'),
    ]);

    expect(
      matcher.match({ candidate: 'Alpha Conference', sourceTruncated: true }),
    ).toMatchObject({ status: 'unmatched', reason: 'truncated-source' });
    expect(matcher.match({ candidate: 'Alpha Conference 2026' })).toMatchObject({
      status: 'unmatched',
      reason: 'no-exact-match',
    });
  });
});

describe('bundled catalog integrity', () => {
  it('contains all PDF rows with verified rank totals', () => {
    expect(CCF_7TH_PDF_ROW_COUNT).toBe(681);
    expect(CCF_7TH_VENUES).toHaveLength(677);
    expect(countByRank(CCF_7TH_VENUES, 'ccf')).toEqual({
      A: 95,
      B: 243,
      C: 339,
    });
    expect(
      CCF_7TH_VENUES.filter((venue) => venue.categories.length > 1),
    ).toHaveLength(4);

    expect(YNUFE_2026_VENUES).toHaveLength(992);
    expect(countByRank(YNUFE_2026_VENUES, 'school')).toEqual({
      A: 402,
      B: 472,
      权威: 118,
    });
    expect(BUNDLED_CATALOG_STATS.activeVenues).toBeGreaterThan(1500);
  });

  it('matches representative CCF A/B/C and YNUFE records', () => {
    expect(ccf2026SeedMatcher.match({ candidate: 'TOCS' })).toMatchObject({
      status: 'matched',
      venue: { ccf: { rank: 'A' } },
    });
    expect(ccf2026SeedMatcher.match({ candidate: 'TKDD' })).toMatchObject({
      status: 'matched',
      venue: { ccf: { rank: 'B' } },
    });
    expect(ccf2026SeedMatcher.match({ candidate: 'DPD' })).toMatchObject({
      status: 'matched',
      venue: { ccf: { rank: 'C' } },
    });
    expect(ccf2026SeedMatcher.match({ candidate: '中国社会科学' })).toMatchObject({
      status: 'matched',
      venue: { school: { rank: '权威', catalog: '云南财经大学' } },
    });
    expect(
      ccf2026SeedMatcher.match({
        candidate: 'AAAI Conference on Artificial Intelligence',
      }),
    ).toMatchObject({
      status: 'matched',
      venue: {
        ccf: { rank: 'A' },
        school: { rank: 'A', catalog: '云南财经大学' },
      },
    });
  });

  it('does not fuzzy-match a title-like or year-suffixed source', () => {
    for (const candidate of [
      'A Study Published in TOCS',
      'ACM SIGMOD Conference 2026',
      'IEEE Transactions on Pattern Analysis',
    ]) {
      expect(ccf2026SeedMatcher.match({ candidate })).toMatchObject({
        status: 'unmatched',
        reason: 'no-exact-match',
      });
    }
  });
});

function countByRank(
  venues: readonly VenueRecord[],
  field: 'ccf' | 'school',
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const venue of venues) {
    const rank = venue[field]?.rank;
    if (rank) {
      result[rank] = (result[rank] ?? 0) + 1;
    }
  }
  return result;
}

import { describe, expect, it } from 'vitest';

import { YNUFE_2026_VENUES } from '../../src/ranking/data/ynufe-2026';

describe('YNUFE 2026 source quality', () => {
  it('distinguishes 12 listed conferences from journals and Chinese serials', () => {
    const conferences = YNUFE_2026_VENUES.filter(
      (venue) => venue.type === 'conference',
    );
    const journals = YNUFE_2026_VENUES.filter(
      (venue) => venue.type === 'journal',
    );

    expect(conferences).toHaveLength(12);
    expect(journals).toHaveLength(980);
    expect(conferences.map((venue) => venue.canonicalName)).toContain(
      'International Conference on Machine Learning',
    );
  });

  it('keeps four ISSN-less Chinese serials as clean journal names', () => {
    expect(
      YNUFE_2026_VENUES.filter((venue) =>
        ['ynufe-2026:119', 'ynufe-2026:120', 'ynufe-2026:125', 'ynufe-2026:126'].includes(
          venue.id,
        ),
      ).map((venue) => [venue.type, venue.canonicalName]),
    ).toEqual([
      ['journal', '管理学研究（管理学季刊）'],
      ['journal', '金融学季刊'],
      ['journal', '营销科学学报'],
      ['journal', '中国会计评论'],
    ]);
  });
});

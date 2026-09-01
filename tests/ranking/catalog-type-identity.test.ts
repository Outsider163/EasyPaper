import { describe, expect, it } from 'vitest';

import { parseVenueCatalog } from '../../src/ranking/catalog-import';

describe('catalog identity includes venue type', () => {
  it('allows a journal and conference to share the same visible name', () => {
    const result = parseVenueCatalog(
      [
        '期刊名称,类型,CCF级别',
        'Shared Academic Venue,期刊,A',
        'Shared Academic Venue,会议,B',
      ].join('\n'),
      'same-name.csv',
    );

    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => record.type)).toEqual([
      'journal',
      'conference',
    ]);
  });
});

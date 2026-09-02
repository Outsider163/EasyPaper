import { describe, expect, it } from 'vitest';

import {
  CATALOG_CSV_HEADERS,
  parseVenueCatalog,
  serializeVenueCatalog,
} from '../../src/ranking/catalog-import';
import type { VenueRecord } from '../../src/ranking/types';

describe('catalog export', () => {
  it('round-trips every supported ranking and label field', () => {
    const records: VenueRecord[] = [
      {
        id: 'user:example journal',
        type: 'journal',
        canonicalName: 'Example, Journal',
        aliases: ['Example "Journal"'],
        acronyms: ['EJ'],
        issn: ['1234-5678'],
        ccf: { rank: 'A', edition: '2026', catalog: 'CCF' },
        cas: { rank: '1', edition: '2025', catalog: '中科院分区' },
        impactFactor: {
          value: 12.3,
          year: '2025',
          sourceLabel: 'JCR',
          sourceUrl: 'https://example.test/source',
        },
        school: { rank: 'A', edition: '2026', catalog: '示例大学' },
        labels: [
          { kind: 'cas-discipline', text: '计算机科学 1区', edition: '2025' },
          { kind: 'cas-upgraded', text: '计算机科学 TOP', edition: '2025' },
          { kind: 'jcr-quartile', text: '信息系统 Q1（1/266）', edition: '2025' },
          { kind: 'new-rising', text: '计算机科学 1区', edition: '2026' },
          { kind: 'indexing', text: 'SCIE' },
          { kind: 'pku-core', text: '2023版' },
          { kind: 'cssci', text: 'CSSCI' },
          { kind: 'cssci-extended', text: '2025-2026' },
          { kind: 'cstpcd', text: 'CSTPCD' },
          { kind: 'cscd-core', text: '2025-2026' },
          { kind: 'cscd-extended', text: '2025-2026' },
          { kind: 'cast-tier', text: '计算机 T1（2025总汇）' },
          { kind: 'sjr', text: 'SJR Q1' },
          { kind: 'publication-type', text: 'Review' },
          { kind: 'warning', text: '预警' },
          { kind: 'note', text: '重点支持' },
        ],
      },
    ];

    const csv = serializeVenueCatalog(records);
    expect(csv.split('\n')[0]).toBe(CATALOG_CSV_HEADERS.join(','));
    expect(csv.split('\n')[0]).toContain(
      '南大中文核心标签,CSSCI扩展版标签,中国科技核心标签,CSCD核心库标签,CSCD扩展库标签,中国科协高质量期刊标签',
    );
    const result = parseVenueCatalog(csv, 'export.csv');

    expect(result.warnings).toEqual([]);
    const [roundTripped] = result.records;
    expect(roundTripped).toEqual(
      expect.objectContaining({
        type: 'journal',
        canonicalName: 'Example, Journal',
        aliases: ['Example "Journal"'],
        acronyms: ['EJ'],
        issn: ['1234-5678'],
        ccf: expect.objectContaining({ rank: 'A', edition: '2026' }),
        cas: expect.objectContaining({ rank: '1', edition: '2025' }),
        impactFactor: expect.objectContaining({
          value: 12.3,
          year: '2025',
          sourceLabel: 'JCR',
        }),
        school: expect.objectContaining({
          rank: 'A',
          edition: '2026',
          catalog: '示例大学',
        }),
      }),
    );
    expect(roundTripped?.labels).toEqual(
      expect.arrayContaining(
        records[0]!.labels!.map((label) => expect.objectContaining(label)),
      ),
    );
  });
});

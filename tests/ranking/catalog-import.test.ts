import { afterEach, describe, expect, it } from 'vitest';

import { buildRankingBadges } from '../../src/ranking/badges';
import { parseVenueCatalog } from '../../src/ranking/catalog-import';
import { BUNDLED_CATALOG_STATS } from '../../src/ranking/data/bundled';
import {
  ccf2026SeedMatcher,
  resetUserVenueCatalog,
  setUserVenueCatalog,
} from '../../src/ranking/registry';

afterEach(() => {
  resetUserVenueCatalog();
});

describe('user venue catalog import', () => {
  it('parses Chinese CSV headers and all supported ranking indicators', () => {
    const csv = [
      '期刊名称,类型,别名,简称,ISSN,中科院分区,中科院版本,CCF级别,CCF版本,影响因子,影响因子年份,影响因子来源,学校等级,学校名称,学校版本',
      '情报科学,期刊,Information Science Journal|情报科学杂志,ISJ,1007-7634,2区,2025,B,2026,4.2,2025,JCR,A,示例大学,2026',
    ].join('\n');

    const result = parseVenueCatalog(csv, 'journals.csv');

    expect(result.warnings).toEqual([]);
    expect(result.records).toEqual([
      expect.objectContaining({
        id: 'user:情报科学',
        type: 'journal',
        canonicalName: '情报科学',
        aliases: ['Information Science Journal', '情报科学杂志'],
        acronyms: ['ISJ'],
        issn: ['1007-7634'],
        cas: expect.objectContaining({ rank: '2', edition: '2025' }),
        ccf: expect.objectContaining({ rank: 'B', edition: '2026' }),
        impactFactor: expect.objectContaining({ value: 4.2, year: '2025' }),
        school: expect.objectContaining({
          rank: 'A',
          catalog: '示例大学',
          edition: '2026',
        }),
      }),
    ]);
  });

  it('parses JSON and defaults missing type to journal', () => {
    const result = parseVenueCatalog(
      JSON.stringify([
        {
          name: 'Journal of Local Data',
          aliases: 'J Local Data|JLD',
          casQuartile: '1',
          impactFactor: 8.75,
          impactFactorYear: 2025,
        },
      ]),
      'journals.json',
    );

    expect(result.records[0]).toMatchObject({
      type: 'journal',
      canonicalName: 'Journal of Local Data',
      cas: { rank: '1' },
      impactFactor: { value: 8.75, year: '2025' },
    });
  });

  it('rejects impact factors without a four-digit data year', () => {
    expect(() =>
      parseVenueCatalog('期刊名称,影响因子\n示例期刊,3.2', 'invalid.csv'),
    ).toThrow('必须同时填写四位年份');
  });

  it('rejects normalized duplicate names', () => {
    expect(() =>
      parseVenueCatalog(
        '期刊名称,中科院分区\nＡＢＣ Journal,1区\nABC Journal,2区',
        'duplicate.csv',
      ),
    ).toThrow('名称重复');
  });
});

describe('active catalog and badges', () => {
  it('enriches a bundled CCF venue instead of creating a duplicate conflict', () => {
    const imported = parseVenueCatalog(
      [
        '期刊名称,类型,中科院分区,中科院版本,影响因子,影响因子年份,学校等级,学校名称',
        'Conference on Neural Information Processing Systems,会议,1区,2025,33.1,2025,A+,示例大学',
      ].join('\n'),
      'enrich.csv',
    );

    expect(setUserVenueCatalog(imported.records)).toEqual({
      userRecords: 1,
      activeRecords: BUNDLED_CATALOG_STATS.activeVenues,
    });
    const match = ccf2026SeedMatcher.match({ candidate: 'NeurIPS' });
    expect(match).toMatchObject({
      status: 'matched',
      venue: {
        ccf: { rank: 'A' },
        cas: { rank: '1' },
        impactFactor: { value: 33.1, year: '2025' },
        school: { rank: 'A+', catalog: '示例大学' },
      },
    });

    expect(buildRankingBadges(match, 'NeurIPS')).toEqual([
      { kind: 'source', text: 'EasyPaper · 来源：NeurIPS' },
      { kind: 'cas', text: '中科院 1区' },
      { kind: 'ccf', text: 'CCF A' },
      { kind: 'impact-factor', text: 'IF 33.1（2025）' },
      { kind: 'school', text: '示例大学 A+' },
    ]);
  });

  it('keeps a journal and conference acronym collision safely ambiguous', () => {
    const imported = parseVenueCatalog(
      '期刊名称,类型,中科院分区,中科院版本\nSPIN,期刊,4区,2025',
      'spin.csv',
    );

    expect(setUserVenueCatalog(imported.records)).toEqual({
      userRecords: 1,
      activeRecords: BUNDLED_CATALOG_STATS.activeVenues + 1,
    });
    expect(ccf2026SeedMatcher.match({ candidate: 'SPIN' })).toMatchObject({
      status: 'ambiguous',
      candidates: expect.arrayContaining([
        expect.objectContaining({
          type: 'journal',
          cas: expect.objectContaining({ rank: '4' }),
        }),
        expect.objectContaining({
          type: 'conference',
          ccf: expect.objectContaining({ rank: 'C' }),
        }),
      ]),
    });
    expect(
      ccf2026SeedMatcher.match({
        candidate: 'International Symposium on Model Checking of Software',
      }),
    ).toMatchObject({
      status: 'matched',
      venue: { type: 'conference', ccf: { rank: 'C' } },
    });
  });

  it('renders the built-in YNUFE rank without requiring an upload', () => {
    const match = ccf2026SeedMatcher.match({ candidate: '财经研究' });

    expect(match).toMatchObject({
      status: 'matched',
      venue: { school: { rank: 'A', catalog: '云南财经大学' } },
    });
    expect(buildRankingBadges(match, '财经研究')).toContainEqual({
      kind: 'school',
      text: '云南财经大学 A',
    });
  });

  it('activates a new Chinese journal by its uploaded alias', () => {
    const imported = parseVenueCatalog(
      '期刊名称,别名,中科院分区,影响因子,影响因子年份\n情报科学,情报科学杂志,2区,4.2,2025',
      'local.csv',
    );
    setUserVenueCatalog(imported.records);

    expect(ccf2026SeedMatcher.match({ candidate: '情报科学杂志' })).toMatchObject({
      status: 'matched',
      venue: {
        canonicalName: '情报科学',
        cas: { rank: '2' },
        impactFactor: { value: 4.2 },
      },
    });
  });
});

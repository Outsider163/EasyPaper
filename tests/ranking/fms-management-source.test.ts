import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { assertKnownFmsIssnConflict } from '../../scripts/fms-management-safety';
import { buildRankingBadges } from '../../src/ranking/badges';
import { parseVenueCatalog } from '../../src/ranking/catalog-import';
import {
  ccf2026SeedMatcher,
  resetUserVenueCatalog,
  setUserVenueCatalog,
} from '../../src/ranking/registry';

const FMS_SOURCE_PATH = new URL(
  '../../catalog/sources/fms-management-journals-2025.csv',
  import.meta.url,
);
const MERGED_SOURCE_PATH = new URL(
  '../../catalog/sources/chinese-journal-labels-2025-2026.csv',
  import.meta.url,
);
const MANAGEMENT_LABEL = /^管理科学 (T1|T2|A|B|C|D)（2025总汇）$/u;

afterEach(() => {
  resetUserVenueCatalog();
});

describe('FMS management science 2025 source', () => {
  it('contains the complete verified Chinese and international rankings', () => {
    const result = parseVenueCatalog(
      readFileSync(FMS_SOURCE_PATH, 'utf8'),
      'fms-management-journals-2025.csv',
    );

    expect(result.warnings).toEqual([]);
    expect(result.records).toHaveLength(1_277);
    const counts = new Map<string, number>();
    for (const venue of result.records) {
      const labels = (venue.labels ?? []).filter(
        (label) =>
          label.kind === 'cast-tier' && MANAGEMENT_LABEL.test(label.text),
      );
      expect(labels, venue.canonicalName).toHaveLength(1);
      const rank = MANAGEMENT_LABEL.exec(labels[0]!.text)?.[1];
      expect(rank, venue.canonicalName).toBeTruthy();
      counts.set(rank!, (counts.get(rank!) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({
      T1: 28,
      T2: 66,
      A: 102,
      B: 375,
      C: 493,
      D: 213,
    });
  });

  it.each([
    ['管理世界', '管理科学 T1（2025总汇）'],
    ['珞珈管理评论', '管理科学 T2（2025总汇）'],
    ['Academy of Management Journal', '管理科学 A（2025总汇）'],
    ['Organization', '管理科学 B（2025总汇）'],
    ['Organizational Dynamics', '管理科学 C（2025总汇）'],
    ['Learning Organization', '管理科学 D（2025总汇）'],
  ])('assigns %s the expected label', (name, expectedLabel) => {
    const result = parseVenueCatalog(
      readFileSync(FMS_SOURCE_PATH, 'utf8'),
      'fms-management-journals-2025.csv',
    );
    const venue = result.records.find(
      (record) => record.canonicalName === name,
    );
    expect(venue?.labels).toContainEqual(
      expect.objectContaining({ kind: 'cast-tier', text: expectedLabel }),
    );
  });
});

describe('FMS management source safety', () => {
  it('allows only the documented ISSN conflict and rejects unknown conflicts', () => {
    const fmsVenue = {
      id: 'fms:world-economic-papers',
      type: 'journal' as const,
      canonicalName: '世界经济文汇',
      aliases: [],
      issn: ['0253-9772'],
    };
    const genetic = {
      id: 'existing:genetics',
      type: 'journal' as const,
      canonicalName: '遗传',
      aliases: [],
      issn: ['02539772'],
    };

    expect(() => assertKnownFmsIssnConflict(fmsVenue, genetic)).not.toThrow();
    expect(() =>
      assertKnownFmsIssnConflict(
        { ...fmsVenue, canonicalName: '未知期刊' },
        genetic,
      ),
    ).toThrow('未知 ISSN 冲突');
  });
});

describe('merged management science catalog', () => {
  it('keeps existing labels, renamed titles and ISSN conflict safeguards', () => {
    const result = parseVenueCatalog(
      readFileSync(MERGED_SOURCE_PATH, 'utf8'),
      'chinese-journal-labels-2025-2026.csv',
    );
    const byName = new Map(
      result.records.map((venue) => [venue.canonicalName, venue]),
    );

    expect(byName.get('管理世界')?.labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'cast-tier',
          text: '技术经济 T1（2025总汇）',
        }),
        expect.objectContaining({
          kind: 'cast-tier',
          text: '管理科学 T1（2025总汇）',
        }),
      ]),
    );
    expect(byName.get('工程管理科技前沿')).toMatchObject({
      aliases: expect.arrayContaining(['工程管理科技前沿(原预测)']),
      labels: expect.arrayContaining([
        expect.objectContaining({ text: '技术经济 T2（2025总汇）' }),
        expect.objectContaining({ text: '管理科学 T1（2025总汇）' }),
      ]),
    });
    expect(byName.get('世界经济文汇')?.issn ?? []).not.toContain('0253-9772');
    expect(byName.get('遗传')?.issn).toContain('02539772');
    expect(byName.get('遗传')?.labels).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '管理科学 T2（2025总汇）' }),
      ]),
    );
  });

  it('activates the full catalog and renders an FMS D badge', () => {
    const result = parseVenueCatalog(
      readFileSync(MERGED_SOURCE_PATH, 'utf8'),
      'chinese-journal-labels-2025-2026.csv',
    );
    expect(() => setUserVenueCatalog(result.records)).not.toThrow();

    const match = ccf2026SeedMatcher.match({
      candidate: 'Learning Organization',
    });
    expect(buildRankingBadges(match, 'Learning Organization')).toContainEqual({
      kind: 'cast-tier',
      text: '中国科协 管理科学 D（2025总汇）',
    });
  });
});

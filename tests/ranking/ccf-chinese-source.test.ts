import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildRankingBadges,
  buildRankingTooltip,
} from '../../src/ranking/badges';
import { parseVenueCatalog } from '../../src/ranking/catalog-import';
import { createVenueMatcher } from '../../src/ranking/matcher';

const SOURCE_PATH = resolve(
  process.cwd(),
  'catalog/sources/ccf-chinese-journals-2025.csv',
);

describe('CCF 2025 Chinese journal source', () => {
  const parsed = parseVenueCatalog(
    readFileSync(SOURCE_PATH, 'utf8'),
    SOURCE_PATH,
  );
  const matcher = createVenueMatcher(parsed.records);

  it('contains the complete verified T1/T2/T3 catalog', () => {
    expect(parsed.warnings).toEqual([]);
    expect(parsed.records).toHaveLength(68);

    const counts = { T1: 0, T2: 0, T3: 0 };
    for (const record of parsed.records) {
      for (const label of record.labels ?? []) {
        if (label.kind === 'ccf-chinese' && label.text in counts) {
          counts[label.text as keyof typeof counts] += 1;
          expect(label.edition).toBe('2025');
        }
      }
    }
    expect(counts).toEqual({ T1: 19, T2: 22, T3: 27 });
  });

  it.each([
    ['计算机学报', 'T1'],
    ['计算机工程', 'T2'],
    ['软件导刊', 'T3'],
    ['Journal of Computer Science and Technology', 'T1'],
  ])('matches %s as CCF Chinese %s', (candidate, tier) => {
    expect(matcher.match({ candidate })).toMatchObject({
      status: 'matched',
      venue: {
        labels: expect.arrayContaining([
          { kind: 'ccf-chinese', text: tier, edition: '2025' },
        ]),
      },
    });
  });

  it('renders a distinct CCF Chinese recommendation badge and edition tooltip', () => {
    const match = matcher.match({ candidate: '计算机学报' });
    expect(buildRankingBadges(match, '计算机学报')).toContainEqual({
      kind: 'ccf-chinese',
      text: 'CCF 中文 T1 推荐',
    });
    expect(buildRankingTooltip('知网', match, '计算机学报')).toContain(
      'CCF 中文 T1 推荐（2025）',
    );
  });
});

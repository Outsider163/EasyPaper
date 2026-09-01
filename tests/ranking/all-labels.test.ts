import { afterEach, describe, expect, it } from 'vitest';

import { buildRankingBadges } from '../../src/ranking/badges';
import { parseVenueCatalog } from '../../src/ranking/catalog-import';
import {
  ccf2026SeedMatcher,
  resetUserVenueCatalog,
  setUserVenueCatalog,
} from '../../src/ranking/registry';

afterEach(() => {
  resetUserVenueCatalog();
});

describe('all source-backed journal labels', () => {
  it('imports and renders upgraded CAS, JCR quartile, indexing, SJR and metrics', () => {
    const result = parseVenueCatalog(
      [
        '期刊名称,别名,中科院分区,中科院版本,中科院升级版标签,JCR分区标签,影响因子,影响因子年份,影响因子来源,新锐分区标签,新锐版本,检索标签,SJR标签,期刊类型标签',
        'IEEE Communications Surveys and Tutorials,IEEE Communications Surveys & Tutorials,1区,2025,计算机科学 1区|计算机科学 TOP|计算机：信息系统 1区,计算机：信息系统 Q1（1/266）|电信学 Q1（1/127）,50.6,2025,JCR,计算机科学 1区|计算机科学 TOP,2026,SCIE|Scopus,SJR 17.2（2025）|SJR Q1|H-index 250,Review',
      ].join('\n'),
      'all-labels.csv',
    );

    expect(result.warnings).toEqual([]);
    setUserVenueCatalog(result.records);
    const match = ccf2026SeedMatcher.match({
      candidate: 'IEEE Communications Surveys & Tutorials',
    });
    const badges = buildRankingBadges(match, 'IEEE Communications Surveys & Tutorials');

    expect(badges).toEqual([
      { kind: 'source', text: 'EasyPaper · 来源：IEEE Communications Surveys & Tutorials' },
      { kind: 'new-rising', text: '新锐分区 计算机科学 1区' },
      { kind: 'new-rising', text: '新锐分区 计算机科学 TOP' },
      { kind: 'cas-upgraded', text: 'SCI升级版 计算机科学 1区' },
      { kind: 'cas-upgraded', text: 'SCI升级版 计算机科学 TOP' },
      { kind: 'cas-upgraded', text: 'SCI升级版 计算机：信息系统 1区' },
      { kind: 'jcr-quartile', text: 'JCR 计算机：信息系统 Q1（1/266）' },
      { kind: 'jcr-quartile', text: 'JCR 电信学 Q1（1/127）' },
      { kind: 'indexing', text: 'SCIE' },
      { kind: 'indexing', text: 'Scopus' },
      { kind: 'impact-factor', text: 'IF 50.6（2025）' },
      { kind: 'sjr', text: 'SJR 17.2（2025）' },
      { kind: 'sjr', text: 'SJR Q1' },
      { kind: 'sjr', text: 'H-index 250' },
      { kind: 'publication-type', text: 'Review' },
    ]);
    expect(badges.some((badge) => badge.kind === 'cas')).toBe(false);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { readFile } from 'node:fs/promises';
import { buildRankingBadges, renderRankingBadges } from '../../src/ranking/badges';
import { parseVenueCatalog, serializeVenueCatalog, CATALOG_CSV_TEMPLATE } from '../../src/ranking/catalog-import';
import { setLabelDisplay } from '../../src/ranking/display-settings';
import { activeVenueMatcher, resetUserVenueCatalog, setUserVenueCatalog } from '../../src/ranking/registry';
import { venueSchools, parseSchools, SCHOOL_CHOICES } from '../../src/ranking/schools';

afterEach(() => { resetUserVenueCatalog(); setLabelDisplay(undefined); });
describe('multiple school rankings', () => {
  it('ships both supplied catalogs and keeps three schools after loading old online data', () => {
    setUserVenueCatalog(parseVenueCatalog('期刊名称,学校等级,学校名称,学校版本\n管理世界,A,云南财经大学,2026').records);
    const match = activeVenueMatcher.match({ candidate: '管理世界' });
    expect(match.status).toBe('matched');
    if (match.status !== 'matched') throw new Error('missing source journal');
    expect(venueSchools(match.venue)).toEqual(expect.arrayContaining([
      expect.objectContaining({ catalog: '云南财经大学', rank: 'A' }),
      expect.objectContaining({ catalog: '东北财经大学', rank: 'T2' }),
      expect.objectContaining({ catalog: '西南财经大学', rank: 'A+(TOP)' }),
    ]));
    const csv = serializeVenueCatalog([match.venue]);
    expect(venueSchools(parseVenueCatalog(csv).records[0]!)).toEqual(venueSchools(match.venue));
  });
  it('uses short badges, full-name tooltips and independent school visibility', () => {
    const match = activeVenueMatcher.match({ candidate: '管理世界' });
    const badges = buildRankingBadges(match, '管理世界');
    const panel = parseHTML('<html><body><div></div></body></html>').document.querySelector('div') as unknown as HTMLElement;
    renderRankingBadges(panel, badges);
    expect(panel.textContent).toContain('东财 T2');
    expect(panel.textContent).toContain('西财 A+(TOP)');
    expect(panel.querySelectorAll('[data-easypaper-badge="school"]')).toHaveLength(3);
    expect([...panel.querySelectorAll('span')].some((el) => el.title.includes('东北财经大学'))).toBe(true);
    setLabelDisplay({ hiddenSchools: ['东北财经大学'], showEdition: false });
    renderRankingBadges(panel, badges);
    expect(panel.textContent).not.toContain('东财');
    expect(panel.textContent).toContain('西财');
    setLabelDisplay({ hiddenKinds: ['school'] });
    renderRankingBadges(panel, badges);
    expect(panel.querySelectorAll('[data-easypaper-badge="school"]')).toHaveLength(0);
  });
  it('validates the multi-school field and keeps the CSV example aligned', () => {
    expect(() => parseSchools('[{"catalog":"西南财经大学"}]')).toThrow();
    expect(() => parseSchools([{ catalog: '西南财经大学', rank: 'A' }, { catalog: '西南财经大学', rank: 'B' }])).toThrow('重复');
    expect(parseVenueCatalog(CATALOG_CSV_TEMPLATE).records[0]?.labels).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'cas-discipline', text: '计算机科学 2区' }),
    ]));
  });
  it('keeps source sequences and excludes family-level rules as journal titles', async () => {
    const sources = JSON.parse(await readFile('catalog/sources/school-journals-2025.json', 'utf8'));
    expect(sources.map((s: { rows: unknown[] }) => s.rows.length)).toEqual([1179, 656]);
    expect(sources[0].sequenceTotals).toEqual({ 中文: 378, 外文: 795 });
    expect(sources[1].sequenceTotals).toEqual({ 中文: 97, 外文: 561 });
    const compiled = await readFile('src/ranking/data/schools-2025.json', 'utf8');
    expect(compiled).not.toContain('其他子刊');
    expect(Object.keys(SCHOOL_CHOICES)).toEqual(['云南财经大学', '东北财经大学', '西南财经大学']);
  });
});

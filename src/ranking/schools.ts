import type { RankingValue, VenueRecord } from './types';

export const SCHOOL_CHOICES = {
  '云南财经大学': '云财',
  '东北财经大学': '东财',
  '西南财经大学': '西财',
} as const;

export function schoolShortName(name: string): string {
  return SCHOOL_CHOICES[name as keyof typeof SCHOOL_CHOICES] ?? name;
}

export function mergeSchools(...groups: readonly (readonly RankingValue[] | undefined)[]): RankingValue[] {
  const schools = new Map<string, RankingValue>();
  for (const group of groups) for (const school of group ?? []) {
    schools.set(school.catalog ?? '学校目录', { ...school });
  }
  return [...schools.values()];
}

export function venueSchools(venue: VenueRecord): RankingValue[] {
  return mergeSchools(venue.school ? [venue.school] : [], venue.schools);
}

export function parseSchools(value: unknown): RankingValue[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { throw new Error('多学校等级必须是有效 JSON 数组。'); }
  }
  if (!Array.isArray(parsed) || parsed.length > 100) throw new Error('多学校等级必须是最多 100 项的数组。');
  const seen = new Set<string>();
  return parsed.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('学校等级条目无效。');
    const raw = item as Record<string, unknown>;
    if (typeof raw.catalog !== 'string' || !raw.catalog.trim() || typeof raw.rank !== 'string' || !raw.rank.trim()) {
      throw new Error('每个学校等级必须包含学校全称 catalog 和等级 rank。');
    }
    const catalog = raw.catalog.trim();
    if (seen.has(catalog)) throw new Error(`学校等级重复：${catalog}`);
    seen.add(catalog);
    if (raw.edition !== undefined && typeof raw.edition !== 'string') throw new Error('学校版本必须是文本。');
    return { catalog, rank: raw.rank.trim(), ...(raw.edition ? { edition: raw.edition as string } : {}) };
  });
}

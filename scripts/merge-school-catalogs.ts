import { readFile, writeFile } from 'node:fs/promises';
import { parseVenueCatalog, serializeVenueCatalog } from '../src/ranking/catalog-import';
import { mergeVenueCatalogs, setUserVenueCatalog } from '../src/ranking/registry';
import { CORE_BUNDLED_VENUES } from '../src/ranking/data/bundled';
import { mergeSchools } from '../src/ranking/schools';
import type { VenueRecord } from '../src/ranking/types';

interface SourceRow { name: string; rank: string; issn: string[]; page: number; number: string; language: string }
interface Source { school: string; edition: string; rows: SourceRow[] }
const sources: Source[] = JSON.parse(await readFile('catalog/sources/school-journals-2025.json', 'utf8'));
const parsed = parseVenueCatalog(await readFile('catalog/sources/chinese-journal-labels-2025-2026.csv', 'utf8'));
const records = mergeVenueCatalogs(parsed.records, CORE_BUNDLED_VENUES);
const compact = (s: string): string => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const additions = new Map<VenueRecord, VenueRecord>();
const report: Record<string, unknown>[] = [];
const issues: Record<string, unknown>[] = [];
const controlledNames: Record<string, string[]> = {
  'Journal of the Royal Statistical Society, Series B: Statistical Methodology': ['Journal of the Royal Statistical Society Series B', 'Journal of the Royal Statistical Society Series B-Stastistical Methodology'],
  'JOURNAL OF THE ROYAL STATISTICAL SOCIETY SERIES B-STATISTICAL METHODOLOGY': ['Journal of the Royal Statistical Society Series B', 'Journal of the Royal Statistical Society Series B-Stastistical Methodology'],
  'Abacus: A Journal of Accounting, Finance and Business Studies': ['Abacus-Journal of Accounting, Finance and Business Studies', 'Abacus'],
  '中国科学（数学、信息科学）': ['中国科学（数学）', '中国科学. 数学', '中国科学：信息科学'],
  '中国科学：数学': ['中国科学（数学）', '中国科学. 数学'],
};
function expandNames(name: string): string[] {
  return (controlledNames[name] ?? [name]).flatMap((candidate) => {
    const variants = records.filter((r) => r.type === 'journal' && compact(r.canonicalName) === compact(candidate));
    return variants.length > 1 ? variants.map((r) => r.canonicalName) : [candidate];
  });
}
for (const source of sources) {
  for (const row of source.rows) for (const name of expandNames(row.name)) {
    const nameMatches = records.filter((r) => r.type === 'journal' && [r.canonicalName, ...r.aliases].some((n) => compact(n) === compact(name)));
    const primaryIssn = row.issn[0];
    const issnMatches = primaryIssn ? records.filter((r) => r.type === 'journal' && r.issn?.some((s) => compact(s) === compact(primaryIssn))) : [];
    let target = nameMatches.length === 1 ? nameMatches[0] : undefined;
    if (!target && nameMatches.length > 1) {
      const exact = nameMatches.filter((r) => r.canonicalName.normalize('NFKC') === name.normalize('NFKC'));
      const intersection = exact.length === 1 ? exact : nameMatches.filter((r) => issnMatches.includes(r));
      if (intersection.length === 1) target = intersection[0];
      else { issues.push({ unresolved: true, name, candidates: nameMatches.map((r) => r.canonicalName) }); continue; }
    }
    if (!target && issnMatches.length === 1) target = issnMatches[0];
    if (!target && issnMatches.length > 1) { issues.push({ unresolved: true, name, candidates: issnMatches.map((r) => r.canonicalName) }); continue; }
    if (target && nameMatches.length && issnMatches.some((r) => r !== target)) {
      issues.push({ school: source.school, name, reason: '名称匹配优先；忽略冲突 ISSN', issn: primaryIssn });
    }
    if (!target) {
      target = { id: `schools:${compact(name)}`, type: 'journal', canonicalName: name,
        aliases: [], ...(primaryIssn ? { issn: [primaryIssn] } : {}) };
      records.push(target);
    }
    let addition = additions.get(target);
    if (!addition) {
      addition = { id: target.id, type: 'journal', canonicalName: target.canonicalName, aliases: [], issn: target.issn, schools: [] };
      additions.set(target, addition);
    }
    // Preserve the PDF spelling without replacing a verified catalog title.
    if (compact(target.canonicalName) !== compact(name)) {
      const collision = records.some((r) => r !== target && [r.canonicalName, ...r.aliases, ...(r.acronyms ?? [])].some((n) => compact(n) === compact(name)));
      if (!collision && !target.aliases.includes(name)) { target.aliases.push(name); addition.aliases.push(name); }
    }
    const previous = addition.schools?.find((s) => s.catalog === source.school);
    const ranks = new Set(previous?.rank.replace('（按学科）', '').split(' / ') ?? []);
    ranks.add(row.rank);
    const rank = [...ranks].join(' / ') + (ranks.size > 1 ? '（按学科）' : '');
    const school = { catalog: source.school, rank, edition: source.edition };
    addition.schools = mergeSchools(addition.schools, [school]);
    target.schools = mergeSchools(target.schools, [school]);
    report.push({ school: source.school, name, matchedName: target.canonicalName, rank: row.rank, page: row.page });
  }
}
if (issues.some((issue) => issue.unresolved)) { console.log(JSON.stringify(issues)); throw new Error('有待核对的名称，未写入目录。'); }
setUserVenueCatalog(records);
await writeFile('catalog/sources/with-school-catalogs.csv', serializeVenueCatalog(records));
await writeFile('src/ranking/data/schools-2025.json', JSON.stringify([...additions.values()], null, 2) + '\n');
await writeFile('catalog/sources/school-merge-report.json', JSON.stringify({ issues, rows: report }, null, 2) + '\n');
console.log(JSON.stringify({ sourceRows: sources.map((s) => [s.school, s.rows.length]), uniqueVenues: additions.size,
  perSchool: sources.map((s) => [s.school, [...additions.values()].filter((r) => r.schools?.some((v) => v.catalog === s.school)).length]),
  outputRecords: records.length, issues }));

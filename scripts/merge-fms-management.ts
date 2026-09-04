import { readFile, writeFile } from 'node:fs/promises';

import {
  parseVenueCatalog,
  serializeVenueCatalog,
} from '../src/ranking/catalog-import';
import { normalizeVenueName } from '../src/ranking/normalize';
import { assertKnownFmsIssnConflict } from './fms-management-safety';
import {
  resetUserVenueCatalog,
  setUserVenueCatalog,
} from '../src/ranking/registry';
import type { VenueLabel, VenueRecord } from '../src/ranking/types';

const DEFAULT_TARGET =
  'catalog/sources/chinese-journal-labels-2025-2026.csv';
const DEFAULT_FMS_SOURCE =
  'catalog/sources/fms-management-journals-2025.csv';
const MANAGEMENT_LABEL = /^管理科学 (T1|T2|A|B|C|D)（2025总汇）$/u;
const EXPECTED_COUNTS = new Map([
  ['T1', 28],
  ['T2', 66],
  ['A', 102],
  ['B', 375],
  ['C', 493],
  ['D', 213],
]);

const [
  targetPath = DEFAULT_TARGET,
  fmsPath = DEFAULT_FMS_SOURCE,
  outputPath = targetPath,
] = process.argv.slice(2);
const [targetText, fmsText] = await Promise.all([
  readFile(targetPath, 'utf8'),
  readFile(fmsPath, 'utf8'),
]);
const target = parseVenueCatalog(targetText, targetPath);
const fms = parseVenueCatalog(fmsText, fmsPath);

assertNoWarnings('目标目录', target.warnings);
assertNoWarnings('FMS 来源', fms.warnings);
validateFmsSource(fms.records);

const records = target.records.map(cloneVenue);
let indexes = createIndexes(records);
let matchedByName = 0;
let matchedByIssn = 0;
let added = 0;
let consolidated = 0;
let ignoredIssnConflicts = 0;
const consolidatedPairs: string[] = [];
const ignoredIssnDetails: string[] = [];

for (const fmsVenue of fms.records) {
  const byName = resolveNameMatch(fmsVenue, indexes);
  const byIssn = resolveIssnMatch(fmsVenue, indexes);
  let matchIndex: number | undefined;
  let fmsVenueForMerge = fmsVenue;
  if (byName !== undefined && byIssn !== undefined && byName !== byIssn) {
    if (canConsolidate(records[byName]!, records[byIssn]!, fmsVenue)) {
      consolidatedPairs.push(
        `${records[byName]!.canonicalName} ← ${records[byIssn]!.canonicalName}`,
      );
      matchIndex = consolidateMatchedRecords(
        records,
        byName,
        byIssn,
        fmsVenue,
      );
      consolidated += 1;
      indexes = createIndexes(records);
    } else if (isExactCanonicalMatch(byName, fmsVenue, indexes)) {
      assertKnownFmsIssnConflict(fmsVenue, records[byIssn]!);
      matchIndex = byName;
      fmsVenueForMerge = { ...fmsVenue, issn: undefined };
      ignoredIssnConflicts += 1;
      ignoredIssnDetails.push(
        `${fmsVenue.canonicalName}: ${(fmsVenue.issn ?? []).join('|')} → ` +
          `${records[byIssn]!.canonicalName}`,
      );
    } else {
      throw new Error(
        `FMS 记录“${fmsVenue.canonicalName}”的名称与 ISSN 指向不同记录。`,
      );
    }
  } else {
    matchIndex = byName ?? byIssn;
  }

  if (matchIndex === undefined) {
    records.push(cloneVenue(fmsVenue));
    added += 1;
  } else {
    records[matchIndex] = mergeFmsVenue(
      records[matchIndex]!,
      fmsVenueForMerge,
    );
    if (byName !== undefined) matchedByName += 1;
    else matchedByIssn += 1;
  }
  indexes = createIndexes(records);
}

const output = serializeVenueCatalog(records);
const reparsed = parseVenueCatalog(output, targetPath);
const activation = setUserVenueCatalog(reparsed.records);
resetUserVenueCatalog();
validateMergedCatalog(reparsed.records);
await writeFile(outputPath, output, 'utf8');

console.log(
  JSON.stringify({
    targetPath,
    outputPath,
    sourceRecords: target.records.length,
    fmsRecords: fms.records.length,
    matchedByName,
    matchedByIssn,
    added,
    consolidated,
    consolidatedPairs,
    ignoredIssnConflicts,
    ignoredIssnDetails,
    outputRecords: reparsed.records.length,
    activeRecords: activation.activeRecords,
    warnings: reparsed.warnings.length,
  }),
);

interface CatalogIndexes {
  canonical: Map<string, number[]>;
  aliases: Map<string, number[]>;
  issn: Map<string, number[]>;
}

function createIndexes(records: readonly VenueRecord[]): CatalogIndexes {
  const canonical = new Map<string, number[]>();
  const aliases = new Map<string, number[]>();
  const issn = new Map<string, number[]>();
  records.forEach((record, index) => {
    addIndex(canonical, nameKey(record.type, record.canonicalName), index);
    for (const alias of record.aliases) {
      addIndex(aliases, nameKey(record.type, alias), index);
    }
    for (const value of record.issn ?? []) {
      const key = issnKey(value);
      if (key) addIndex(issn, key, index);
    }
  });
  return { canonical, aliases, issn };
}

function resolveNameMatch(
  venue: VenueRecord,
  indexes: CatalogIndexes,
): number | undefined {
  const key = nameKey(venue.type, venue.canonicalName);
  const canonical = uniqueOwner(indexes.canonical.get(key), '规范名称', venue);
  if (canonical !== undefined) return canonical;
  return uniqueOwner(indexes.aliases.get(key), '别名', venue);
}

function resolveIssnMatch(
  venue: VenueRecord,
  indexes: CatalogIndexes,
): number | undefined {
  const owners = new Set<number>();
  for (const value of venue.issn ?? []) {
    const key = issnKey(value);
    for (const owner of key ? indexes.issn.get(key) ?? [] : []) {
      owners.add(owner);
    }
  }
  return uniqueOwner([...owners], 'ISSN', venue);
}

function uniqueOwner(
  owners: readonly number[] | undefined,
  namespace: string,
  venue: VenueRecord,
): number | undefined {
  const unique = [...new Set(owners ?? [])];
  if (unique.length > 1) {
    throw new Error(`FMS 记录“${venue.canonicalName}”的${namespace}匹配不唯一。`);
  }
  return unique[0];
}

function mergeFmsVenue(
  current: VenueRecord,
  fmsVenue: VenueRecord,
): VenueRecord {
  const fmsLabel = managementLabels(fmsVenue)[0]!;
  const aliases = unique([
    ...current.aliases,
    ...(normalizeVenueName(current.canonicalName) ===
    normalizeVenueName(fmsVenue.canonicalName)
      ? []
      : [fmsVenue.canonicalName]),
    ...fmsVenue.aliases,
  ]);
  const labels = [
    ...(current.labels ?? []).filter(
      (label) =>
        label.kind !== 'cast-tier' || !MANAGEMENT_LABEL.test(label.text),
    ),
    { ...fmsLabel },
  ];
  return {
    ...current,
    aliases,
    issn: optionalUnique([...(current.issn ?? []), ...(fmsVenue.issn ?? [])]),
    labels: uniqueLabels(labels),
  };
}

function isExactCanonicalMatch(
  recordIndex: number,
  venue: VenueRecord,
  indexes: CatalogIndexes,
): boolean {
  const owners =
    indexes.canonical.get(nameKey(venue.type, venue.canonicalName)) ?? [];
  return owners.length === 1 && owners[0] === recordIndex;
}

function consolidateMatchedRecords(
  records: VenueRecord[],
  nameIndex: number,
  issnIndex: number,
  fmsVenue: VenueRecord,
): number {
  const nameRecord = records[nameIndex]!;
  const issnRecord = records[issnIndex]!;
  if (!canConsolidate(nameRecord, issnRecord, fmsVenue)) {
    throw new Error(
      `FMS 记录“${fmsVenue.canonicalName}”的名称与 ISSN 指向不同记录：` +
        `${nameRecord.canonicalName} / ${issnRecord.canonicalName}。`,
    );
  }

  records[nameIndex] = mergeExistingRecords(nameRecord, issnRecord);
  records.splice(issnIndex, 1);
  return nameIndex - (issnIndex < nameIndex ? 1 : 0);
}

function canConsolidate(
  nameRecord: VenueRecord,
  issnRecord: VenueRecord,
  fmsVenue: VenueRecord,
): boolean {
  if (
    nameRecord.type !== fmsVenue.type ||
    issnRecord.type !== fmsVenue.type
  ) {
    return false;
  }
  const fmsName = looseVenueName(fmsVenue.canonicalName);
  const candidates = [issnRecord.canonicalName, ...issnRecord.aliases].map(
    looseVenueName,
  );
  return candidates.some(
    (candidate) =>
      candidate === fmsName ||
      hasExplicitRenameSuffix(candidate, fmsName) ||
      hasExplicitRenameSuffix(fmsName, candidate) ||
      hasSafeLongTruncation(candidate, fmsName) ||
      hasSafeLongTruncation(fmsName, candidate),
  );
}

function hasExplicitRenameSuffix(value: string, base: string): boolean {
  if (!base || !value.startsWith(base)) return false;
  const suffix = value.slice(base.length);
  return /^(?:原|原名|曾用名|更名前|formerly|previously)/iu.test(suffix);
}

function hasSafeLongTruncation(value: string, base: string): boolean {
  const minimumLength = 24;
  return base.length >= minimumLength && value.startsWith(base);
}

function mergeExistingRecords(
  primary: VenueRecord,
  secondary: VenueRecord,
): VenueRecord {
  return {
    ...primary,
    aliases: unique([
      ...primary.aliases,
      secondary.canonicalName,
      ...secondary.aliases,
    ]),
    acronyms: optionalUnique([
      ...(primary.acronyms ?? []),
      ...(secondary.acronyms ?? []),
    ]),
    issn: optionalUnique([...(primary.issn ?? []), ...(secondary.issn ?? [])]),
    dblpKey: primary.dblpKey ?? secondary.dblpKey,
    ccf: primary.ccf ?? secondary.ccf,
    cas: primary.cas ?? secondary.cas,
    impactFactor: primary.impactFactor ?? secondary.impactFactor,
    school: primary.school ?? secondary.school,
    labels: uniqueLabels([...(primary.labels ?? []), ...(secondary.labels ?? [])]),
  };
}

function assertNoWarnings(label: string, warnings: readonly string[]): void {
  if (warnings.length === 0) return;
  throw new Error(
    `${label}存在 ${warnings.length} 条解析警告：${warnings.slice(0, 3).join('；')}`,
  );
}

function validateFmsSource(records: readonly VenueRecord[]): void {
  if (records.length !== 1_277) {
    throw new Error(`FMS 来源应为 1277 条，实际为 ${records.length} 条。`);
  }
  const counts = new Map<string, number>();
  for (const venue of records) {
    if (venue.type !== 'journal') {
      throw new Error(`FMS 记录“${venue.canonicalName}”不是期刊类型。`);
    }
    const labels = managementLabels(venue);
    if (labels.length !== 1) {
      throw new Error(`FMS 记录“${venue.canonicalName}”必须只有一个管理科学标签。`);
    }
    const match = MANAGEMENT_LABEL.exec(labels[0]!.text);
    if (!match) throw new Error(`无法识别“${labels[0]!.text}”的 FMS 等级。`);
    counts.set(match[1]!, (counts.get(match[1]!) ?? 0) + 1);
  }
  for (const [rank, expected] of EXPECTED_COUNTS) {
    const actual = counts.get(rank) ?? 0;
    if (actual !== expected) {
      throw new Error(`FMS ${rank} 应为 ${expected} 条，实际为 ${actual} 条。`);
    }
  }
}

function validateMergedCatalog(records: readonly VenueRecord[]): void {
  let total = 0;
  const counts = new Map<string, number>();
  for (const venue of records) {
    for (const label of managementLabels(venue)) {
      const match = MANAGEMENT_LABEL.exec(label.text);
      if (!match) continue;
      total += 1;
      counts.set(match[1]!, (counts.get(match[1]!) ?? 0) + 1);
    }
  }
  if (total !== 1_277) {
    throw new Error(`合并目录应含 1277 个管理科学标签，实际为 ${total} 个。`);
  }
  for (const [rank, expected] of EXPECTED_COUNTS) {
    if ((counts.get(rank) ?? 0) !== expected) {
      throw new Error(`合并目录中的 FMS ${rank} 数量不正确。`);
    }
  }
}

function managementLabels(venue: VenueRecord): VenueLabel[] {
  return (venue.labels ?? []).filter(
    (label) => label.kind === 'cast-tier' && MANAGEMENT_LABEL.test(label.text),
  );
}

function nameKey(type: VenueRecord['type'], value: string): string {
  return `${type}\u0000${normalizeVenueName(value)}`;
}

function looseVenueName(value: string): string {
  return normalizeVenueName(value).replace(/[^\p{L}\p{N}]+/gu, '');
}

function issnKey(value: string): string {
  return value.normalize('NFKC').toUpperCase().replace(/[^0-9X]/gu, '');
}

function addIndex(map: Map<string, number[]>, key: string, index: number): void {
  const owners = map.get(key) ?? [];
  owners.push(index);
  map.set(key, owners);
}

function cloneVenue(venue: VenueRecord): VenueRecord {
  return {
    ...venue,
    aliases: [...venue.aliases],
    acronyms: venue.acronyms ? [...venue.acronyms] : undefined,
    issn: venue.issn ? [...venue.issn] : undefined,
    ccf: venue.ccf ? { ...venue.ccf } : undefined,
    cas: venue.cas ? { ...venue.cas } : undefined,
    impactFactor: venue.impactFactor ? { ...venue.impactFactor } : undefined,
    school: venue.school ? { ...venue.school } : undefined,
    labels: venue.labels?.map((label) => ({ ...label })),
  };
}

function optionalUnique(values: readonly string[]): string[] | undefined {
  const result = unique(values);
  return result.length > 0 ? result : undefined;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueLabels(values: readonly VenueLabel[]): VenueLabel[] {
  const seen = new Set<string>();
  return values.filter((label) => {
    const key = `${label.kind}\u0000${label.text.normalize('NFKC').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

import { normalizeVenueName } from './normalize';
import type {
  CasQuartile,
  CcfRank,
  ImpactFactorValue,
  RankingValue,
  VenueLabel,
  VenueRecord,
  VenueType,
} from './types';

export const MAX_CATALOG_RECORDS = 30_000;
export const MAX_CATALOG_FILE_BYTES = 15 * 1024 * 1024;

export interface CatalogImportResult {
  records: VenueRecord[];
  warnings: string[];
}

type RawRow = Record<string, unknown>;

const HEADER_ALIASES = {
  name: ['name', 'journalname', 'venuename', '期刊名称', '会议名称', '来源名称', '名称'],
  type: ['type', '类型'],
  aliases: ['aliases', 'alias', '别名', '其他名称'],
  acronyms: ['acronyms', 'acronym', '简称', '缩写'],
  issn: ['issn', 'issns'],
  casQuartile: ['casquartile', 'cas', '中科院分区', '中科院几区'],
  casEdition: ['casedition', '中科院版本', '中科院年份'],
  ccfRank: ['ccfrank', 'ccf', 'ccf级别', 'ccf推荐级别'],
  ccfEdition: ['ccfedition', 'ccf版本', 'ccf年份'],
  impactFactor: ['impactfactor', 'if', '影响因子'],
  impactFactorYear: ['impactfactoryear', 'ifyear', '影响因子年份', 'if年份'],
  impactFactorSource: ['impactfactorsource', 'ifsource', '影响因子来源'],
  schoolRank: ['schoolrank', '学校等级', '学校分区'],
  schoolName: ['schoolname', '学校名称', '学校目录'],
  schoolEdition: ['schooledition', '学校版本', '学校年份'],
  casDisciplineLabels: ['casdisciplinelabels', '中科院学科标签', '中科院标签'],
  casUpgradedLabels: ['casupgradedlabels', '中科院升级版标签', 'sci升级版标签', '升级版标签'],
  jcrQuartileLabels: ['jcrquartilelabels', 'jcr分区标签', 'jcr学科标签'],
  newRisingLabels: ['newrisinglabels', '新锐分区标签', '新锐标签'],
  newRisingEdition: ['newrisingedition', '新锐版本', '新锐年份'],
  indexingLabels: ['indexinglabels', '检索标签', '数据库标签', '收录标签'],
  sjrLabels: ['sjrlabels', 'sjr标签', 'scimago标签', '计量指标标签'],
  publicationTypeLabels: ['publicationtypelabels', '期刊类型标签'],
  warningLabels: ['warninglabels', '预警标签', '预警标记'],
  noteLabels: ['notelabels', '其他标签', '标注标签'],
  sourceUrl: ['sourceurl', 'url', '来源链接'],
} as const;

type CanonicalField = keyof typeof HEADER_ALIASES;

const HEADER_LOOKUP = new Map<string, CanonicalField>();
for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<
  [CanonicalField, readonly string[]]
>) {
  for (const alias of aliases) {
    HEADER_LOOKUP.set(normalizeHeader(alias), field);
  }
}

export function parseVenueCatalog(
  text: string,
  fileName = 'catalog.csv',
): CatalogImportResult {
  const normalizedFileName = fileName.toLowerCase();
  const rows = normalizedFileName.endsWith('.json')
    ? parseJsonRows(text)
    : parseCsvRows(text);

  if (rows.length === 0) {
    throw new Error('目录中没有可导入的数据行。');
  }
  if (rows.length > MAX_CATALOG_RECORDS) {
    throw new Error(`目录最多允许 ${MAX_CATALOG_RECORDS} 条记录。`);
  }

  const records: VenueRecord[] = [];
  const warnings: string[] = [];
  const seenNames = new Map<string, number>();

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = canonicalizeRow(rawRow);
    const name = readString(row.name);
    if (!name) {
      throw new Error(`第 ${rowNumber} 行缺少“期刊名称/名称”。`);
    }

    const normalizedName = normalizeVenueName(name);
    const firstRow = seenNames.get(normalizedName);
    if (firstRow !== undefined) {
      throw new Error(
        `第 ${rowNumber} 行与第 ${firstRow} 行的名称重复：${name}`,
      );
    }
    seenNames.set(normalizedName, rowNumber);

    const type = parseVenueType(row.type, rowNumber);
    const aliases = splitList(row.aliases).filter(
      (alias) => normalizeVenueName(alias) !== normalizedName,
    );
    const acronyms = splitList(row.acronyms);
    const issn = splitList(row.issn);
    const sourceUrl = readString(row.sourceUrl);
    const ccf = parseCcf(row, rowNumber, sourceUrl);
    const cas = parseCas(row, rowNumber, sourceUrl);
    const impactFactor = parseImpactFactor(row, rowNumber, sourceUrl);
    const school = parseSchool(row, sourceUrl);
    const labels = parseVenueLabels(row);

    if (!ccf && !cas && !impactFactor && !school && labels.length === 0) {
      warnings.push(`第 ${rowNumber} 行“${name}”只有名称，没有等级指标。`);
    }

    records.push({
      id: `user:${normalizedName}`,
      type,
      canonicalName: name,
      aliases,
      acronyms: acronyms.length > 0 ? acronyms : undefined,
      issn: issn.length > 0 ? issn : undefined,
      ccf,
      cas,
      impactFactor,
      school,
      labels: labels.length > 0 ? labels : undefined,
    });
  });

  return { records, warnings };
}

export const CATALOG_CSV_TEMPLATE = [
  [
    '期刊名称',
    '类型',
    '别名',
    '简称',
    'ISSN',
    '中科院分区',
    '中科院版本',
    'CCF级别',
    'CCF版本',
    '影响因子',
    '影响因子年份',
    '影响因子来源',
    '学校等级',
    '学校名称',
    '学校版本',
    '中科院学科标签',
    '中科院升级版标签',
    'JCR分区标签',
    '新锐分区标签',
    '新锐版本',
    '检索标签',
    'SJR标签',
    '期刊类型标签',
    '预警标签',
    '其他标签',
    '来源链接',
  ],
  [
    'Journal of Example Research',
    '期刊',
    'J Example Res|Journal Example Research',
    'JER',
    '1234-5678',
    '2区',
    '2025',
    '',
    '',
    '4.2',
    '2025',
    'JCR',
    'A',
    '示例大学',
    '2026',
    '计算机科学 2区',
    '计算机科学 1区|计算机科学 TOP',
    '计算机：信息系统 Q1（1/266）',
    '计算机科学 1区|计算机科学 TOP',
    '2026',
    'SCIE|Scopus',
    'SJR 3.2（2025）|SJR Q1|H-index 120',
    'Review',
    '',
    '中国期刊支持计划',
    '',
  ],
]
  .map((row) => row.map(escapeCsvCell).join(','))
  .join('\r\n');

function parseJsonRows(text: string): RawRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/u, ''));
  } catch {
    throw new Error('JSON 文件格式无效。');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('JSON 顶层必须是期刊记录数组。');
  }
  if (!parsed.every((item) => isPlainObject(item))) {
    throw new Error('JSON 数组中的每一项都必须是对象。');
  }
  return parsed as RawRow[];
}

function parseCsvRows(text: string): RawRow[] {
  const matrix = parseCsvMatrix(text.replace(/^\uFEFF/u, ''));
  if (matrix.length < 2) {
    throw new Error('CSV 至少需要表头和一行数据。');
  }

  const headers = matrix[0]!.map((header) => header.trim());
  if (!headers.some(Boolean)) {
    throw new Error('CSV 表头不能为空。');
  }

  return matrix
    .slice(1)
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => {
      const row: RawRow = Object.create(null) as RawRow;
      headers.forEach((header, index) => {
        if (header) {
          row[header] = cells[index] ?? '';
        }
      });
      return row;
    });
}

function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    const next = text[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && (character === ',' || character === '\t')) {
      row.push(cell);
      cell = '';
      continue;
    }

    if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && next === '\n') {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += character;
  }

  if (quoted) {
    throw new Error('CSV 存在未闭合的双引号。');
  }
  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function canonicalizeRow(rawRow: RawRow): Partial<Record<CanonicalField, unknown>> {
  const row: Partial<Record<CanonicalField, unknown>> = Object.create(null);
  for (const [rawKey, value] of Object.entries(rawRow)) {
    const field = HEADER_LOOKUP.get(normalizeHeader(rawKey));
    if (field) {
      row[field] = value;
    }
  }
  return row;
}

function parseVenueType(value: unknown, rowNumber: number): VenueType {
  const normalized = readString(value)?.toLowerCase();
  if (!normalized || normalized === 'journal' || normalized === '期刊') {
    return 'journal';
  }
  if (normalized === 'conference' || normalized === '会议') {
    return 'conference';
  }
  throw new Error(`第 ${rowNumber} 行“类型”只能是期刊/journal或会议/conference。`);
}

function parseCcf(
  row: Partial<Record<CanonicalField, unknown>>,
  rowNumber: number,
  sourceUrl: string | undefined,
): RankingValue<CcfRank> | undefined {
  const rawRank = readString(row.ccfRank)?.toUpperCase();
  if (!rawRank) {
    return undefined;
  }
  if (!['A', 'B', 'C'].includes(rawRank)) {
    throw new Error(`第 ${rowNumber} 行 CCF 级别只能是 A、B 或 C。`);
  }
  return {
    rank: rawRank as CcfRank,
    edition: readString(row.ccfEdition),
    sourceUrl,
    catalog: 'CCF',
  };
}

function parseCas(
  row: Partial<Record<CanonicalField, unknown>>,
  rowNumber: number,
  sourceUrl: string | undefined,
): RankingValue<CasQuartile> | undefined {
  const rawRank = readString(row.casQuartile)?.replace(/区$/u, '');
  if (!rawRank) {
    return undefined;
  }
  if (!['1', '2', '3', '4'].includes(rawRank)) {
    throw new Error(`第 ${rowNumber} 行中科院分区只能是 1区、2区、3区或4区。`);
  }
  return {
    rank: rawRank as CasQuartile,
    edition: readString(row.casEdition),
    sourceUrl,
    catalog: '中科院分区',
  };
}

function parseImpactFactor(
  row: Partial<Record<CanonicalField, unknown>>,
  rowNumber: number,
  sourceUrl: string | undefined,
): ImpactFactorValue | undefined {
  const rawValue = readString(row.impactFactor);
  if (!rawValue) {
    return undefined;
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`第 ${rowNumber} 行影响因子必须是大于等于 0 的数字。`);
  }
  const year = readString(row.impactFactorYear);
  if (!year || !/^\d{4}$/u.test(year)) {
    throw new Error(`第 ${rowNumber} 行填写影响因子时必须同时填写四位年份。`);
  }
  return {
    value,
    year,
    sourceUrl,
    sourceLabel: readString(row.impactFactorSource),
  };
}

function parseSchool(
  row: Partial<Record<CanonicalField, unknown>>,
  sourceUrl: string | undefined,
): RankingValue | undefined {
  const rank = readString(row.schoolRank);
  if (!rank) {
    return undefined;
  }
  return {
    rank,
    edition: readString(row.schoolEdition),
    sourceUrl,
    catalog: readString(row.schoolName) ?? '学校目录',
  };
}

function parseVenueLabels(
  row: Partial<Record<CanonicalField, unknown>>,
): VenueLabel[] {
  const definitions: Array<{
    field: CanonicalField;
    kind: VenueLabel['kind'];
    edition?: string;
  }> = [
    {
      field: 'casUpgradedLabels',
      kind: 'cas-upgraded',
      edition: readString(row.casEdition),
    },
    {
      field: 'casDisciplineLabels',
      kind: 'cas-discipline',
      edition: readString(row.casEdition),
    },
    {
      field: 'jcrQuartileLabels',
      kind: 'jcr-quartile',
      edition: readString(row.impactFactorYear),
    },
    {
      field: 'newRisingLabels',
      kind: 'new-rising',
      edition: readString(row.newRisingEdition),
    },
    { field: 'indexingLabels', kind: 'indexing' },
    { field: 'sjrLabels', kind: 'sjr' },
    { field: 'publicationTypeLabels', kind: 'publication-type' },
    { field: 'warningLabels', kind: 'warning' },
    { field: 'noteLabels', kind: 'note' },
  ];
  const labels = definitions.flatMap(({ field, kind, edition }) =>
    splitList(row[field]).map((text) => ({ kind, text, edition })),
  );
  const seen = new Set<string>();
  return labels.filter((label) => {
    const key = `${label.kind}\u0000${label.text.normalize('NFKC').toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function splitList(value: unknown): string[] {
  const text = readString(value);
  if (!text) {
    return [];
  }
  return [...new Set(text.split(/[|;；]/u).map((item) => item.trim()).filter(Boolean))];
}

function readString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized || undefined;
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-()（）]/gu, '');
}

function escapeCsvCell(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value;
}

function isPlainObject(value: unknown): value is RawRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

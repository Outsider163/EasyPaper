import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

import { BUNDLED_VENUES } from '../src/ranking/data/bundled';

const CATALOG_VERSION = '2026-core.1';
const GENERATED_AT = '2026-09-01T13:30:00.000Z';
const DATA_URL =
  'https://raw.githubusercontent.com/Outsider163/EasyPaper/main/catalog/public-catalog.csv';
const headers = [
  '期刊名称',
  '类型',
  '别名',
  '简称',
  'ISSN',
  'CCF级别',
  'CCF版本',
  '学校等级',
  '学校名称',
  '学校版本',
];
const rows = BUNDLED_VENUES.map((venue) => [
  venue.canonicalName,
  venue.type,
  venue.aliases.join('|'),
  (venue.acronyms ?? []).join('|'),
  (venue.issn ?? []).join('|'),
  venue.ccf?.rank ?? '',
  venue.ccf?.edition ?? '',
  venue.school?.rank ?? '',
  venue.school?.catalog ?? '',
  venue.school?.edition ?? '',
]);
const escapeCsv = (value: string): string =>
  /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
const csv = [headers, ...rows]
  .map((row) => row.map(escapeCsv).join(','))
  .join('\r\n');
const bytes = new TextEncoder().encode(csv);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const manifest = {
  schemaVersion: 1,
  catalogVersion: CATALOG_VERSION,
  label: 'CCF 第七版 + 云南财经大学 2026 公开核心目录',
  generatedAt: GENERATED_AT,
  dataUrl: DATA_URL,
  fileName: 'public-catalog.csv',
  sha256,
  byteLength: bytes.byteLength,
  recordCount: rows.length,
};

await mkdir('catalog', { recursive: true });
await writeFile('catalog/public-catalog.csv', bytes);
await writeFile(
  'catalog/manifest.json',
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify(manifest));

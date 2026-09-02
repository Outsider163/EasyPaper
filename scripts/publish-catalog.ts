import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

import {
  parseVenueCatalog,
  serializeVenueCatalog,
} from '../src/ranking/catalog-import';
import { mergeVenueCatalogs } from '../src/ranking/registry';

const [inputPath, requestedVersion, ...labelParts] = process.argv.slice(2);
if (!inputPath || !requestedVersion) {
  throw new Error(
    '用法：npm run catalog:publish -- <目录.csv|tsv|json> <目录版本> [目录名称]',
  );
}
if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,79}$/u.test(requestedVersion)) {
  throw new Error('目录版本只能包含字母、数字、点、下划线和连字符。');
}

const sourceText = await readFile(inputPath, 'utf8');
const imported = parseVenueCatalog(sourceText, basename(inputPath));
const records = mergeVenueCatalogs(imported.records);
const csv = serializeVenueCatalog(records);
const bytes = new TextEncoder().encode(csv);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const label = labelParts.join(' ').trim() || 'EasyPaper 全量学术期刊目录';
const manifest = {
  schemaVersion: 1,
  catalogVersion: requestedVersion,
  label,
  generatedAt: new Date().toISOString(),
  dataUrl: `./public-catalog.csv?v=${encodeURIComponent(requestedVersion)}`,
  fileName: 'public-catalog.csv',
  sha256,
  byteLength: bytes.byteLength,
  recordCount: records.length,
};

await writeFile('catalog/public-catalog.csv', bytes);
await writeFile(
  'catalog/manifest.json',
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(
  JSON.stringify({
    ...manifest,
    sourceRecords: imported.records.length,
    warnings: imported.warnings.length,
  }),
);
for (const warning of imported.warnings.slice(0, 20)) {
  console.warn(warning);
}
if (imported.warnings.length > 20) {
  console.warn(`另有 ${imported.warnings.length - 20} 条警告未显示。`);
}

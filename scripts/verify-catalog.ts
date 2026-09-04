import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { parseVenueCatalog } from '../src/ranking/catalog-import';
import {
  resetUserVenueCatalog,
  setUserVenueCatalog,
} from '../src/ranking/registry';
import { parseRemoteCatalogManifest } from '../src/ranking/remote-catalog-core';

const manifestText = await readFile('catalog/manifest.json', 'utf8');
const bytes = new Uint8Array(await readFile('catalog/public-catalog.csv'));
const manifest = parseRemoteCatalogManifest(
  manifestText,
  'https://example.test/catalog/manifest.json',
);
const actualSha256 = createHash('sha256').update(bytes).digest('hex');
if (bytes.byteLength !== manifest.byteLength) {
  throw new Error(
    `目录大小不一致：清单 ${manifest.byteLength}，实际 ${bytes.byteLength}。`,
  );
}
if (actualSha256 !== manifest.sha256) {
  throw new Error(`目录 SHA256 不一致：${actualSha256}。`);
}
const result = parseVenueCatalog(
  new TextDecoder().decode(bytes),
  manifest.fileName,
);
if (result.records.length !== manifest.recordCount) {
  throw new Error(
    `目录记录数不一致：清单 ${manifest.recordCount}，实际 ${result.records.length}。`,
  );
}
const activation = setUserVenueCatalog(result.records);
resetUserVenueCatalog();

console.log(
  JSON.stringify({
    catalogVersion: manifest.catalogVersion,
    records: result.records.length,
    bytes: bytes.byteLength,
    sha256: actualSha256,
    warnings: result.warnings.length,
    activeRecords: activation.activeRecords,
  }),
);

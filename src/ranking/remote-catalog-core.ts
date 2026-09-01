import {
  MAX_CATALOG_FILE_BYTES,
  MAX_CATALOG_RECORDS,
  parseVenueCatalog,
  type CatalogImportResult,
} from './catalog-import';

export const REMOTE_CATALOG_SCHEMA_VERSION = 1;
export const MAX_REMOTE_MANIFEST_BYTES = 100 * 1024;

export interface RemoteCatalogManifest {
  schemaVersion: 1;
  catalogVersion: string;
  label: string;
  generatedAt: string;
  dataUrl: string;
  fileName: string;
  sha256: string;
  byteLength: number;
  recordCount: number;
}

export interface DownloadedRemoteCatalog extends CatalogImportResult {
  manifest: RemoteCatalogManifest;
}

export async function downloadRemoteCatalog(
  manifestUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<DownloadedRemoteCatalog> {
  const normalizedManifestUrl = requireHttpsUrl(manifestUrl, '在线目录清单地址');
  const manifestResponse = await fetcher(normalizedManifestUrl, {
    cache: 'no-store',
  });
  if (!manifestResponse.ok) {
    throw new Error(`在线目录清单下载失败（HTTP ${manifestResponse.status}）。`);
  }
  const manifestText = await manifestResponse.text();
  if (new TextEncoder().encode(manifestText).byteLength > MAX_REMOTE_MANIFEST_BYTES) {
    throw new Error('在线目录清单超过 100 KB，已拒绝读取。');
  }
  const manifest = parseRemoteCatalogManifest(manifestText, normalizedManifestUrl);

  const dataResponse = await fetcher(manifest.dataUrl, { cache: 'no-store' });
  if (!dataResponse.ok) {
    throw new Error(`在线目录下载失败（HTTP ${dataResponse.status}）。`);
  }
  const bytes = new Uint8Array(await dataResponse.arrayBuffer());
  if (bytes.byteLength > MAX_CATALOG_FILE_BYTES) {
    throw new Error('在线目录超过 EasyPaper 的 15 MB 限制。');
  }
  if (bytes.byteLength !== manifest.byteLength) {
    throw new Error(
      `在线目录大小不一致：清单为 ${manifest.byteLength} 字节，实际为 ${bytes.byteLength} 字节。`,
    );
  }
  const actualSha256 = await sha256Hex(bytes);
  if (actualSha256 !== manifest.sha256.toLowerCase()) {
    throw new Error('在线目录 SHA256 校验失败，已拒绝更新。');
  }

  const result = parseVenueCatalog(
    new TextDecoder('utf-8').decode(bytes),
    manifest.fileName,
  );
  if (result.records.length !== manifest.recordCount) {
    throw new Error(
      `在线目录记录数不一致：清单为 ${manifest.recordCount} 条，实际为 ${result.records.length} 条。`,
    );
  }
  return { ...result, manifest };
}

export function parseRemoteCatalogManifest(
  text: string,
  manifestUrl: string,
): RemoteCatalogManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/u, ''));
  } catch {
    throw new Error('在线目录清单不是有效的 JSON。');
  }
  if (!isPlainObject(raw)) {
    throw new Error('在线目录清单必须是 JSON 对象。');
  }
  if (raw.schemaVersion !== REMOTE_CATALOG_SCHEMA_VERSION) {
    throw new Error(`不支持的在线目录格式版本：${String(raw.schemaVersion)}。`);
  }

  const catalogVersion = requireText(raw.catalogVersion, 'catalogVersion');
  const label = requireText(raw.label, 'label');
  const generatedAt = requireText(raw.generatedAt, 'generatedAt');
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error('在线目录清单 generatedAt 必须是有效日期。');
  }
  const fileName = requireText(raw.fileName, 'fileName');
  if (!/\.(?:csv|tsv|json)$/iu.test(fileName)) {
    throw new Error('在线目录文件名必须以 .csv、.tsv 或 .json 结尾。');
  }
  const dataUrl = requireHttpsUrl(
    new URL(requireText(raw.dataUrl, 'dataUrl'), manifestUrl).href,
    '在线目录数据地址',
  );
  const sha256 = requireText(raw.sha256, 'sha256').toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(sha256)) {
    throw new Error('在线目录清单 sha256 必须是 64 位十六进制字符串。');
  }
  const byteLength = requireInteger(raw.byteLength, 'byteLength', 1, MAX_CATALOG_FILE_BYTES);
  const recordCount = requireInteger(raw.recordCount, 'recordCount', 1, MAX_CATALOG_RECORDS);

  return {
    schemaVersion: REMOTE_CATALOG_SCHEMA_VERSION,
    catalogVersion,
    label,
    generatedAt,
    dataUrl,
    fileName,
    sha256,
    byteLength,
    recordCount,
  };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copiedBytes = new Uint8Array(bytes.byteLength);
  copiedBytes.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copiedBytes.buffer);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function requireHttpsUrl(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label}无效。`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`${label}必须使用 HTTPS。`);
  }
  return url.href;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`在线目录清单缺少 ${field}。`);
  }
  return value.trim();
}

function requireInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`在线目录清单 ${field} 必须是 ${minimum}–${maximum} 的整数。`);
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

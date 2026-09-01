import type { VenueRecord } from './types';
import {
  loadCatalogMetadata,
  loadUserVenueCatalog,
  saveCatalogMetadata,
  saveUserVenueCatalog,
  type CatalogMetadata,
} from './catalog-storage';
import { setUserVenueCatalog } from './registry';
import { downloadRemoteCatalog } from './remote-catalog-core';
import { loadSettings, saveSettings } from '../settings';

export const DEFAULT_REMOTE_CATALOG_MANIFEST_URL =
  'https://cdn.jsdelivr.net/gh/Outsider163/EasyPaper@main/catalog/manifest.json';
export const REMOTE_CATALOG_MANIFEST_URLS = [
  DEFAULT_REMOTE_CATALOG_MANIFEST_URL,
  'https://raw.githubusercontent.com/Outsider163/EasyPaper/main/catalog/manifest.json',
] as const;
export const REMOTE_CATALOG_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

export type RemoteCatalogUpdateStatus =
  | 'updated'
  | 'current'
  | 'disabled'
  | 'manual-protected';

export interface RemoteCatalogUpdateResult {
  status: RemoteCatalogUpdateStatus;
  metadata?: CatalogMetadata;
}

export interface RemoteCatalogUpdateOptions {
  force?: boolean;
  fetcher?: typeof fetch;
  now?: Date;
  manifestUrl?: string;
}

export async function updateRemoteCatalog(
  options: RemoteCatalogUpdateOptions = {},
): Promise<RemoteCatalogUpdateResult> {
  const force = options.force ?? false;
  const now = options.now ?? new Date();
  const settings = await loadSettings();
  if (!force && !settings.autoCatalogUpdates) {
    return { status: 'disabled', metadata: await loadCatalogMetadata() };
  }

  const [metadata, existingRecords] = await Promise.all([
    loadCatalogMetadata(),
    loadUserVenueCatalog(),
  ]);
  if (!force && !metadata && existingRecords.length > 0) {
    const protectedMetadata = manualCatalogMetadata(
      existingRecords,
      '从旧版本保留的本地目录',
      now,
    );
    await Promise.all([
      saveCatalogMetadata(protectedMetadata),
      saveSettings({ ...settings, autoCatalogUpdates: false }),
    ]);
    return { status: 'manual-protected', metadata: protectedMetadata };
  }

  if (
    !force &&
    metadata?.source === 'remote' &&
    elapsedMilliseconds(metadata.lastCheckedAt, now) <
      REMOTE_CATALOG_CHECK_INTERVAL_MS
  ) {
    return { status: 'current', metadata };
  }

  try {
    const manifestUrls = options.manifestUrl
      ? [options.manifestUrl]
      : [...REMOTE_CATALOG_MANIFEST_URLS];
    let downloaded: Awaited<ReturnType<typeof downloadRemoteCatalog>> | undefined;
    let usedManifestUrl: string | undefined;
    let lastDownloadError: unknown;
    for (const manifestUrl of manifestUrls) {
      try {
        downloaded = await downloadRemoteCatalog(manifestUrl, options.fetcher);
        usedManifestUrl = manifestUrl;
        break;
      } catch (error) {
        lastDownloadError = error;
      }
    }
    if (!downloaded || !usedManifestUrl) {
      throw lastDownloadError ?? new Error('所有在线目录地址均不可用。');
    }
    if (
      metadata?.source === 'remote' &&
      metadata.catalogVersion === downloaded.manifest.catalogVersion &&
      metadata.sha256 === downloaded.manifest.sha256
    ) {
      const currentMetadata: CatalogMetadata = {
        ...metadata,
        lastCheckedAt: now.toISOString(),
        lastError: undefined,
      };
      await saveCatalogMetadata(currentMetadata);
      return { status: 'current', metadata: currentMetadata };
    }

    setUserVenueCatalog(downloaded.records);
    const nextMetadata: CatalogMetadata = {
      source: 'remote',
      catalogVersion: downloaded.manifest.catalogVersion,
      label: downloaded.manifest.label,
      recordCount: downloaded.records.length,
      generatedAt: downloaded.manifest.generatedAt,
      installedAt: now.toISOString(),
      lastCheckedAt: now.toISOString(),
      sha256: downloaded.manifest.sha256,
      manifestUrl: usedManifestUrl,
    };
    await saveUserVenueCatalog(downloaded.records);
    await saveCatalogMetadata(nextMetadata);
    return { status: 'updated', metadata: nextMetadata };
  } catch (error) {
    const message = error instanceof Error ? error.message : '在线目录更新失败。';
    await saveCatalogMetadata({
      ...(metadata ?? {
        source: 'remote',
        recordCount: existingRecords.length,
        label: '在线目录',
      }),
      lastCheckedAt: now.toISOString(),
      lastError: message,
    });
    throw error;
  }
}

export function manualCatalogMetadata(
  records: readonly VenueRecord[],
  label: string,
  now = new Date(),
): CatalogMetadata {
  return {
    source: 'manual',
    label,
    recordCount: records.length,
    installedAt: now.toISOString(),
    lastCheckedAt: now.toISOString(),
  };
}

function elapsedMilliseconds(value: string | undefined, now: Date): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? Math.max(0, now.getTime() - timestamp)
    : Number.POSITIVE_INFINITY;
}

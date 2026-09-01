import { browser } from 'wxt/browser';
import type { VenueRecord } from './types';

export const USER_VENUE_CATALOG_KEY = 'userVenueCatalogV1';
export const CATALOG_METADATA_KEY = 'catalogMetadataV1';

export interface CatalogMetadata {
  source: 'remote' | 'manual';
  label: string;
  recordCount: number;
  catalogVersion?: string;
  generatedAt?: string;
  installedAt?: string;
  lastCheckedAt?: string;
  sha256?: string;
  manifestUrl?: string;
  lastError?: string;
}

export async function loadUserVenueCatalog(): Promise<VenueRecord[]> {
  const stored = await browser.storage.local.get(USER_VENUE_CATALOG_KEY);
  const value = stored[USER_VENUE_CATALOG_KEY];
  return Array.isArray(value) ? (value as VenueRecord[]) : [];
}

export async function saveUserVenueCatalog(
  records: readonly VenueRecord[],
): Promise<void> {
  await browser.storage.local.set({
    [USER_VENUE_CATALOG_KEY]: records,
  });
}

export async function clearUserVenueCatalog(): Promise<void> {
  await browser.storage.local.remove([
    USER_VENUE_CATALOG_KEY,
    CATALOG_METADATA_KEY,
  ]);
}

export async function loadCatalogMetadata(): Promise<CatalogMetadata | undefined> {
  const stored = await browser.storage.local.get(CATALOG_METADATA_KEY);
  const value = stored[CATALOG_METADATA_KEY];
  return value && typeof value === 'object'
    ? (value as CatalogMetadata)
    : undefined;
}

export async function saveCatalogMetadata(
  metadata: CatalogMetadata,
): Promise<void> {
  await browser.storage.local.set({
    [CATALOG_METADATA_KEY]: metadata,
  });
}

/** Only the selected origin is stored; paths, queries and browsing history are not. */
export const ENABLED_SITES_KEY = 'enabledAcademicSitesV1';
export const SITE_ACCESS_MESSAGE = 'easypaper:set-site-access';
export const ACADEMIC_SCRIPT_ID = 'easypaper-academic-sites';
export const ACADEMIC_SCRIPT_FILE = 'content-scripts/academic.js';

export interface SiteTarget {
  origin: string;
  permission: string;
}

export function isNativeAcademicSite(url: URL): boolean {
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  return /(^|\.)cnki\.net$/u.test(url.hostname) ||
    (url.protocol === 'https:' &&
      ['scholar.google.com', 'scholar.google.com.hk'].includes(url.hostname));
}

export function getSiteTarget(value: unknown): SiteTarget | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.hostname.includes('*') || isNativeAcademicSite(url) || url.hostname === 'chromewebstore.google.com' ||
      (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore'))) {
      return undefined;
    }
    return {
      origin: url.origin,
      // Browser host permissions do not limit ports. The content script checks
      // the saved origin (including the port) again before reading the page.
      permission: `${url.protocol}//${url.hostname}/*`,
    };
  } catch {
    return undefined;
  }
}

export function normalizeEnabledSites(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    const target = getSiteTarget(item);
    return target && item === target.origin ? [target.origin] : [];
  }))].slice(0, 100);
}

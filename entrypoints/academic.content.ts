import { browser } from 'wxt/browser';
import { loadUserVenueCatalog, USER_VENUE_CATALOG_KEY } from '../src/ranking/catalog-storage';
import { resetUserVenueCatalog, setUserVenueCatalog } from '../src/ranking/registry';
import { loadSettings } from '../src/settings';
import { ENABLED_SITES_KEY, getSiteTarget, normalizeEnabledSites } from '../src/sites/site-access';
import { decorateAcademicPapers, removeAcademicDecorations } from '../src/sites/academic/decorator';
import { watchAcademicPage } from '../src/sites/academic/observer';

export default defineContentScript({
  // No mandatory all-site access. Background registers only explicitly granted hosts.
  matches: [],
  registration: 'runtime',
  async main(ctx) {
    const target = getSiteTarget(location.href);
    if (!target) return;
    let stopWatching: (() => void) | undefined;
    let revision = 0;
    const stop = (): void => {
      stopWatching?.();
      stopWatching = undefined;
      removeAcademicDecorations(document);
    };
    const refresh = async (): Promise<void> => {
      const current = ++revision;
      // Hide stale tags immediately, including when the site is disabled.
      stop();
      const [stored, settings] = await Promise.all([
        browser.storage.local.get(ENABLED_SITES_KEY), loadSettings(),
      ]);
      if (current !== revision || ctx.isInvalid || !settings.enabled ||
        !normalizeEnabledSites(stored[ENABLED_SITES_KEY]).includes(target.origin)) return;
      let records: Awaited<ReturnType<typeof loadUserVenueCatalog>> | undefined;
      try { records = await loadUserVenueCatalog(); }
      catch { /* Keep bundled data available if local storage cannot be read. */ }
      if (current !== revision || ctx.isInvalid) return;
      if (records) setUserVenueCatalog(records);
      else resetUserVenueCatalog();
      stopWatching = watchAcademicPage(document, () => decorateAcademicPapers(document));
    };
    const onChanged: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
      if ((area === 'local' && (changes[ENABLED_SITES_KEY] || changes[USER_VENUE_CATALOG_KEY])) ||
        (area === 'sync' && changes.settings)) {
        void refresh().catch(() => stop());
      }
    };
    browser.storage.onChanged.addListener(onChanged);
    ctx.onInvalidated(() => {
      revision++;
      stop();
      browser.storage.onChanged.removeListener(onChanged);
    });
    await refresh();
  },
});

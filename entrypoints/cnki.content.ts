import { browser } from 'wxt/browser';
import {
  loadUserVenueCatalog,
  USER_VENUE_CATALOG_KEY,
} from '../src/ranking/catalog-storage';
import {
  resetUserVenueCatalog,
  setUserVenueCatalog,
} from '../src/ranking/registry';
import { loadSettings } from '../src/settings';
import {
  decorateCnkiPapers,
  removeCnkiDecorations,
} from '../src/sites/cnki/decorator';

const REFRESH_DELAY_MS = 150;

export default defineContentScript({
  matches: ['https://*.cnki.net/*', 'http://*.cnki.net/*'],
  runAt: 'document_idle',
  async main() {
    let enabled = (await loadSettings()).enabled;
    let refreshTimer: number | undefined;

    const activateStoredCatalog = async (): Promise<void> => {
      try {
        setUserVenueCatalog(await loadUserVenueCatalog());
      } catch (error) {
        resetUserVenueCatalog();
        console.warn('EasyPaper 无法加载本地期刊目录，已回退到内置目录。', error);
      }
    };

    await activateStoredCatalog();

    const render = (): void => {
      window.clearTimeout(refreshTimer);
      refreshTimer = undefined;

      if (enabled) {
        decorateCnkiPapers(document);
      } else {
        removeCnkiDecorations(document);
      }
    };

    const scheduleRender = (): void => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(render, REFRESH_DELAY_MS);
    };

    render();

    const observer = new MutationObserver((mutations) => {
      if (
        enabled &&
        mutations.some((mutation) => mutation.addedNodes.length > 0)
      ) {
        scheduleRender();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    browser.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName === 'local' && changes[USER_VENUE_CATALOG_KEY]) {
        await activateStoredCatalog();
        render();
        return;
      }
      if (areaName !== 'sync') {
        return;
      }

      enabled = (await loadSettings()).enabled;
      render();
    });
  },
});

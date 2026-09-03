import { browser } from 'wxt/browser';
import { loadCatalogMetadata, loadUserVenueCatalog } from '../src/ranking/catalog-storage';
import { updateRemoteCatalog } from '../src/ranking/remote-catalog';
import { loadSettings, saveSettings } from '../src/settings';
import { installSiteAccessHandlers } from '../src/sites/site-access-background';

const REMOTE_CATALOG_ALARM = 'easypaper-remote-catalog-update';
const UPDATE_PERIOD_MINUTES = 12 * 60;

export default defineBackground(() => {
  installSiteAccessHandlers();
  console.info('[EasyPaper] background service worker ready');
  let activeUpdate: Promise<void> | undefined;

  const scheduleUpdates = async (): Promise<void> => {
    await browser.alarms.create(REMOTE_CATALOG_ALARM, {
      periodInMinutes: UPDATE_PERIOD_MINUTES,
    });
  };

  const runUpdate = (
    force = false,
    bypassInterval = false,
  ): Promise<void> => {
    if (activeUpdate) {
      return force || bypassInterval
        ? activeUpdate.then(() => runUpdate(force, bypassInterval))
        : activeUpdate;
    }
    activeUpdate = (async () => {
      try {
        const result = await updateRemoteCatalog({ force, bypassInterval });
        console.info(`[EasyPaper] remote catalog: ${result.status}`);
      } catch (error) {
        console.warn('[EasyPaper] remote catalog update failed', error);
      }
    })().finally(() => {
      activeUpdate = undefined;
    });
    return activeUpdate;
  };

  const refreshAfterExtensionUpdate = async (): Promise<void> => {
    const [settings, metadata, records] = await Promise.all([
      loadSettings(),
      loadCatalogMetadata(),
      loadUserVenueCatalog(),
    ]);
    const hasProtectedManualCatalog =
      metadata?.source === 'manual' || (!metadata && records.length > 0);
    if (hasProtectedManualCatalog) {
      console.info('[EasyPaper] manual catalog kept after extension update');
      return;
    }
    if (!settings.autoCatalogUpdates) {
      await saveSettings({ ...settings, autoCatalogUpdates: true });
    }
    await runUpdate(false, true);
  };

  browser.runtime.onInstalled.addListener((details) => {
    void (async () => {
      await scheduleUpdates();
      if (details.reason === 'install') {
        const settings = await loadSettings();
        await saveSettings({ ...settings, autoCatalogUpdates: true });
        await runUpdate(true);
      } else {
        await refreshAfterExtensionUpdate();
      }
    })();
  });

  browser.runtime.onStartup.addListener(() => {
    void scheduleUpdates();
    void runUpdate();
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === REMOTE_CATALOG_ALARM) {
      void runUpdate();
    }
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    const nextSettings = changes.settings?.newValue as
      | { autoCatalogUpdates?: boolean }
      | undefined;
    if (areaName === 'sync' && nextSettings?.autoCatalogUpdates === true) {
      void runUpdate();
    }
  });

  void scheduleUpdates();
  void runUpdate();
});

import { browser } from 'wxt/browser';
import { updateRemoteCatalog } from '../src/ranking/remote-catalog';
import { loadSettings, saveSettings } from '../src/settings';

const REMOTE_CATALOG_ALARM = 'easypaper-remote-catalog-update';
const UPDATE_PERIOD_MINUTES = 12 * 60;

export default defineBackground(() => {
  console.info('[EasyPaper] background service worker ready');
  let activeUpdate: Promise<void> | undefined;

  const scheduleUpdates = async (): Promise<void> => {
    await browser.alarms.create(REMOTE_CATALOG_ALARM, {
      periodInMinutes: UPDATE_PERIOD_MINUTES,
    });
  };

  const runUpdate = (force = false): Promise<void> => {
    if (activeUpdate) return activeUpdate;
    activeUpdate = (async () => {
      try {
        const result = await updateRemoteCatalog({ force });
        console.info(`[EasyPaper] remote catalog: ${result.status}`);
      } catch (error) {
        console.warn('[EasyPaper] remote catalog update failed', error);
      }
    })().finally(() => {
      activeUpdate = undefined;
    });
    return activeUpdate;
  };

  browser.runtime.onInstalled.addListener((details) => {
    void (async () => {
      await scheduleUpdates();
      if (details.reason === 'install') {
        const settings = await loadSettings();
        await saveSettings({ ...settings, autoCatalogUpdates: true });
        await runUpdate(true);
      } else {
        await runUpdate();
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
});

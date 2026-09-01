import { browser } from 'wxt/browser';

export interface ExtensionSettings {
  enabled: boolean;
  autoCatalogUpdates: boolean;
}

const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  autoCatalogUpdates: false,
};

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await browser.storage.sync.get(SETTINGS_KEY);
  const settings = stored[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;

  return {
    enabled: settings?.enabled ?? DEFAULT_SETTINGS.enabled,
    autoCatalogUpdates:
      settings?.autoCatalogUpdates ?? DEFAULT_SETTINGS.autoCatalogUpdates,
  };
}

export async function saveSettings(
  settings: ExtensionSettings,
): Promise<void> {
  await browser.storage.sync.set({
    [SETTINGS_KEY]: settings,
  });
}


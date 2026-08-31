import { browser } from 'wxt/browser';

export interface ExtensionSettings {
  enabled: boolean;
}

const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
};

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await browser.storage.sync.get(SETTINGS_KEY);
  const settings = stored[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;

  return {
    enabled: settings?.enabled ?? DEFAULT_SETTINGS.enabled,
  };
}

export async function saveSettings(
  settings: ExtensionSettings,
): Promise<void> {
  await browser.storage.sync.set({
    [SETTINGS_KEY]: settings,
  });
}


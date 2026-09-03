import { browser } from 'wxt/browser';
import {
  ACADEMIC_SCRIPT_FILE, ACADEMIC_SCRIPT_ID, ENABLED_SITES_KEY,
  SITE_ACCESS_MESSAGE, getSiteTarget, normalizeEnabledSites,
} from './site-access';

export function installSiteAccessHandlers(): void {
  // One writer prevents a startup reconciliation from overwriting a new grant.
  let pending: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const next = pending.then(task, task);
    pending = next.catch(() => undefined);
    return next;
  };
  const reconcile = (): void => {
    void enqueue(syncSiteRegistration).catch((error) => {
      console.warn('[EasyPaper] site registration failed', error);
    });
  };

  const onMessage = (message: unknown, sender: { id?: string; tab?: unknown; url?: string },
    sendResponse: (response: unknown) => void): true | undefined => {
    if (!message || typeof message !== 'object') return;
    const request = message as {
      type?: unknown; origin?: unknown; tabId?: unknown; enabled?: unknown;
    };
    if (request.type !== SITE_ACCESS_MESSAGE) return;
    // Web pages/content scripts may not grant themselves site access.
    if (sender.id !== browser.runtime.id || sender.tab ||
      sender.url !== browser.runtime.getURL('/popup.html')) return;
    void enqueue(() => changeSiteAccess(request)).then(
      (result) => sendResponse({ ok: true, ...result }),
      (error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : '操作失败' }),
    );
    return true;
  };
  // Chrome supports true for async sendResponse and undefined for ignored messages;
  // webextension-polyfill's union does not model that combined callback signature.
  browser.runtime.onMessage.addListener(onMessage as Parameters<typeof browser.runtime.onMessage.addListener>[0]);
  browser.runtime.onInstalled.addListener(reconcile);
  browser.runtime.onStartup.addListener(reconcile);
  browser.permissions.onAdded.addListener(reconcile);
  browser.permissions.onRemoved.addListener(reconcile);
  reconcile();
}

export async function syncSiteRegistration(): Promise<string[]> {
  const stored = await browser.storage.local.get(ENABLED_SITES_KEY);
  const sites = normalizeEnabledSites(stored[ENABLED_SITES_KEY]);
  const allowed: string[] = [];
  for (const origin of sites) {
    const target = getSiteTarget(origin)!;
    if (await browser.permissions.contains({ origins: [target.permission] })) allowed.push(origin);
  }
  // Removing a permission also notifies already-running content scripts to stop.
  if (JSON.stringify(stored[ENABLED_SITES_KEY] ?? []) !== JSON.stringify(allowed)) {
    await browser.storage.local.set({ [ENABLED_SITES_KEY]: allowed });
  }
  const registered = await browser.scripting.getRegisteredContentScripts({ ids: [ACADEMIC_SCRIPT_ID] });
  if (allowed.length === 0) {
    if (registered.length) await browser.scripting.unregisterContentScripts({ ids: [ACADEMIC_SCRIPT_ID] });
    return allowed;
  }
  const registration = {
    id: ACADEMIC_SCRIPT_ID,
    matches: [...new Set(allowed.map((origin) => getSiteTarget(origin)!.permission))],
    js: [ACADEMIC_SCRIPT_FILE],
    allFrames: true,
    persistAcrossSessions: true,
    runAt: 'document_idle' as const,
  };
  if (registered.length) await browser.scripting.updateContentScripts([registration]);
  else await browser.scripting.registerContentScripts([registration]);
  return allowed;
}

export async function changeSiteAccess(message: {
  origin?: unknown; tabId?: unknown; enabled?: unknown;
}): Promise<{ enabled: boolean; needsReload?: boolean }> {
  const target = getSiteTarget(message.origin);
  if (!target || target.origin !== message.origin ||
    typeof message.tabId !== 'number' || !Number.isInteger(message.tabId) ||
    typeof message.enabled !== 'boolean') throw new Error('当前网页地址无效，请重新打开插件。');
  const tab = await browser.tabs.get(message.tabId);
  if (getSiteTarget(tab.url)?.origin !== target.origin) throw new Error('网页地址已变化，请重新打开插件。');
  const stored = await browser.storage.local.get(ENABLED_SITES_KEY);
  let sites = normalizeEnabledSites(stored[ENABLED_SITES_KEY]);
  if (message.enabled) {
    if (!await browser.permissions.contains({ origins: [target.permission] })) {
      throw new Error('尚未获得此网站的访问权限。');
    }
    if (!sites.includes(target.origin)) {
      if (sites.length >= 100) throw new Error('已启用的网站达到 100 个，请先关闭不需要的网站。');
      sites.push(target.origin);
    }
  } else {
    sites = sites.filter((origin) => origin !== target.origin);
  }
  await browser.storage.local.set({ [ENABLED_SITES_KEY]: sites });
  await syncSiteRegistration();
  if (!message.enabled) {
    // Different ports can share a browser host permission. Keep it if still used.
    const inUse = sites.some((origin) => getSiteTarget(origin)?.permission === target.permission);
    if (!inUse) await browser.permissions.remove({ origins: [target.permission] });
    return { enabled: false };
  }
  try {
    await browser.scripting.executeScript({
      target: { tabId: message.tabId, allFrames: true }, files: [ACADEMIC_SCRIPT_FILE],
    });
    return { enabled: true };
  } catch {
    // The persistent registration is already saved even if this tab navigated.
    return { enabled: true, needsReload: true };
  }
}

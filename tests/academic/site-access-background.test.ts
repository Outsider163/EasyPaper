import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACADEMIC_SCRIPT_ID, ENABLED_SITES_KEY, SITE_ACCESS_MESSAGE } from '../../src/sites/site-access';

const state = vi.hoisted(() => ({
  stored: {} as Record<string, unknown>,
  grants: new Set<string>(),
  scripts: [] as Array<Record<string, unknown>>,
  tabUrl: 'http://192.0.2.10:3344/kns8/defaultresult/index',
}));
const api = vi.hoisted(() => ({
  storage: { local: {
    get: vi.fn(async () => ({ ...state.stored })),
    set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(state.stored, value); }),
  } },
  permissions: {
    contains: vi.fn(async ({ origins }: { origins: string[] }) => origins.every((p) => state.grants.has(p))),
    remove: vi.fn(async ({ origins }: { origins: string[] }) => { origins.forEach((p) => state.grants.delete(p)); return true; }),
    onAdded: { addListener: vi.fn() }, onRemoved: { addListener: vi.fn() },
  },
  scripting: {
    getRegisteredContentScripts: vi.fn(async () => state.scripts),
    registerContentScripts: vi.fn(async (scripts: Array<Record<string, unknown>>) => { state.scripts = scripts; }),
    updateContentScripts: vi.fn(async (scripts: Array<Record<string, unknown>>) => { state.scripts = scripts; }),
    unregisterContentScripts: vi.fn(async () => { state.scripts = []; }),
    executeScript: vi.fn(async () => []),
  },
  tabs: { get: vi.fn(async () => ({ id: 7, url: state.tabUrl })) },
  runtime: {
    id: 'test-extension', getURL: vi.fn((path: string) => `chrome-extension://test-extension${path}`),
    onMessage: { addListener: vi.fn() }, onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() },
  },
}));
vi.mock('wxt/browser', () => ({ browser: api }));
import { changeSiteAccess, installSiteAccessHandlers, syncSiteRegistration } from '../../src/sites/site-access-background';

const origin = 'http://192.0.2.10:3344';
const permission = 'http://192.0.2.10/*';
beforeEach(() => {
  vi.clearAllMocks();
  state.stored = {}; state.grants.clear(); state.scripts = [];
  state.tabUrl = `${origin}/kns8/defaultresult/index`;
});

describe('site registration lifecycle', () => {
  it('does not register or inject anything before the user grants access', async () => {
    await syncSiteRegistration();
    expect(api.scripting.registerContentScripts).not.toHaveBeenCalled();
    await expect(changeSiteAccess({ origin, tabId: 7, enabled: true })).rejects.toThrow('尚未获得');
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect(api.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('saves only the origin, persistently registers a granted host and immediately injects', async () => {
    state.grants.add(permission);
    expect(await changeSiteAccess({ origin, tabId: 7, enabled: true })).toEqual({ enabled: true });
    expect(state.stored[ENABLED_SITES_KEY]).toEqual([origin]);
    expect(state.scripts).toEqual([{
      id: ACADEMIC_SCRIPT_ID, matches: [permission], js: ['content-scripts/academic.js'],
      allFrames: true, persistAcrossSessions: true, runAt: 'document_idle',
    }]);
    expect(api.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 7, allFrames: true }, files: ['content-scripts/academic.js'] });
    await syncSiteRegistration();
    expect(api.scripting.registerContentScripts).toHaveBeenCalledTimes(1);
    expect(api.scripting.updateContentScripts).toHaveBeenCalledTimes(1);
  });

  it('refuses a stale popup request after the tab navigates to another site or port', async () => {
    state.grants.add(permission);
    state.tabUrl = 'http://192.0.2.10:9999/page';
    await expect(changeSiteAccess({ origin, tabId: 7, enabled: true })).rejects.toThrow('网页地址已变化');
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });

  it('refuses malformed requests and non-origin values', async () => {
    for (const message of [
      { origin: `${origin}/path`, tabId: 7, enabled: true },
      { origin, tabId: '7', enabled: true },
      { origin, tabId: 7, enabled: 'true' },
      { origin: 'chrome://extensions', tabId: 7, enabled: true },
    ]) await expect(changeSiteAccess(message)).rejects.toThrow('地址无效');
  });

  it('removes revoked origins and unregisters scripts after a browser restart', async () => {
    state.stored[ENABLED_SITES_KEY] = [origin];
    state.scripts = [{ id: ACADEMIC_SCRIPT_ID }];
    await syncSiteRegistration();
    expect(state.stored[ENABLED_SITES_KEY]).toEqual([]);
    expect(api.scripting.unregisterContentScripts).toHaveBeenCalledTimes(1);
  });

  it('disables a site, unregisters and relinquishes the unused host permission', async () => {
    state.grants.add(permission);
    await changeSiteAccess({ origin, tabId: 7, enabled: true });
    expect(await changeSiteAccess({ origin, tabId: 7, enabled: false })).toEqual({ enabled: false });
    expect(state.stored[ENABLED_SITES_KEY]).toEqual([]);
    expect(state.scripts).toEqual([]);
    expect(api.permissions.remove).toHaveBeenCalledWith({ origins: [permission] });
  });

  it('keeps a shared host permission when another explicitly selected port uses it', async () => {
    state.grants.add(permission);
    state.stored[ENABLED_SITES_KEY] = [origin, 'http://192.0.2.10:5555'];
    await changeSiteAccess({ origin, tabId: 7, enabled: false });
    expect(state.stored[ENABLED_SITES_KEY]).toEqual(['http://192.0.2.10:5555']);
    expect(api.permissions.remove).not.toHaveBeenCalled();
  });

  it('saves persistent access even if current-page injection needs a reload', async () => {
    state.grants.add(permission);
    api.scripting.executeScript.mockRejectedValueOnce(new Error('Frame navigated'));
    expect(await changeSiteAccess({ origin, tabId: 7, enabled: true })).toEqual({ enabled: true, needsReload: true });
    expect(state.stored[ENABLED_SITES_KEY]).toEqual([origin]);
  });

  it('accepts messages only from the extension popup and reacts to permission revocation', async () => {
    installSiteAccessHandlers();
    await vi.waitFor(() => expect(api.scripting.getRegisteredContentScripts).toHaveBeenCalled());
    const listener = api.runtime.onMessage.addListener.mock.calls[0]![0] as Function;
    const response = vi.fn();
    const message = { type: SITE_ACCESS_MESSAGE, origin, tabId: 7, enabled: true };
    for (const sender of [
      { id: 'other', url: 'chrome-extension://test-extension/popup.html' },
      { id: 'test-extension', url: `${origin}/page`, tab: { id: 7 } },
      { id: 'test-extension', url: 'chrome-extension://test-extension/options.html' },
    ]) expect(listener(message, sender, response)).toBeUndefined();
    expect(response).not.toHaveBeenCalled();
    state.grants.add(permission);
    expect(listener(message, { id: 'test-extension', url: 'chrome-extension://test-extension/popup.html' }, response)).toBe(true);
    await vi.waitFor(() => expect(response).toHaveBeenCalledWith({ ok: true, enabled: true }));
    state.grants.clear();
    const revoked = api.permissions.onRemoved.addListener.mock.calls[0]![0] as Function;
    revoked();
    await vi.waitFor(() => expect(state.stored[ENABLED_SITES_KEY]).toEqual([]));
  });
});

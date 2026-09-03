import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENABLED_SITES_KEY } from '../../src/sites/site-access';

const api = vi.hoisted(() => ({
  tabs: { query: vi.fn() },
  storage: { local: { get: vi.fn() }, sync: { get: vi.fn() } },
  permissions: { contains: vi.fn(), request: vi.fn() },
  runtime: { sendMessage: vi.fn() },
}));
vi.mock('wxt/browser', () => ({ browser: api }));
import { initializeSiteAccess } from '../../src/sites/site-access-popup';

beforeEach(() => {
  vi.clearAllMocks();
  const { document } = parseHTML('<html><head></head><body><main><button id="open-options">设置</button></main></body></html>');
  vi.stubGlobal('document', document);
  api.tabs.query.mockResolvedValue([{ id: 7, url: 'http://192.0.2.10:3344/kns8/defaultresult/index' }]);
  api.storage.local.get.mockResolvedValue({});
  api.storage.sync.get.mockResolvedValue({ settings: { enabled: true } });
  api.permissions.contains.mockResolvedValue(false);
  api.permissions.request.mockResolvedValue(true);
  api.runtime.sendMessage.mockResolvedValue({ ok: true, enabled: true });
});
afterEach(() => vi.unstubAllGlobals());
const button = () => document.querySelector<HTMLButtonElement>('.site-access button')!;

describe('current-site popup', () => {
  it('shows the actual origin and requests only that host when explicitly clicked', async () => {
    await initializeSiteAccess();
    expect(document.querySelector('.site-address')?.textContent).toBe('http://192.0.2.10:3344');
    expect(button().textContent).toBe('在当前网站启用识别');
    expect(api.permissions.request).not.toHaveBeenCalled();
    button().click();
    await vi.waitFor(() => expect(api.runtime.sendMessage).toHaveBeenCalled());
    expect(api.permissions.request).toHaveBeenCalledWith({ origins: ['http://192.0.2.10/*'] });
    expect(button().textContent).toBe('关闭当前网站识别');
  });
  it('does not enable after a denied permission request', async () => {
    api.permissions.request.mockResolvedValue(false);
    await initializeSiteAccess(); button().click();
    await vi.waitFor(() => expect(button().disabled).toBe(false));
    expect(api.runtime.sendMessage).not.toHaveBeenCalled();
    expect(document.querySelector('.site-hint')?.textContent).toContain('未允许');
  });
  it('disables saved access without requesting new permissions', async () => {
    api.storage.local.get.mockResolvedValue({ [ENABLED_SITES_KEY]: ['http://192.0.2.10:3344'] });
    api.permissions.contains.mockResolvedValue(true);
    api.runtime.sendMessage.mockResolvedValue({ ok: true, enabled: false });
    await initializeSiteAccess(); button().click();
    await vi.waitFor(() => expect(button().textContent).toBe('在当前网站启用识别'));
    expect(api.permissions.request).not.toHaveBeenCalled();
    expect(api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });
  it.each(['chrome://extensions/', 'https://kns.cnki.net/kns8/defaultresult/index'])('does not request duplicate or protected access on %s', async (url) => {
    api.tabs.query.mockResolvedValue([{ id: 7, url }]);
    await initializeSiteAccess();
    expect(button().disabled).toBe(true);
    expect(api.permissions.request).not.toHaveBeenCalled();
  });
  it('explains that the global switch is off', async () => {
    api.storage.sync.get.mockResolvedValue({ settings: { enabled: false } });
    await initializeSiteAccess();
    expect(document.querySelector('.site-hint')?.textContent).toContain('总开关已关闭');
  });
});

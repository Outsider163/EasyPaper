import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENABLED_SITES_KEY } from '../../src/sites/site-access';

const mocks = vi.hoisted(() => ({
  get: vi.fn(), listener: vi.fn(), removeListener: vi.fn(), loadSettings: vi.fn(),
  loadCatalog: vi.fn(), setCatalog: vi.fn(), resetCatalog: vi.fn(),
  watch: vi.fn(), stop: vi.fn(), decorate: vi.fn(), remove: vi.fn(),
}));
vi.mock('wxt/browser', () => ({ browser: { storage: {
  local: { get: mocks.get }, onChanged: { addListener: mocks.listener, removeListener: mocks.removeListener },
} } }));
vi.mock('../../src/settings', () => ({ loadSettings: mocks.loadSettings }));
vi.mock('../../src/ranking/catalog-storage', () => ({ loadUserVenueCatalog: mocks.loadCatalog, USER_VENUE_CATALOG_KEY: 'catalog' }));
vi.mock('../../src/ranking/registry', () => ({ setUserVenueCatalog: mocks.setCatalog, resetUserVenueCatalog: mocks.resetCatalog }));
vi.mock('../../src/sites/academic/decorator', () => ({ decorateAcademicPapers: mocks.decorate, removeAcademicDecorations: mocks.remove }));
vi.mock('../../src/sites/academic/observer', () => ({ watchAcademicPage: mocks.watch }));

let entrypoint: { main(ctx: { isInvalid: boolean; onInvalidated: (cb: () => void) => void }): Promise<void> };
let cleanup: () => void;
const context = () => ({ isInvalid: false, onInvalidated(cb: () => void) { cleanup = cb; } });

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal('defineContentScript', (definition: unknown) => definition);
  vi.stubGlobal('document', {});
  vi.stubGlobal('location', { href: 'http://192.0.2.10:3344/kns8/defaultresult/index' });
  mocks.get.mockResolvedValue({ [ENABLED_SITES_KEY]: ['http://192.0.2.10:3344'] });
  mocks.loadSettings.mockResolvedValue({ enabled: true });
  mocks.loadCatalog.mockResolvedValue([]);
  mocks.watch.mockReturnValue(mocks.stop);
  entrypoint = (await import('../../entrypoints/academic.content')).default;
});
afterEach(() => { cleanup?.(); vi.unstubAllGlobals(); });

describe('content script authorization and lifecycle', () => {
  it('starts for the selected address, stops on disable and restarts on enable', async () => {
    await entrypoint.main(context());
    expect(mocks.watch).toHaveBeenCalledTimes(1);
    const listener = mocks.listener.mock.calls[0]![0] as Function;
    mocks.get.mockResolvedValue({ [ENABLED_SITES_KEY]: [] });
    listener({ [ENABLED_SITES_KEY]: {} }, 'local');
    await vi.waitFor(() => expect(mocks.stop).toHaveBeenCalledTimes(1));
    expect(mocks.watch).toHaveBeenCalledTimes(1);
    mocks.get.mockResolvedValue({ [ENABLED_SITES_KEY]: ['http://192.0.2.10:3344'] });
    listener({ [ENABLED_SITES_KEY]: {} }, 'local');
    await vi.waitFor(() => expect(mocks.watch).toHaveBeenCalledTimes(2));
  });
  it('does not load the catalog or watch another port on the same granted host', async () => {
    vi.stubGlobal('location', { href: 'http://192.0.2.10:9999/' });
    await entrypoint.main(context());
    expect(mocks.loadCatalog).not.toHaveBeenCalled();
    expect(mocks.watch).not.toHaveBeenCalled();
  });
  it('respects the global off switch', async () => {
    mocks.loadSettings.mockResolvedValue({ enabled: false });
    await entrypoint.main(context());
    expect(mocks.loadCatalog).not.toHaveBeenCalled();
    expect(mocks.watch).not.toHaveBeenCalled();
  });
  it('cleans up the observer and listener when the extension context is replaced', async () => {
    await entrypoint.main(context());
    cleanup();
    expect(mocks.stop).toHaveBeenCalledTimes(1);
    expect(mocks.removeListener).toHaveBeenCalledWith(mocks.listener.mock.calls[0]![0]);
  });
  it('does not restore labels if access was revoked while loading the catalog', async () => {
    let resolve: (records: unknown[]) => void = () => undefined;
    mocks.loadCatalog.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const running = entrypoint.main(context());
    await vi.waitFor(() => expect(mocks.loadCatalog).toHaveBeenCalledTimes(1));
    mocks.get.mockResolvedValue({ [ENABLED_SITES_KEY]: [] });
    (mocks.listener.mock.calls[0]![0] as Function)({ [ENABLED_SITES_KEY]: {} }, 'local');
    resolve([]);
    await running;
    expect(mocks.setCatalog).not.toHaveBeenCalled();
    expect(mocks.watch).not.toHaveBeenCalled();
  });
  it('does not let an older slow catalog response overwrite a newer one', async () => {
    let resolve: (records: unknown[]) => void = () => undefined;
    mocks.loadCatalog.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const running = entrypoint.main(context());
    await vi.waitFor(() => expect(mocks.loadCatalog).toHaveBeenCalledTimes(1));
    (mocks.listener.mock.calls[0]![0] as Function)({ catalog: {} }, 'local');
    await vi.waitFor(() => expect(mocks.watch).toHaveBeenCalledTimes(1));
    resolve([{ id: 'stale-record' }]);
    await running;
    expect(mocks.setCatalog).toHaveBeenCalledTimes(1);
    expect(mocks.setCatalog).toHaveBeenCalledWith([]);
  });
});

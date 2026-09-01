import { browser } from 'wxt/browser';
import {
  loadCatalogMetadata,
  loadUserVenueCatalog,
} from '../../src/ranking/catalog-storage';
import { loadSettings } from '../../src/settings';
import './style.css';

async function initializePopup(): Promise<void> {
  const status = document.querySelector<HTMLElement>('#status');
  const openOptions = document.querySelector<HTMLButtonElement>('#open-options');
  const [settings, catalog, metadata] = await Promise.all([
    loadSettings(),
    loadUserVenueCatalog(),
    loadCatalogMetadata(),
  ]);

  if (status) {
    const source = metadata?.source === 'remote' ? '在线目录' : '本地目录';
    status.textContent = settings.enabled
      ? `知网 / Scholar 自动识别已启用 · ${source} ${catalog.length} 条`
      : '论文来源与等级标签已关闭';
  }

  openOptions?.addEventListener('click', () => {
    void browser.runtime.openOptionsPage();
  });
}

void initializePopup();

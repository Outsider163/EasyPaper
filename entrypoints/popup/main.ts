import { browser } from 'wxt/browser';
import { loadUserVenueCatalog } from '../../src/ranking/catalog-storage';
import { loadSettings } from '../../src/settings';
import './style.css';

async function initializePopup(): Promise<void> {
  const status = document.querySelector<HTMLElement>('#status');
  const openOptions = document.querySelector<HTMLButtonElement>('#open-options');
  const [settings, catalog] = await Promise.all([
    loadSettings(),
    loadUserVenueCatalog(),
  ]);

  if (status) {
    status.textContent = settings.enabled
      ? `知网 / Scholar 自动识别已启用 · 本地目录 ${catalog.length} 条`
      : '论文来源与等级标签已关闭';
  }

  openOptions?.addEventListener('click', () => {
    void browser.runtime.openOptionsPage();
  });
}

void initializePopup();

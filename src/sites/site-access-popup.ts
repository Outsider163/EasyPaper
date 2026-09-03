import { browser } from 'wxt/browser';
import { loadSettings } from '../settings';
import { ENABLED_SITES_KEY, SITE_ACCESS_MESSAGE, getSiteTarget, isNativeAcademicSite, normalizeEnabledSites } from './site-access';
import './site-access-popup.css';

export async function initializeSiteAccess(): Promise<void> {
  const section = document.createElement('section');
  section.className = 'site-access';
  const heading = document.createElement('h2');
  heading.textContent = '当前网站识别';
  const address = document.createElement('p');
  address.className = 'site-address';
  const hint = document.createElement('p');
  hint.className = 'site-hint';
  hint.setAttribute('role', 'status');
  const button = document.createElement('button');
  button.type = 'button';
  button.disabled = true;
  button.textContent = '正在读取当前网站…';
  section.append(heading, address, button, hint);
  document.querySelector('#open-options')?.before(section);

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const target = getSiteTarget(tab?.url);
    const settings = await loadSettings();
    const native = tab?.url && isNativeAcademicSite(new URL(tab.url));
    if (!target || tab?.id === undefined) {
      button.textContent = native ? '此网站已内置支持' : '当前页面不支持启用';
      hint.textContent = native
        ? (settings.enabled ? '知网和 Scholar 官方网页会自动识别。' : '总开关已关闭，请先在设置中开启。')
        : '请先打开论文检索页或详情页。浏览器内部页面、应用商店和 PDF 阅读器等页面不支持。';
      return;
    }
    const tabId = tab.id;
    address.textContent = target.origin;
    const stored = await browser.storage.local.get(ENABLED_SITES_KEY);
    let enabled = normalizeEnabledSites(stored[ENABLED_SITES_KEY]).includes(target.origin) &&
      await browser.permissions.contains({ origins: [target.permission] });
    const updateButton = (): void => {
      button.disabled = false;
      button.textContent = enabled ? '关闭当前网站识别' : '在当前网站启用识别';
      button.classList.toggle('site-enabled', enabled);
    };
    updateButton();
    hint.textContent = enabled
      ? '此地址已启用，以后访问会自动识别。'
      : '其他学术网站：先进入论文列表或详情页，再点击启用。首次需要你允许访问此网站。';
    if (!settings.enabled) hint.textContent += ' 总开关已关闭，请在设置中开启。';

    button.addEventListener('click', async () => {
      button.disabled = true;
      const nextEnabled = !enabled;
      try {
        // First await must be the permission request, preserving the user gesture.
        if (nextEnabled && !await browser.permissions.request({ origins: [target.permission] })) {
          hint.textContent = '你未允许访问，此网站没有开启识别。';
          return;
        }
        const response = await browser.runtime.sendMessage({
          type: SITE_ACCESS_MESSAGE, origin: target.origin, tabId, enabled: nextEnabled,
        }) as { ok: boolean; enabled?: boolean; needsReload?: boolean; error?: string } | undefined;
        if (!response?.ok) throw new Error(response?.error ?? '无法连接插件后台，请重新加载 EasyPaper。');
        enabled = response.enabled === true;
        hint.textContent = enabled
          ? (response.needsReload ? '已保存。请刷新论文页面，之后会自动识别。'
            : '已启用。论文来源完整且目录中有记录时，会显示对应标签；翻页后也会更新。')
          : '已关闭此地址的识别；页面上的 EasyPaper 标签会移除。';
        if (enabled && !(await loadSettings()).enabled) hint.textContent += ' 请先在设置中打开总开关。';
      } catch (error) {
        hint.textContent = error instanceof Error ? error.message : '操作失败，请重试。';
      } finally { updateButton(); }
    });
  } catch {
    button.textContent = '暂时无法读取网页';
    hint.textContent = '请切换到论文页面，再重新打开 EasyPaper。';
  }
}

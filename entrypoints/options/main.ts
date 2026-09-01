import {
  CATALOG_CSV_TEMPLATE,
  MAX_CATALOG_FILE_BYTES,
  parseVenueCatalog,
  type CatalogImportResult,
} from '../../src/ranking/catalog-import';
import {
  clearUserVenueCatalog,
  loadCatalogMetadata,
  loadUserVenueCatalog,
  saveCatalogMetadata,
  saveUserVenueCatalog,
  type CatalogMetadata,
} from '../../src/ranking/catalog-storage';
import {
  resetUserVenueCatalog,
  setUserVenueCatalog,
} from '../../src/ranking/registry';
import {
  manualCatalogMetadata,
  updateRemoteCatalog,
} from '../../src/ranking/remote-catalog';
import type { VenueRecord } from '../../src/ranking/types';
import { loadSettings, saveSettings } from '../../src/settings';
import './style.css';

let pendingImport: CatalogImportResult | undefined;

async function initializeOptions(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>('#settings-form');
  const enabled = document.querySelector<HTMLInputElement>('#enabled');
  const autoUpdates =
    document.querySelector<HTMLInputElement>('#auto-catalog-updates');
  const saveStatus = document.querySelector<HTMLElement>('#save-status');
  const remoteUpdateButton =
    document.querySelector<HTMLButtonElement>('#update-remote-catalog');
  const remoteStatus =
    document.querySelector<HTMLElement>('#remote-catalog-status');
  const fileInput = document.querySelector<HTMLInputElement>('#catalog-file');
  const fileName = document.querySelector<HTMLElement>('#file-name');
  const importButton = document.querySelector<HTMLButtonElement>('#import-catalog');
  const downloadButton =
    document.querySelector<HTMLButtonElement>('#download-template');
  const clearButton = document.querySelector<HTMLButtonElement>('#clear-catalog');
  const catalogStatus = document.querySelector<HTMLElement>('#catalog-status');
  const warnings = document.querySelector<HTMLUListElement>('#catalog-warnings');
  let settings = await loadSettings();

  if (enabled) enabled.checked = settings.enabled;
  if (autoUpdates) autoUpdates.checked = settings.autoCatalogUpdates;

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    settings = {
      enabled: enabled?.checked ?? true,
      autoCatalogUpdates: autoUpdates?.checked ?? false,
    };
    await saveSettings(settings);
    showStatus(
      saveStatus,
      settings.autoCatalogUpdates
        ? '已保存；在线目录将由后台定期检查。'
        : '已保存',
      'success',
    );
  });

  remoteUpdateButton?.addEventListener('click', async () => {
    remoteUpdateButton.disabled = true;
    showStatus(remoteStatus, '正在下载并校验在线目录…', 'success');
    try {
      settings = { ...settings, autoCatalogUpdates: true };
      await saveSettings(settings);
      if (autoUpdates) autoUpdates.checked = true;
      const result = await updateRemoteCatalog({ force: true });
      const records = await loadUserVenueCatalog();
      setUserVenueCatalog(records);
      renderCatalog(records);
      renderRemoteMetadata(result.metadata);
      showStatus(
        remoteStatus,
        result.status === 'updated'
          ? `在线目录已更新，共 ${records.length} 条；刷新论文页面即可生效。`
          : `在线目录已是最新版本，共 ${records.length} 条。`,
        'success',
      );
    } catch (error) {
      renderRemoteMetadata(await loadCatalogMetadata());
      showStatus(remoteStatus, errorMessage(error), 'error');
    } finally {
      remoteUpdateButton.disabled = false;
    }
  });

  fileInput?.addEventListener('change', async () => {
    pendingImport = undefined;
    if (importButton) importButton.disabled = true;
    clearWarnings(warnings);

    const file = fileInput.files?.[0];
    if (!file) {
      if (fileName) fileName.textContent = '支持 .csv、.tsv、.json，最大 15 MB';
      return;
    }
    if (fileName) fileName.textContent = `${file.name} · ${formatBytes(file.size)}`;
    if (file.size > MAX_CATALOG_FILE_BYTES) {
      showStatus(catalogStatus, '文件超过 15 MB，未读取。', 'error');
      return;
    }

    try {
      const result = parseVenueCatalog(await file.text(), file.name);
      setUserVenueCatalog(result.records);
      pendingImport = result;
      if (importButton) importButton.disabled = false;
      renderCatalog(result.records);
      renderWarnings(warnings, result.warnings);
      showStatus(
        catalogStatus,
        `已校验 ${result.records.length} 条记录；点击“导入并替换目录”后生效。`,
        'success',
      );
    } catch (error) {
      showStatus(catalogStatus, errorMessage(error), 'error');
    }
  });

  importButton?.addEventListener('click', async () => {
    if (!pendingImport) return;
    const fileLabel = fileInput?.files?.[0]?.name ?? '手动导入目录';
    await saveUserVenueCatalog(pendingImport.records);
    const metadata = manualCatalogMetadata(pendingImport.records, fileLabel);
    await saveCatalogMetadata(metadata);
    settings = { ...settings, autoCatalogUpdates: false };
    await saveSettings(settings);
    if (autoUpdates) autoUpdates.checked = false;
    renderCatalog(pendingImport.records);
    renderRemoteMetadata(metadata);
    showStatus(
      catalogStatus,
      `已导入 ${pendingImport.records.length} 条记录；为保护本地数据，自动在线更新已关闭。`,
      'success',
    );
    pendingImport = undefined;
    importButton.disabled = true;
  });

  downloadButton?.addEventListener('click', () => {
    const blob = new Blob([`\uFEFF${CATALOG_CSV_TEMPLATE}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'easypaper-journal-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  });

  clearButton?.addEventListener('click', async () => {
    if (!window.confirm('确定清空当前浏览器中的补充目录吗？')) return;
    await clearUserVenueCatalog();
    resetUserVenueCatalog();
    pendingImport = undefined;
    if (fileInput) fileInput.value = '';
    if (importButton) importButton.disabled = true;
    clearWarnings(warnings);
    renderCatalog([]);
    renderRemoteMetadata(undefined);
    showStatus(catalogStatus, '已清空补充目录，仍可使用插件内置目录。', 'success');
  });

  try {
    const currentCatalog = await loadUserVenueCatalog();
    let metadata = await loadCatalogMetadata();
    if (!metadata && currentCatalog.length > 0) {
      metadata = manualCatalogMetadata(
        currentCatalog,
        '从旧版本保留的本地目录',
      );
      settings = { ...settings, autoCatalogUpdates: false };
      await Promise.all([
        saveCatalogMetadata(metadata),
        saveSettings(settings),
      ]);
      if (autoUpdates) autoUpdates.checked = false;
    }
    setUserVenueCatalog(currentCatalog);
    renderCatalog(currentCatalog);
    renderRemoteMetadata(metadata);
  } catch (error) {
    resetUserVenueCatalog();
    renderCatalog([]);
    renderRemoteMetadata(await loadCatalogMetadata());
    showStatus(catalogStatus, `已有目录无法读取：${errorMessage(error)}`, 'error');
  }
}

function renderRemoteMetadata(metadata: CatalogMetadata | undefined): void {
  setText('#remote-source', metadata ? sourceText(metadata.source) : '仅使用内置目录');
  setText('#remote-version', metadata?.catalogVersion ?? '—');
  setText('#remote-records', metadata ? `${metadata.recordCount} 条` : '0 条');
  setText(
    '#remote-updated-at',
    formatDate(metadata?.installedAt ?? metadata?.lastCheckedAt),
  );
  const badge = document.querySelector<HTMLElement>('#remote-version-badge');
  if (badge) badge.textContent = metadata?.catalogVersion ?? '未安装';
}

function sourceText(source: CatalogMetadata['source']): string {
  return source === 'remote' ? '在线公开目录' : '本地手动目录';
}

function setText(selector: string, value: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (element) element.textContent = value;
}

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('zh-CN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    : value;
}

function renderCatalog(records: readonly VenueRecord[]): void {
  const preview = document.querySelector<HTMLTableSectionElement>('#catalog-preview');
  const count = document.querySelector<HTMLElement>('#catalog-count');
  if (count) count.textContent = `${records.length} 条`;
  if (!preview) return;
  preview.replaceChildren();
  if (records.length === 0) {
    const row = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 7;
    emptyCell.className = 'empty';
    emptyCell.textContent = '尚未安装补充目录';
    row.appendChild(emptyCell);
    preview.appendChild(row);
    return;
  }

  for (const record of records.slice(0, 50)) {
    const row = document.createElement('tr');
    row.append(
      cell(record.canonicalName),
      cell(record.type === 'journal' ? '期刊' : '会议'),
      cell(record.cas ? `${record.cas.rank}区` : '—'),
      cell(record.ccf?.rank ?? '—'),
      cell(
        record.impactFactor
          ? `${record.impactFactor.value}（${record.impactFactor.year}）`
          : '—',
      ),
      cell(
        record.school
          ? `${record.school.catalog ?? '学校'} ${record.school.rank}`
          : '—',
      ),
      cell(formatLabels(record)),
    );
    preview.appendChild(row);
  }
}

function renderWarnings(
  list: HTMLUListElement | null,
  messages: readonly string[],
): void {
  if (!list) return;
  list.replaceChildren(
    ...messages.slice(0, 20).map((message) => {
      const item = document.createElement('li');
      item.textContent = message;
      return item;
    }),
  );
  list.hidden = messages.length === 0;
}

function clearWarnings(list: HTMLUListElement | null): void {
  if (list) {
    list.replaceChildren();
    list.hidden = true;
  }
}

function cell(text: string): HTMLTableCellElement {
  const element = document.createElement('td');
  element.textContent = text;
  return element;
}

function formatLabels(record: VenueRecord): string {
  const labels = record.labels ?? [];
  if (labels.length === 0) return '—';
  const visible = labels.slice(0, 3).map((label) => label.text).join(' / ');
  return labels.length > 3 ? `${visible} / 另 ${labels.length - 3} 项` : visible;
}

function showStatus(
  element: HTMLElement | null,
  message: string,
  tone: 'success' | 'error',
): void {
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

void initializeOptions();

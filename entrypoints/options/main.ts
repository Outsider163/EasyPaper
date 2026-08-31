import {
  CATALOG_CSV_TEMPLATE,
  MAX_CATALOG_FILE_BYTES,
  parseVenueCatalog,
  type CatalogImportResult,
} from '../../src/ranking/catalog-import';
import {
  clearUserVenueCatalog,
  loadUserVenueCatalog,
  saveUserVenueCatalog,
} from '../../src/ranking/catalog-storage';
import {
  resetUserVenueCatalog,
  setUserVenueCatalog,
} from '../../src/ranking/registry';
import type { VenueRecord } from '../../src/ranking/types';
import { loadSettings, saveSettings } from '../../src/settings';
import './style.css';

let pendingImport: CatalogImportResult | undefined;

async function initializeOptions(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>('#settings-form');
  const enabled = document.querySelector<HTMLInputElement>('#enabled');
  const saveStatus = document.querySelector<HTMLElement>('#save-status');
  const fileInput = document.querySelector<HTMLInputElement>('#catalog-file');
  const fileName = document.querySelector<HTMLElement>('#file-name');
  const importButton = document.querySelector<HTMLButtonElement>('#import-catalog');
  const downloadButton =
    document.querySelector<HTMLButtonElement>('#download-template');
  const clearButton = document.querySelector<HTMLButtonElement>('#clear-catalog');
  const catalogStatus = document.querySelector<HTMLElement>('#catalog-status');
  const warnings = document.querySelector<HTMLUListElement>('#catalog-warnings');
  const settings = await loadSettings();

  if (enabled) {
    enabled.checked = settings.enabled;
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveSettings({ enabled: enabled?.checked ?? true });
    showStatus(saveStatus, '已保存', 'success');
  });

  fileInput?.addEventListener('change', async () => {
    pendingImport = undefined;
    if (importButton) {
      importButton.disabled = true;
    }
    clearWarnings(warnings);

    const file = fileInput.files?.[0];
    if (!file) {
      if (fileName) {
        fileName.textContent = '支持 .csv、.tsv、.json，最大 2 MB';
      }
      return;
    }
    if (fileName) {
      fileName.textContent = `${file.name} · ${formatBytes(file.size)}`;
    }
    if (file.size > MAX_CATALOG_FILE_BYTES) {
      showStatus(catalogStatus, '文件超过 2 MB，未读取。', 'error');
      return;
    }

    try {
      const result = parseVenueCatalog(await file.text(), file.name);
      setUserVenueCatalog(result.records);
      pendingImport = result;
      if (importButton) {
        importButton.disabled = false;
      }
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
    if (!pendingImport) {
      return;
    }
    await saveUserVenueCatalog(pendingImport.records);
    renderCatalog(pendingImport.records);
    showStatus(
      catalogStatus,
      `已导入 ${pendingImport.records.length} 条记录，刷新论文页面即可看到指标。`,
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
    if (!window.confirm('确定清空当前浏览器中已上传的期刊目录吗？')) {
      return;
    }
    await clearUserVenueCatalog();
    resetUserVenueCatalog();
    pendingImport = undefined;
    if (fileInput) {
      fileInput.value = '';
    }
    if (importButton) {
      importButton.disabled = true;
    }
    clearWarnings(warnings);
    renderCatalog([]);
    showStatus(catalogStatus, '已清空本地期刊目录。', 'success');
  });

  try {
    const currentCatalog = await loadUserVenueCatalog();
    setUserVenueCatalog(currentCatalog);
    renderCatalog(currentCatalog);
  } catch (error) {
    resetUserVenueCatalog();
    renderCatalog([]);
    showStatus(catalogStatus, `已有目录无法读取：${errorMessage(error)}`, 'error');
  }
}

function renderCatalog(records: readonly VenueRecord[]): void {
  const preview = document.querySelector<HTMLTableSectionElement>('#catalog-preview');
  const count = document.querySelector<HTMLElement>('#catalog-count');
  if (count) {
    count.textContent = `${records.length} 条`;
  }
  if (!preview) {
    return;
  }
  preview.replaceChildren();
  if (records.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'empty';
    cell.textContent = '尚未上传期刊目录';
    row.appendChild(cell);
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
    );
    preview.appendChild(row);
  }
}

function renderWarnings(
  list: HTMLUListElement | null,
  messages: readonly string[],
): void {
  if (!list) {
    return;
  }
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

function showStatus(
  element: HTMLElement | null,
  message: string,
  tone: 'success' | 'error',
): void {
  if (!element) {
    return;
  }
  element.textContent = message;
  element.dataset.tone = tone;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误';
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

void initializeOptions();

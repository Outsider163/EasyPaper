import { readFile } from 'node:fs/promises';

import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';

describe('online catalog settings UI', () => {
  it('contains update controls and catalog metadata fields', async () => {
    const html = await readFile('entrypoints/options/index.html', 'utf8');
    const document = parseHTML(html).document;

    for (const id of [
      'auto-catalog-updates',
      'update-remote-catalog',
      'remote-catalog-status',
      'remote-source',
      'remote-version',
      'remote-records',
      'remote-updated-at',
    ]) {
      expect(document.getElementById(id), `missing #${id}`).not.toBeNull();
    }
    expect(document.body.textContent).toContain('在线公开目录');
    expect(document.body.textContent).toContain('不会被自动覆盖');
  });
});

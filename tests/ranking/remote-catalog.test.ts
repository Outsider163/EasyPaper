import { describe, expect, it, vi } from 'vitest';

import {
  downloadRemoteCatalog,
  parseRemoteCatalogManifest,
  sha256Hex,
} from '../../src/ranking/remote-catalog-core';

describe('remote catalog download safety', () => {
  it('downloads, hashes and parses a versioned catalog', async () => {
    const manifestUrl = 'https://example.test/catalog/manifest.json';
    const dataUrl = 'https://example.test/catalog/catalog.csv';
    const dataText = [
      '期刊名称,CCF级别,CCF版本,北大中文核心标签,南大中文核心标签,中国科技核心标签',
      'Journal of Remote Tests,A,2026,2023版,CSSCI,CSTPCD',
    ].join('\n');
    const dataBytes = new TextEncoder().encode(dataText);
    const manifest = {
      schemaVersion: 1,
      catalogVersion: '2026.1',
      label: '公开测试目录',
      generatedAt: '2026-09-01T12:00:00.000Z',
      dataUrl: './catalog.csv',
      fileName: 'catalog.csv',
      sha256: await sha256Hex(dataBytes),
      byteLength: dataBytes.byteLength,
      recordCount: 1,
    };
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === manifestUrl) {
        return new Response(JSON.stringify(manifest), { status: 200 });
      }
      if (url === dataUrl) {
        return new Response(dataBytes, { status: 200 });
      }
      return new Response('', { status: 404 });
    }) as unknown as typeof fetch;

    const result = await downloadRemoteCatalog(manifestUrl, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.manifest.dataUrl).toBe(dataUrl);
    expect(result.records).toEqual([
      expect.objectContaining({
        canonicalName: 'Journal of Remote Tests',
        ccf: expect.objectContaining({ rank: 'A', edition: '2026' }),
        labels: expect.arrayContaining([
          expect.objectContaining({ kind: 'pku-core', text: '2023版' }),
          expect.objectContaining({ kind: 'cssci', text: 'CSSCI' }),
          expect.objectContaining({ kind: 'cstpcd', text: 'CSTPCD' }),
        ]),
      }),
    ]);
  });

  it('rejects a catalog whose bytes do not match the manifest hash', async () => {
    const manifestUrl = 'https://example.test/manifest.json';
    const dataText = '期刊名称,CCF级别\nTampered Journal,A';
    const bytes = new TextEncoder().encode(dataText);
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      String(input) === manifestUrl
        ? new Response(
            JSON.stringify({
              schemaVersion: 1,
              catalogVersion: '1',
              label: '测试目录',
              generatedAt: '2026-09-01T12:00:00.000Z',
              dataUrl: 'https://example.test/catalog.csv',
              fileName: 'catalog.csv',
              sha256: '0'.repeat(64),
              byteLength: bytes.byteLength,
              recordCount: 1,
            }),
          )
        : new Response(bytes),
    ) as unknown as typeof fetch;

    await expect(downloadRemoteCatalog(manifestUrl, fetcher)).rejects.toThrow(
      'SHA256 校验失败',
    );
  });

  it('requires HTTPS for manifest and data URLs', () => {
    expect(() =>
      parseRemoteCatalogManifest(
        JSON.stringify({
          schemaVersion: 1,
          catalogVersion: '1',
          label: '测试目录',
          generatedAt: '2026-09-01T12:00:00.000Z',
          dataUrl: 'http://example.test/catalog.csv',
          fileName: 'catalog.csv',
          sha256: '0'.repeat(64),
          byteLength: 10,
          recordCount: 1,
        }),
        'https://example.test/manifest.json',
      ),
    ).toThrow('必须使用 HTTPS');
  });
});

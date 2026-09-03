import { describe, expect, it } from 'vitest';
import { getSiteTarget, normalizeEnabledSites } from '../../src/sites/site-access';

describe('explicit per-site access', () => {
  it('retains the selected IP port but discards paper paths and queries', () => {
    expect(getSiteTarget('http://192.0.2.10:3344/kns8/defaultresult/index?q=private')).toEqual({
      origin: 'http://192.0.2.10:3344', permission: 'http://192.0.2.10/*',
    });
  });
  it.each([
    'chrome://extensions', 'file:///C:/paper.pdf', 'javascript:alert(1)', 'about:blank',
    'ftp://example.test', 'not a URL', 'https://user:password@example.test/',
    'https://kns.cnki.net/', 'http://cnki.net/', 'https://scholar.google.com/scholar',
    'https://scholar.google.com.hk/scholar', 'https://chromewebstore.google.com/',
    'https://*.example.test', 'http://*.cnki.net.example.test',
  ])('rejects protected, malformed, or already supported URLs: %s', (url) => {
    expect(getSiteTarget(url)).toBeUndefined();
  });
  it('does not treat deceptive suffixes as official sites', () => {
    expect(getSiteTarget('https://cnki.net.example.test/path')?.origin).toBe('https://cnki.net.example.test');
  });
  it('normalizes and bounds saved origin-only choices', () => {
    expect(normalizeEnabledSites(['https://example.test', 'https://example.test', 'https://example.test/path', null, 1, 'https://*.example.test/*'])).toEqual(['https://example.test']);
    expect(normalizeEnabledSites(null)).toEqual([]);
    expect(normalizeEnabledSites(Array.from({ length: 110 }, (_, i) => `https://host${i}.test`))).toHaveLength(100);
  });
});

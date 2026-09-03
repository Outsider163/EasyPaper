import { parseHTML } from 'linkedom';
import { afterEach, describe, expect, it } from 'vitest';
import { isScholarProUrl, parseScholarProPapers } from '../../src/sites/scholar-pro/parser';
import { parseAcademicPapers } from '../../src/sites/academic/parser';
import { ACADEMIC_PANEL_ATTRIBUTE, decorateAcademicPapers, removeAcademicDecorations } from '../../src/sites/academic/decorator';
import { parseVenueCatalog } from '../../src/ranking/catalog-import';
import { resetUserVenueCatalog, setUserVenueCatalog } from '../../src/ranking/registry';
import { SCHOLAR_PRO_RESULTS_HTML } from '../fixtures/scholar-pro-results';

function createDocument(url = 'https://www.googlescholar.pro/search_results.php?q=test'): Document {
  const document = parseHTML(SCHOLAR_PRO_RESULTS_HTML).document as unknown as Document;
  Object.defineProperty(document, 'URL', { value: url });
  return document;
}
afterEach(() => resetUserVenueCatalog());

describe('googlescholar.pro custom cards', () => {
  it('extracts the venue from card-meta without including translation controls or abstracts', () => {
    const document = createDocument();
    const papers = parseScholarProPapers(document);
    expect(papers).toHaveLength(3);
    expect(papers[0]).toEqual(expect.objectContaining({ title: 'A Journal Paper', venueCandidate: 'Science', sourceTruncated: false }));
    expect(papers[1]).toEqual(expect.objectContaining({ title: 'A Truncated Paper', sourceTruncated: true }));
    expect(papers[2]).toEqual(expect.objectContaining({ title: 'A Conference Paper', venueCandidate: 'Advances in Neural Information Processing Systems' }));
    expect(parseAcademicPapers(document).every((paper) => paper.adapter === 'GoogleScholar.pro')).toBe(true);
  });

  it.each([
    'https://www.googlescholar.pro/', 'https://googlescholar.pro/',
    'https://www.googlescholar.pro/cites.php?paper_id=example',
  ])('recognizes the site host %s', (url) => {
    expect(isScholarProUrl(url)).toBe(true);
  });

  it.each([
    'https://www.googlescholar.pro.example.test/', 'https://another.test/',
    'file:///tmp/scholar-pro.html', 'not-a-url', undefined,
  ])('does not scan generic cards on an unrelated/protected URL: %s', (url) => {
    expect(isScholarProUrl(url)).toBe(false);
    const document = createDocument(url ?? '');
    expect(parseAcademicPapers(document)).toHaveLength(0);
  });

  it('does not label a homepage, missing publication, a bare year, or a publisher', () => {
    const document = createDocument();
    for (const text of ['A Author - 2025 - Nature', 'A Author - nature.com', 'A Author - No year - Publisher', '']) {
      document.querySelectorAll('.card-meta').forEach((meta) => { meta.textContent = text; });
      expect(parseScholarProPapers(document)).toHaveLength(0);
    }
    document.querySelector('.search-results')!.remove();
    expect(decorateAcademicPapers(document)).toBe(0);
  });

  it('renders EasyPaper rankings while leaving native metrics and buttons untouched', () => {
    setUserVenueCatalog(parseVenueCatalog('期刊名称,中科院分区,影响因子,影响因子年份\nScience,1区,44.7,2025', 'test.csv').records);
    const document = createDocument();
    const metrics = document.querySelector('.journal-metrics-container')!;
    const controls = document.querySelector('.card-actions')!;
    const metricsBefore = metrics.outerHTML;
    const controlsBefore = controls.outerHTML;
    expect(decorateAcademicPapers(document)).toBe(3);
    expect(decorateAcademicPapers(document)).toBe(3);
    const panels = document.querySelectorAll(`[${ACADEMIC_PANEL_ATTRIBUTE}]`);
    expect(panels).toHaveLength(3);
    expect(panels[0]?.textContent).toContain('中科院 1区');
    expect(panels[0]?.textContent).toContain('IF 44.7（2025）');
    expect(panels[0]?.textContent).not.toContain('99.9');
    expect(panels[1]?.textContent).toContain('文字不完整');
    expect(panels[1]?.textContent).not.toContain('中科院');
    expect(panels[2]?.textContent).toContain('CCF-A 类推荐');
    expect(panels[0]?.previousElementSibling?.className).toBe('card-title');
    expect(metrics.outerHTML).toBe(metricsBefore);
    expect(controls.outerHTML).toBe(controlsBefore);
    removeAcademicDecorations(document);
    expect(metrics.outerHTML).toBe(metricsBefore);
  });

  it('updates a replaced source and removes labels when a result becomes unrecognizable', () => {
    const document = createDocument();
    decorateAcademicPapers(document);
    document.querySelector('.card-meta')!.textContent = 'A Author - Unknown Test Journal, 2024 - example.test';
    decorateAcademicPapers(document);
    expect(document.querySelector(`[${ACADEMIC_PANEL_ATTRIBUTE}]`)?.textContent).toBe('EasyPaper · 来源：Unknown Test Journal');
    document.querySelector('.card-meta')!.textContent = '';
    decorateAcademicPapers(document);
    expect(document.querySelector('[data-test-id="journal"]')?.querySelector(`[${ACADEMIC_PANEL_ATTRIBUTE}]`)).toBeNull();
  });
});

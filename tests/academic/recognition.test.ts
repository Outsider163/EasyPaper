import { parseHTML } from 'linkedom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseAcademicPapers } from '../../src/sites/academic/parser';
import { ACADEMIC_PANEL_ATTRIBUTE, ACADEMIC_STYLE_ID, decorateAcademicPapers, removeAcademicDecorations } from '../../src/sites/academic/decorator';
import { watchAcademicPage } from '../../src/sites/academic/observer';
import { RANKING_BADGE_ATTRIBUTE } from '../../src/ranking/badges';
import { parseVenueCatalog } from '../../src/ranking/catalog-import';
import { resetUserVenueCatalog, setUserVenueCatalog } from '../../src/ranking/registry';
import { CNKI_DETAIL_HTML, CNKI_RESULTS_HTML } from '../fixtures/cnki-pages';
import { GOOGLE_SCHOLAR_RESULTS_HTML } from '../fixtures/google-scholar-results';

const doc = (html: string): Document => parseHTML(html).document as unknown as Document;
const panels = (document: Document) => document.querySelectorAll(`[${ACADEMIC_PANEL_ATTRIBUTE}]`);
afterEach(() => { resetUserVenueCatalog(); vi.useRealTimers(); });

describe('academic portals and mirrors', () => {
  it('recognizes CNKI rows with relative mirror links without depending on the hostname', () => {
    const document = doc(CNKI_RESULTS_HTML);
    const papers = parseAcademicPapers(document);
    expect(papers).toHaveLength(3);
    expect(papers[0]?.adapter).toBe('知网兼容页面');
    expect(papers[0]?.venueCandidate).toBe('Advances in Neural Information Processing Systems');
    expect(decorateAcademicPapers(document)).toBe(3);
    expect(panels(document)[0]?.textContent).toContain('CCF-A 类推荐');
    expect(panels(document)[1]?.textContent).toBe('EasyPaper · 来源：情报科学');
    expect(panels(document)[2]?.textContent).toContain('文字不完整');
  });

  it('reuses Scholar parsing on compatible mirror cards', () => {
    const document = doc(GOOGLE_SCHOLAR_RESULTS_HTML);
    const papers = parseAcademicPapers(document);
    expect(papers.length).toBeGreaterThan(0);
    expect(papers.every((paper) => paper.adapter === 'Scholar 兼容页面')).toBe(true);
    decorateAcademicPapers(document);
    expect(panels(document)[0]?.textContent).toContain('CCF-A 类推荐');
    expect(document.querySelector('.gs_rt')?.nextElementSibling?.hasAttribute(ACADEMIC_PANEL_ATTRIBUTE)).toBe(true);
  });

  it('recognizes paper metadata and does not put a panel inside the title link', () => {
    const document = doc(CNKI_DETAIL_HTML);
    expect(parseAcademicPapers(document)[0]?.adapter).toBe('论文元数据');
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(panels(document)[0]?.previousElementSibling?.tagName).toBe('H1');
  });

  it('requires a recognizable CNKI detail structure when citation metadata is absent', () => {
    const document = doc('<html><head></head><body><div class="wx-tit"><h1>论文</h1><div class="source">情报科学</div></div></body></html>');
    expect(parseAcademicPapers(document)[0]?.venueCandidate).toBe('情报科学');
  });

  it.each([
    '<h1>学术猫</h1><nav><a>Nature</a><a>中国知网</a><a>CCF</a></nav>',
    '<h1>登录</h1><div class="source">Nature</div><input type="password">',
    '<h1>数据库</h1><div class="sourinfo"><a>Nature</a></div>',
  ])('does not label a navigation/login page: %s', (body) => {
    const document = doc(`<html><head></head><body>${body}</body></html>`);
    expect(decorateAcademicPapers(document)).toBe(0);
    expect(panels(document)).toHaveLength(0);
    expect(document.getElementById(ACADEMIC_STYLE_ID)).toBeNull();
  });

  it('ignores stale and conflicting detail metadata', () => {
    const document = doc(CNKI_DETAIL_HTML);
    document.querySelector('h1')!.textContent = 'A Different Paper';
    expect(parseAcademicPapers(document)).toHaveLength(0);
    document.querySelector('h1')!.textContent = 'Attention Is All You Need';
    const meta = document.createElement('meta');
    meta.name = 'citation_journal_title'; meta.content = 'Other Journal';
    document.head.append(meta);
    expect(parseAcademicPapers(document)).toHaveLength(0);
  });

  it('is idempotent, updates changed sources, and removes tags of deleted titles', () => {
    const document = doc(CNKI_RESULTS_HTML);
    decorateAcademicPapers(document);
    decorateAcademicPapers(document);
    expect(panels(document)).toHaveLength(3);
    expect(document.querySelectorAll(`#${ACADEMIC_STYLE_ID}`)).toHaveLength(1);
    document.querySelector('td.source')!.textContent = 'A Nonexistent Journal';
    decorateAcademicPapers(document);
    expect(panels(document)[0]?.textContent).not.toContain('CCF-A');
    document.querySelector('td.name a')!.remove();
    decorateAcademicPapers(document);
    expect(panels(document)).toHaveLength(2);
    document.querySelectorAll('td.source').forEach((source) => { source.textContent = ''; });
    expect(decorateAcademicPapers(document)).toBe(0);
    expect(panels(document)).toHaveLength(0);
  });

  it('renders all available imported labels safely as text', () => {
    const data = parseVenueCatalog('期刊名称,中科院分区,影响因子,影响因子年份,学校等级,学校名称,北大中文核心标签,南大中文核心标签,中国科技核心标签\n情报科学,2区,4.2,2025,A,示例大学,是,CSSCI,CSTPCD', 'test.csv');
    setUserVenueCatalog(data.records);
    const document = doc(CNKI_RESULTS_HTML);
    decorateAcademicPapers(document);
    const panel = panels(document)[1]!;
    for (const label of ['中科院 2区', 'IF 4.2（2025）', '示例大学 A', '北大中文核心', '南大中文核心', '中国科技核心']) {
      expect(panel.textContent).toContain(label);
    }
    document.querySelectorAll('td.source')[1]!.textContent = '<img src=x onerror=alert(1)>';
    decorateAcademicPapers(document);
    expect(panels(document)[1]?.querySelector('img')).toBeNull();
    expect(panels(document)[1]?.querySelector(`[${RANKING_BADGE_ATTRIBUTE}="cas"]`)).toBeNull();
    removeAcademicDecorations(document);
    expect(panels(document)).toHaveLength(0);
  });

  it('automatically handles asynchronous results and source edits without a self-render loop', async () => {
    vi.useFakeTimers();
    const document = doc(CNKI_RESULTS_HTML);
    const render = vi.fn(() => decorateAcademicPapers(document));
    const stop = watchAcademicPage(document, render);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(400);
    expect(render).toHaveBeenCalledTimes(1);
    document.querySelector('td.source')!.textContent = 'A Changed Journal';
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(160);
    expect(render).toHaveBeenCalledTimes(2);
    expect(panels(document)[0]?.textContent).toContain('A Changed Journal');
    const row = document.querySelector('tbody tr')!.cloneNode(true) as Element;
    row.querySelector(`[${ACADEMIC_PANEL_ATTRIBUTE}]`)?.remove();
    document.querySelector('tbody')!.append(row);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(160);
    expect(panels(document)).toHaveLength(4);
    stop();
    document.querySelector('tbody')!.textContent = '';
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(400);
    expect(render).toHaveBeenCalledTimes(3);
  });
});

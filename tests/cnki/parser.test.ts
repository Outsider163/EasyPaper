import { parseHTML } from 'linkedom';
import { afterEach, describe, expect, it } from 'vitest';

import { RANKING_BADGE_ATTRIBUTE } from '../../src/ranking/badges';
import { parseVenueCatalog } from '../../src/ranking/catalog-import';
import {
  resetUserVenueCatalog,
  setUserVenueCatalog,
} from '../../src/ranking/registry';
import {
  decorateCnkiPapers,
  removeCnkiDecorations,
  CNKI_CCF_RANK_ATTRIBUTE,
  CNKI_PANEL_ATTRIBUTE,
  CNKI_STYLE_ID,
} from '../../src/sites/cnki/decorator';
import {
  parseCnkiDetail,
  parseCnkiResults,
} from '../../src/sites/cnki/parser';
import { CNKI_DETAIL_HTML, CNKI_RESULTS_HTML } from '../fixtures/cnki-pages';

function resultDocument(): Document {
  return parseHTML(CNKI_RESULTS_HTML).document as unknown as Document;
}

function detailDocument(): Document {
  return parseHTML(CNKI_DETAIL_HTML).document as unknown as Document;
}

afterEach(() => {
  resetUserVenueCatalog();
});

describe('CNKI parser', () => {
  it('extracts title, author, source, date, database, and stable id from rows', () => {
    const [paper] = parseCnkiResults(resultDocument());

    expect(paper).toEqual({
      id: 'cnki-neurips',
      kind: 'result',
      title: 'Attention Is All You Need',
      url: '/kcms2/article/abstract?id=neurips',
      authorsText: 'A Vaswani; N Shazeer; N Parmar',
      venueCandidate: 'Advances in Neural Information Processing Systems',
      publicationDateText: '2017-12-01',
      year: 2017,
      databaseText: '会议',
      sourceTruncated: false,
    });
  });

  it('marks visibly truncated source text as unsafe for ranking', () => {
    const paper = parseCnkiResults(resultDocument())[2]!;

    expect(paper.venueCandidate).toBe(
      '…International Conference on Examples',
    );
    expect(paper.sourceTruncated).toBe(true);
  });

  it('uses citation metadata on a paper detail page', () => {
    expect(parseCnkiDetail(detailDocument())).toEqual({
      id: 'https://kns.cnki.net/kcms2/article/abstract?id=neurips',
      kind: 'detail',
      title: 'Attention Is All You Need',
      url: 'https://kns.cnki.net/kcms2/article/abstract?id=neurips',
      authorsText: 'Ashish Vaswani, Noam Shazeer',
      venueCandidate: 'Advances in Neural Information Processing Systems',
      publicationDateText: '2017/12/01',
      year: 2017,
      databaseText: undefined,
      sourceTruncated: false,
    });
  });
});

describe('CNKI decoration', () => {
  it('adds one badge panel below every result and remains idempotent', () => {
    const document = resultDocument();

    expect(decorateCnkiPapers(document)).toBe(3);
    expect(decorateCnkiPapers(document)).toBe(3);
    expect(document.querySelectorAll(`[${CNKI_PANEL_ATTRIBUTE}]`)).toHaveLength(
      3,
    );
    expect(document.querySelectorAll(`#${CNKI_STYLE_ID}`)).toHaveLength(1);

    const title = document.querySelector('tr[data-key="cnki-neurips"] .name a');
    expect(title?.nextElementSibling?.hasAttribute(CNKI_PANEL_ATTRIBUTE)).toBe(
      true,
    );
  });

  it('shows source plus CCF on exact matches and only source on unknown journals', () => {
    const document = resultDocument();
    decorateCnkiPapers(document);

    const panels = document.querySelectorAll<HTMLElement>(
      `[${CNKI_PANEL_ATTRIBUTE}]`,
    );

    expect(
      panels.item(0).querySelector(`[${RANKING_BADGE_ATTRIBUTE}="ccf"]`)
        ?.textContent,
    ).toBe('CCF A');
    expect(panels.item(0).getAttribute(CNKI_CCF_RANK_ATTRIBUTE)).toBe('A');
    expect(panels.item(1).textContent).toBe('EasyPaper · 来源：情报科学');
    expect(
      panels.item(1).querySelectorAll(`[${RANKING_BADGE_ATTRIBUTE}]`),
    ).toHaveLength(1);
    expect(panels.item(1).hasAttribute(CNKI_CCF_RANK_ATTRIBUTE)).toBe(false);
    expect(panels.item(2).textContent).toContain('文字不完整');
    expect(panels.item(2).hasAttribute(CNKI_CCF_RANK_ATTRIBUTE)).toBe(false);
  });

  it('renders uploaded CAS, impact-factor, and school badges end to end', () => {
    const imported = parseVenueCatalog(
      '期刊名称,中科院分区,中科院版本,影响因子,影响因子年份,学校等级,学校名称\n情报科学,2区,2025,4.2,2025,A,示例大学',
      'journals.csv',
    );
    setUserVenueCatalog(imported.records);
    const document = resultDocument();
    decorateCnkiPapers(document);

    const panel = document.querySelector<HTMLElement>(
      `tr[data-key="cnki-journal"] [${CNKI_PANEL_ATTRIBUTE}]`,
    );
    expect(
      panel?.querySelector(`[${RANKING_BADGE_ATTRIBUTE}="cas"]`)?.textContent,
    ).toBe('中科院 2区');
    expect(
      panel?.querySelector(`[${RANKING_BADGE_ATTRIBUTE}="impact-factor"]`)
        ?.textContent,
    ).toBe('IF 4.2（2025）');
    expect(
      panel?.querySelector(`[${RANKING_BADGE_ATTRIBUTE}="school"]`)?.textContent,
    ).toBe('示例大学 A');
  });

  it('decorates a detail page from citation metadata', () => {
    const document = detailDocument();

    expect(decorateCnkiPapers(document)).toBe(1);
    const panel = document.querySelector<HTMLElement>(
      `[${CNKI_PANEL_ATTRIBUTE}]`,
    );
    expect(
      panel?.querySelector(`[${RANKING_BADGE_ATTRIBUTE}="ccf"]`)?.textContent,
    ).toBe('CCF A');
    expect(panel?.previousElementSibling?.tagName).toBe('H1');
  });

  it('removes all labels and shared styles', () => {
    const document = resultDocument();
    decorateCnkiPapers(document);

    removeCnkiDecorations(document);

    expect(document.querySelectorAll(`[${CNKI_PANEL_ATTRIBUTE}]`)).toHaveLength(
      0,
    );
    expect(document.getElementById(CNKI_STYLE_ID)).toBeNull();
  });
});

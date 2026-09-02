import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';

import { RANKING_BADGE_ATTRIBUTE } from '../../src/ranking/badges';
import {
  decorateGoogleScholarResults,
  SCHOLAR_CCF_RANK_ATTRIBUTE,
  SCHOLAR_PANEL_ATTRIBUTE,
} from '../../src/sites/google-scholar/decorator';
import { GOOGLE_SCHOLAR_RESULTS_HTML } from '../fixtures/google-scholar-results';

function createDocument(): Document {
  return parseHTML(GOOGLE_SCHOLAR_RESULTS_HTML).document as unknown as Document;
}

describe('Google Scholar ranking decoration', () => {
  it('shows source and verified CCF badges for an exact proceedings alias', () => {
    const document = createDocument();
    decorateGoogleScholarResults(document);

    const panel = document.querySelector<HTMLElement>(
      `[data-cid="conference-result"] [${SCHOLAR_PANEL_ATTRIBUTE}]`,
    );

    expect(
      panel?.querySelector(`[${RANKING_BADGE_ATTRIBUTE}="source"]`)?.textContent,
    ).toBe(
      'EasyPaper · 来源：Advances in Neural Information Processing Systems',
    );
    expect(
      panel?.querySelector(`[${RANKING_BADGE_ATTRIBUTE}="ccf"]`)?.textContent,
    ).toBe('CCF-A 类推荐');
    expect(panel?.getAttribute(SCHOLAR_CCF_RANK_ATTRIBUTE)).toBe('A');
    expect(panel?.getAttribute('data-easypaper-match-confidence')).toBe('high');
    expect(panel?.title).toContain(
      '匹配：Conference on Neural Information Processing Systems',
    );
  });

  it('keeps an unknown venue as a source badge without inventing a rank', () => {
    const document = createDocument();
    decorateGoogleScholarResults(document);

    const panel = document.querySelector<HTMLElement>(
      `[data-aid="journal-result"] [${SCHOLAR_PANEL_ATTRIBUTE}]`,
    );

    expect(panel?.querySelectorAll(`[${RANKING_BADGE_ATTRIBUTE}]`)).toHaveLength(
      1,
    );
    expect(panel?.textContent).toBe(
      'EasyPaper · 来源：Journal of Useful Results',
    );
    expect(panel?.hasAttribute(SCHOLAR_CCF_RANK_ATTRIBUTE)).toBe(false);
  });

  it('never assigns a rank when Scholar visibly truncates the source', () => {
    const document = createDocument();
    decorateGoogleScholarResults(document);

    const panels = document.querySelectorAll<HTMLElement>(
      `[${SCHOLAR_PANEL_ATTRIBUTE}]`,
    );
    const panel = panels.item(5);

    expect(panel.textContent).toContain('文字不完整');
    expect(panel.querySelectorAll(`[${RANKING_BADGE_ATTRIBUTE}]`)).toHaveLength(
      1,
    );
    expect(panel.hasAttribute(SCHOLAR_CCF_RANK_ATTRIBUTE)).toBe(false);
    expect(panel.title).toContain('未尝试贴分区标签');
  });
});

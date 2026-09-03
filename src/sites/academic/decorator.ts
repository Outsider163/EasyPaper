import { buildRankingBadges, buildRankingTooltip, createRankingBadgeCss, renderRankingBadges } from '../../ranking/badges';
import { ccf2026SeedMatcher } from '../../ranking/registry';
import { parseAcademicPapers } from './parser';

export const ACADEMIC_PANEL_ATTRIBUTE = 'data-easypaper-academic-panel';
export const ACADEMIC_STYLE_ID = 'easypaper-academic-styles';

export function decorateAcademicPapers(document: Document): number {
  const active = new Set<Element>();
  for (const paper of parseAcademicPapers(document)) {
    const { titleElement } = paper;
    // Never duplicate another EasyPaper adapter's panel.
    if (titleElement.nextElementSibling?.matches('[data-easypaper-cnki-panel], [data-easypaper-scholar-panel]')) continue;
    let panel = titleElement.nextElementSibling as HTMLElement | null;
    if (!panel?.hasAttribute(ACADEMIC_PANEL_ATTRIBUTE)) {
      panel = document.createElement(titleElement.tagName === 'DT' ? 'dd' : titleElement.closest('cite') ? 'span' : 'div');
      panel.setAttribute(ACADEMIC_PANEL_ATTRIBUTE, '');
      panel.setAttribute('role', 'note');
      titleElement.after(panel);
    }
    const match = ccf2026SeedMatcher.match({
      candidate: paper.venueCandidate, sourceTruncated: paper.sourceTruncated,
    });
    panel.title = buildRankingTooltip(paper.adapter, match, paper.venueCandidate) +
      (paper.sourceEvidence ? `\n页面来源：${paper.sourceEvidence}` : '');
    renderRankingBadges(panel, buildRankingBadges(match, paper.venueCandidate, paper.sourceTruncated));
    active.add(panel);
  }
  document.querySelectorAll(`[${ACADEMIC_PANEL_ATTRIBUTE}]`).forEach((panel) => {
    if (!active.has(panel)) panel.remove();
  });
  if (active.size && !document.getElementById(ACADEMIC_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = ACADEMIC_STYLE_ID;
    style.textContent = createRankingBadgeCss(ACADEMIC_PANEL_ATTRIBUTE);
    (document.head ?? document.documentElement).append(style);
  } else if (!active.size) document.getElementById(ACADEMIC_STYLE_ID)?.remove();
  return active.size;
}

export function removeAcademicDecorations(document: Document): void {
  document.querySelectorAll(`[${ACADEMIC_PANEL_ATTRIBUTE}]`).forEach((panel) => panel.remove());
  document.getElementById(ACADEMIC_STYLE_ID)?.remove();
}

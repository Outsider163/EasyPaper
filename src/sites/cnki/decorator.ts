import {
  buildRankingBadges,
  buildRankingTooltip,
  createRankingBadgeCss,
  renderRankingBadges,
} from '../../ranking/badges';
import type { VenueMatchResult } from '../../ranking/matcher';
import { ccf2026SeedMatcher } from '../../ranking/registry';
import {
  CNKI_RESULT_SELECTOR,
  findCnkiDetailTitleElement,
  findCnkiResultTitleElement,
  parseCnkiDetail,
  parseCnkiResultRow,
  type CnkiPaperResult,
} from './parser';

export const CNKI_PANEL_ATTRIBUTE = 'data-easypaper-cnki-panel';
export const CNKI_CCF_RANK_ATTRIBUTE = 'data-easypaper-ccf-rank';
export const CNKI_STYLE_ID = 'easypaper-cnki-styles';

export function decorateCnkiPapers(root: ParentNode): number {
  const rows = Array.from(root.querySelectorAll(CNKI_RESULT_SELECTOR));
  let decoratedCount = 0;

  rows.forEach((row, index) => {
    const result = parseCnkiResultRow(row, index);
    const titleElement = findCnkiResultTitleElement(row);
    if (!result || !titleElement) {
      return;
    }

    renderPanel(row, titleElement, result);
    decoratedCount += 1;
  });

  if (decoratedCount > 0) {
    return decoratedCount;
  }

  const document = getOwnerDocument(root);
  if (!document) {
    return 0;
  }

  const detail = parseCnkiDetail(document);
  const detailTitle = findCnkiDetailTitleElement(document);
  if (!detail || !detailTitle) {
    return 0;
  }

  renderPanel(document, detailTitle, detail);
  return 1;
}

export function removeCnkiDecorations(root: ParentNode): void {
  root
    .querySelectorAll(`[${CNKI_PANEL_ATTRIBUTE}]`)
    .forEach((panel) => panel.remove());
  getOwnerDocument(root)?.getElementById(CNKI_STYLE_ID)?.remove();
}

function renderPanel(
  scope: ParentNode,
  titleElement: HTMLElement,
  result: CnkiPaperResult,
): void {
  const ownerDocument = titleElement.ownerDocument;
  ensureStyles(ownerDocument);

  let panel = scope.querySelector<HTMLElement>(`[${CNKI_PANEL_ATTRIBUTE}]`);
  if (!panel) {
    panel = ownerDocument.createElement('div');
    panel.setAttribute(CNKI_PANEL_ATTRIBUTE, result.id);
    panel.setAttribute('role', 'note');
    titleElement.parentNode?.insertBefore(panel, titleElement.nextSibling);
  }

  const match = ccf2026SeedMatcher.match({
    candidate: result.venueCandidate,
    sourceTruncated: result.sourceTruncated,
  });
  updatePanelState(panel, result, match);
  renderRankingBadges(
    panel,
    buildRankingBadges(match, result.venueCandidate, result.sourceTruncated),
  );

  if (panel.getAttribute(CNKI_PANEL_ATTRIBUTE) !== result.id) {
    panel.setAttribute(CNKI_PANEL_ATTRIBUTE, result.id);
  }
}

function updatePanelState(
  panel: HTMLElement,
  result: CnkiPaperResult,
  match: VenueMatchResult,
): void {
  panel.removeAttribute(CNKI_CCF_RANK_ATTRIBUTE);
  panel.removeAttribute('data-easypaper-cas-quartile');
  panel.removeAttribute('data-easypaper-impact-factor');
  panel.removeAttribute('data-easypaper-school-rank');
  panel.removeAttribute('data-easypaper-venue-id');
  panel.removeAttribute('data-easypaper-match-confidence');

  if (match.status === 'matched') {
    const venue = match.venue;
    if (venue.ccf) {
      panel.setAttribute(CNKI_CCF_RANK_ATTRIBUTE, venue.ccf.rank);
    }
    if (venue.cas) {
      panel.setAttribute('data-easypaper-cas-quartile', venue.cas.rank);
    }
    if (venue.impactFactor) {
      panel.setAttribute(
        'data-easypaper-impact-factor',
        String(venue.impactFactor.value),
      );
    }
    if (venue.school) {
      panel.setAttribute('data-easypaper-school-rank', venue.school.rank);
    }
    panel.setAttribute('data-easypaper-venue-id', venue.id);
    panel.setAttribute('data-easypaper-match-confidence', match.confidence);
  }

  panel.title =
    match.status === 'unmatched' && match.reason === 'truncated-source'
      ? '知网来源文字不完整，EasyPaper 未尝试贴分区标签。'
      : buildRankingTooltip('知网', match, result.venueCandidate);
}

function ensureStyles(ownerDocument: Document): void {
  if (ownerDocument.getElementById(CNKI_STYLE_ID)) {
    return;
  }

  const style = ownerDocument.createElement('style');
  style.id = CNKI_STYLE_ID;
  style.textContent = createRankingBadgeCss(CNKI_PANEL_ATTRIBUTE);
  (ownerDocument.head ?? ownerDocument.documentElement).appendChild(style);
}

function getOwnerDocument(root: ParentNode): Document | undefined {
  if ((root as Node).nodeType === 9) {
    return root as Document;
  }
  return (root as Node).ownerDocument ?? undefined;
}

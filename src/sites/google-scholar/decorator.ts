import {
  buildRankingBadges,
  buildRankingTooltip,
  createRankingBadgeCss,
  renderRankingBadges,
} from '../../ranking/badges';
import type { VenueMatchResult } from '../../ranking/matcher';
import { ccf2026SeedMatcher } from '../../ranking/registry';
import type { GoogleScholarResult } from '../types';
import {
  GOOGLE_SCHOLAR_RESULT_SELECTOR,
  parseGoogleScholarResult,
} from './parser';

export const SCHOLAR_PANEL_ATTRIBUTE = 'data-easypaper-scholar-panel';
export const SCHOLAR_CCF_RANK_ATTRIBUTE = 'data-easypaper-ccf-rank';
export const SCHOLAR_STYLE_ID = 'easypaper-google-scholar-styles';

const TITLE_SELECTOR = '.gs_rt';
const RESULT_BODY_SELECTOR = '.gs_ri';

export function decorateGoogleScholarResults(root: ParentNode): number {
  const cards = Array.from(root.querySelectorAll(GOOGLE_SCHOLAR_RESULT_SELECTOR));
  let decoratedCount = 0;

  cards.forEach((card, index) => {
    if (!card.querySelector(RESULT_BODY_SELECTOR)) {
      return;
    }

    const result = parseGoogleScholarResult(card, index);
    const titleElement = card.querySelector(TITLE_SELECTOR);
    if (!result || !titleElement || !titleElement.parentNode) {
      return;
    }

    const ownerDocument = titleElement.ownerDocument;
    ensureStyles(ownerDocument);

    let panel = card.querySelector<HTMLElement>(`[${SCHOLAR_PANEL_ATTRIBUTE}]`);
    if (!panel) {
      panel = ownerDocument.createElement('div');
      panel.setAttribute(SCHOLAR_PANEL_ATTRIBUTE, result.id);
      panel.setAttribute('role', 'note');
      titleElement.parentNode.insertBefore(panel, titleElement.nextSibling);
    }

    const match = ccf2026SeedMatcher.match({
      candidate: result.venueCandidate,
      sourceTruncated: result.sourceTruncated,
    });
    updatePanelMatchState(panel, result, match);
    renderRankingBadges(
      panel,
      buildRankingBadges(match, result.venueCandidate, result.sourceTruncated),
    );

    if (panel.getAttribute(SCHOLAR_PANEL_ATTRIBUTE) !== result.id) {
      panel.setAttribute(SCHOLAR_PANEL_ATTRIBUTE, result.id);
    }

    decoratedCount += 1;
  });

  return decoratedCount;
}

export function removeGoogleScholarDecorations(root: ParentNode): void {
  root
    .querySelectorAll(`[${SCHOLAR_PANEL_ATTRIBUTE}]`)
    .forEach((panel) => panel.remove());

  getOwnerDocument(root)?.getElementById(SCHOLAR_STYLE_ID)?.remove();
}

function updatePanelMatchState(
  panel: HTMLElement,
  result: GoogleScholarResult,
  match: VenueMatchResult,
): void {
  panel.removeAttribute(SCHOLAR_CCF_RANK_ATTRIBUTE);
  panel.removeAttribute('data-easypaper-cas-quartile');
  panel.removeAttribute('data-easypaper-impact-factor');
  panel.removeAttribute('data-easypaper-school-rank');
  panel.removeAttribute('data-easypaper-venue-id');
  panel.removeAttribute('data-easypaper-match-confidence');

  if (match.status === 'matched') {
    const venue = match.venue;
    if (venue.ccf) {
      panel.setAttribute(SCHOLAR_CCF_RANK_ATTRIBUTE, venue.ccf.rank);
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
      ? 'Google Scholar 来源文字不完整，EasyPaper 未尝试贴分区标签。'
      : buildRankingTooltip('Google Scholar', match, result.venueCandidate);
}

function ensureStyles(ownerDocument: Document): void {
  if (ownerDocument.getElementById(SCHOLAR_STYLE_ID)) {
    return;
  }

  const style = ownerDocument.createElement('style');
  style.id = SCHOLAR_STYLE_ID;
  style.textContent = createRankingBadgeCss(SCHOLAR_PANEL_ATTRIBUTE);
  (ownerDocument.head ?? ownerDocument.documentElement).appendChild(style);
}

function getOwnerDocument(root: ParentNode): Document | undefined {
  if ((root as Node).nodeType === 9) {
    return root as Document;
  }
  return (root as Node).ownerDocument ?? undefined;
}

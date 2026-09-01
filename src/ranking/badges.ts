import type { VenueMatchResult } from './matcher';
import type { VenueLabel } from './types';

export type RankingBadgeKind =
  | 'source'
  | 'ccf'
  | 'cas'
  | 'cas-discipline'
  | 'new-rising'
  | 'indexing'
  | 'impact-factor'
  | 'school'
  | 'publication-type'
  | 'warning'
  | 'note';

export interface RankingBadge {
  kind: RankingBadgeKind;
  text: string;
}

export const RANKING_BADGE_ATTRIBUTE = 'data-easypaper-badge';

export function buildRankingBadges(
  match: VenueMatchResult,
  sourceCandidate: string | undefined,
  sourceTruncated = false,
): RankingBadge[] {
  const matchedVenue = match.status === 'matched' ? match.venue : undefined;
  const source =
    sourceCandidate ??
    matchedVenue?.acronyms?.[0] ??
    matchedVenue?.canonicalName ??
    '待识别';
  const badges: RankingBadge[] = [
    {
      kind: 'source',
      text: `EasyPaper · 来源：${source}${sourceTruncated ? '（文字不完整）' : ''}`,
    },
  ];

  if (!matchedVenue) {
    return badges;
  }
  const supplemental = matchedVenue.labels ?? [];
  appendLabels(badges, supplemental, [
    'new-rising',
    'cas-discipline',
    'indexing',
  ]);

  const hasCasDiscipline = supplemental.some(
    (label) => label.kind === 'cas-discipline',
  );
  if (matchedVenue.cas && !hasCasDiscipline) {
    badges.push({ kind: 'cas', text: `中科院 ${matchedVenue.cas.rank}区` });
  }
  if (matchedVenue.ccf) {
    badges.push({ kind: 'ccf', text: `CCF ${matchedVenue.ccf.rank}` });
  }
  if (matchedVenue.impactFactor) {
    badges.push({
      kind: 'impact-factor',
      text: `IF ${formatNumber(matchedVenue.impactFactor.value)}（${matchedVenue.impactFactor.year}）`,
    });
  }
  if (matchedVenue.school) {
    badges.push({
      kind: 'school',
      text: `${matchedVenue.school.catalog ?? '学校'} ${matchedVenue.school.rank}`,
    });
  }
  appendLabels(badges, supplemental, ['publication-type', 'warning', 'note']);
  return badges;
}

export function renderRankingBadges(
  panel: HTMLElement,
  badges: readonly RankingBadge[],
): void {
  const signature = JSON.stringify(badges);
  if (panel.getAttribute('data-easypaper-badge-signature') === signature) {
    return;
  }

  const ownerDocument = panel.ownerDocument;
  const elements = badges.map((badge) => {
    const element = ownerDocument.createElement('span');
    element.setAttribute(RANKING_BADGE_ATTRIBUTE, badge.kind);
    element.textContent = badge.text;
    return element;
  });
  panel.replaceChildren(...elements);
  panel.setAttribute('data-easypaper-badge-signature', signature);
}

export function createRankingBadgeCss(panelAttribute: string): string {
  return `
    [${panelAttribute}] {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      box-sizing: border-box;
      width: max-content;
      max-width: 100%;
      margin: 4px 0 2px;
      font: 12px/1.5 Arial, "Microsoft YaHei", sans-serif;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}] {
      display: inline-flex;
      align-items: center;
      box-sizing: border-box;
      max-width: 100%;
      padding: 2px 7px;
      border: 1px solid #c6dafc;
      border-radius: 999px;
      background: #f1f6ff;
      color: #174ea6;
      white-space: normal;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="ccf"] {
      border-color: #f1b8b7;
      background: #fce8e6;
      color: #a50e0e;
      font-weight: 700;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="cas"] {
      border-color: #cbb7f4;
      background: #f3e8ff;
      color: #6b21a8;
      font-weight: 700;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="cas-discipline"] {
      border-color: #cbb7f4;
      background: #f3e8ff;
      color: #6b21a8;
      font-weight: 700;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="new-rising"] {
      border-color: #ffaaa8;
      background: #ffd8d6;
      color: #9f1010;
      font-weight: 700;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="indexing"] {
      border-color: #78d2c5;
      background: #c9f3eb;
      color: #075e54;
      font-weight: 700;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="publication-type"] {
      border-color: #a8c7fa;
      background: #e8f0fe;
      color: #174ea6;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="warning"] {
      border-color: #ef6c64;
      background: #fce8e6;
      color: #b3261e;
      font-weight: 700;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="note"] {
      border-color: #f7cb73;
      background: #fef7e0;
      color: #8a4b00;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="impact-factor"] {
      border-color: #a8dab5;
      background: #e6f4ea;
      color: #137333;
      font-weight: 700;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="school"] {
      border-color: #f7cb73;
      background: #fef7e0;
      color: #8a4b00;
      font-weight: 700;
    }
  `;
}

export function buildRankingTooltip(
  siteName: string,
  match: VenueMatchResult,
  sourceCandidate: string | undefined,
): string {
  if (match.status !== 'matched') {
    return sourceCandidate
      ? `${siteName}来源：${sourceCandidate}\n当前本地目录尚无精确匹配。`
      : `${siteName}页面暂未提供可识别的期刊或会议来源。`;
  }

  const venue = match.venue;
  const lines = [
    `${siteName}来源：${sourceCandidate ?? '未提供'}`,
    `匹配：${venue.canonicalName}`,
  ];
  if (venue.cas) {
    lines.push(`中科院分区：${venue.cas.rank}区${editionText(venue.cas.edition)}`);
  }
  if (venue.ccf) {
    lines.push(`CCF：${venue.ccf.rank}${editionText(venue.ccf.edition)}`);
  }
  if (venue.impactFactor) {
    lines.push(
      `影响因子：${formatNumber(venue.impactFactor.value)}（${venue.impactFactor.year}）`,
    );
  }
  if (venue.school) {
    lines.push(
      `${venue.school.catalog ?? '学校目录'}：${venue.school.rank}${editionText(venue.school.edition)}`,
    );
  }
  for (const label of venue.labels ?? []) {
    lines.push(`${formatVenueLabel(label)}${editionText(label.edition)}`);
  }
  return lines.join('\n');
}

function appendLabels(
  badges: RankingBadge[],
  labels: readonly VenueLabel[],
  kinds: readonly VenueLabel['kind'][],
): void {
  for (const kind of kinds) {
    for (const label of labels.filter((item) => item.kind === kind)) {
      badges.push({ kind, text: formatVenueLabel(label) });
    }
  }
}

function formatVenueLabel(label: VenueLabel): string {
  if (label.kind === 'new-rising') return `新锐分区 ${label.text}`;
  if (label.kind === 'cas-discipline') return `中科院 ${label.text}`;
  if (label.kind === 'warning') return `预警 ${label.text}`;
  return label.text;
}

function editionText(edition: string | undefined): string {
  return edition ? `（${edition}）` : '';
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

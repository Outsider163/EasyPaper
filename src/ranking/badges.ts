import type { VenueMatchResult } from './matcher';
import type { VenueLabel } from './types';

export type RankingBadgeKind =
  | 'source'
  | 'ccf'
  | 'cas'
  | 'cas-upgraded'
  | 'cas-discipline'
  | 'jcr-quartile'
  | 'new-rising'
  | 'indexing'
  | 'pku-core'
  | 'cssci'
  | 'cssci-extended'
  | 'cstpcd'
  | 'cscd-core'
  | 'cscd-extended'
  | 'cast-tier'
  | 'impact-factor'
  | 'school'
  | 'sjr'
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
  if (matchedVenue.ccf) {
    badges.push({ kind: 'ccf', text: `CCF-${matchedVenue.ccf.rank}` });
  }
  appendLabels(badges, supplemental, [
    'new-rising',
    'cas-upgraded',
    'cas-discipline',
    'jcr-quartile',
    'pku-core',
    'cssci',
    'cssci-extended',
    'cstpcd',
    'cscd-core',
    'cscd-extended',
    'cast-tier',
    'indexing',
  ]);

  const hasDetailedCasLabel = supplemental.some(
    (label) =>
      label.kind === 'cas-upgraded' || label.kind === 'cas-discipline',
  );
  if (matchedVenue.cas && !hasDetailedCasLabel) {
    badges.push({ kind: 'cas', text: `中科院 ${matchedVenue.cas.rank}区` });
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
  appendLabels(badges, supplemental, ['sjr', 'publication-type', 'warning', 'note']);
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

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="cas-upgraded"] {
      border-color: #ffaaa8;
      background: #ffd8d6;
      color: #9f1010;
      font-weight: 700;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="jcr-quartile"] {
      border-color: #d6b6f5;
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

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="cssci-extended"] {
      border-color: #d7a8ef;
      background: #faf2ff;
      color: #7e22a8;
      font-weight: 700;
    }


    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="pku-core"] {
      border-color: #f3a7a3;
      background: #fff0ef;
      color: #a61b1b;
      font-weight: 700;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="cssci"] {
      border-color: #d7a8ef;
      background: #f8edff;
      color: #7e22a8;
      font-weight: 700;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="cstpcd"] {
      border-color: #80c7b7;
      background: #e7f7f2;
      color: #0f6b5c;
      font-weight: 700;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="cscd-core"] {
      border-color: #75b7c7;
      background: #e7f6fa;
      color: #075f73;
      font-weight: 700;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="cscd-extended"] {
      border-color: #9cc9d3;
      background: #f0f8fa;
      color: #276675;
      font-weight: 700;
    }

    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="cast-tier"] {
      border-color: #efb36c;
      background: #fff3df;
      color: #8a4b00;
      font-weight: 700;
    }
    [${panelAttribute}] [${RANKING_BADGE_ATTRIBUTE}="sjr"] {
      border-color: #9ec5fe;
      background: #e8f0fe;
      color: #174ea6;
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
  if (label.kind === 'cas-upgraded') return `SCI升级版 ${label.text}`;
  if (label.kind === 'cas-discipline') return `中科院 ${label.text}`;
  if (label.kind === 'jcr-quartile') return `JCR ${label.text}`;
  if (label.kind === 'pku-core') {
    return formatCoreLabel('北大中文核心', label.text, ['北大核心']);
  }
  if (label.kind === 'cssci') {
    return formatCoreLabel('南大中文核心', label.text, ['南大核心', 'CSSCI']);
  }
  if (label.kind === 'cssci-extended') {
    return formatCoreLabel('CSSCI扩展版', label.text, ['CSSCI扩展']);
  }
  if (label.kind === 'cstpcd') {
    return formatCoreLabel('中国科技核心', label.text, ['科技核心', 'CSTPCD']);
  }
  if (label.kind === 'cscd-core') {
    return formatCoreLabel('CSCD核心库', label.text, ['CSCD核心']);
  }
  if (label.kind === 'cscd-extended') {
    return formatCoreLabel('CSCD扩展库', label.text, ['CSCD扩展']);
  }
  if (label.kind === 'cast-tier') return `中国科协 ${label.text}`;
  if (label.kind === 'warning') return `预警 ${label.text}`;
  return label.text;
}

function editionText(edition: string | undefined): string {
  return edition ? `（${edition}）` : '';
}

function formatCoreLabel(
  name: string,
  text: string,
  aliases: readonly string[],
): string {
  const normalized = text.normalize('NFKC').trim().toLowerCase();
  if (
    [
      '是',
      '1',
      'true',
      'yes',
      'y',
      '√',
      '收录',
      '已收录',
      name,
      ...aliases,
    ].some((value) => value.normalize('NFKC').trim().toLowerCase() === normalized)
  ) {
    return name;
  }
  return `${name} ${text}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

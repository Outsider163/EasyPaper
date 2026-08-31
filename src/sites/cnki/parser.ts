export type CnkiPaperKind = 'result' | 'detail';

export interface CnkiPaperResult {
  id: string;
  kind: CnkiPaperKind;
  title: string;
  url: string | undefined;
  authorsText: string | undefined;
  venueCandidate: string | undefined;
  publicationDateText: string | undefined;
  year: number | undefined;
  databaseText: string | undefined;
  sourceTruncated: boolean;
}

export const CNKI_RESULT_SELECTOR = [
  'table.result-table-list tbody tr',
  '.result-table-list tbody tr',
  '#gridTable tbody tr',
  '.search-result-list .result-item',
  '.result-list .result-item',
].join(', ');

const RESULT_TITLE_SELECTORS = [
  'td.name a[href]',
  'td.title a[href]',
  '.name a[href]',
  '.title a[href]',
  'a.fz14[href]',
  'a[href*="/kcms2/article/abstract"]',
  'a[href*="/KCMS/detail/detail.aspx"]',
  'a[href*="/kcms/detail/detail.aspx"]',
] as const;

const RESULT_AUTHOR_SELECTORS = [
  'td.author',
  '.author',
  '[data-field="author"]',
] as const;
const RESULT_SOURCE_SELECTORS = [
  'td.source',
  '.source',
  '[data-field="source"]',
] as const;
const RESULT_DATE_SELECTORS = [
  'td.date',
  '.date',
  '[data-field="date"]',
  'time',
] as const;
const RESULT_DATABASE_SELECTORS = [
  'td.database',
  'td.data',
  '.database',
  '.data',
  '[data-field="database"]',
] as const;

const DETAIL_TITLE_SELECTORS = [
  '.wx-tit h1',
  '.brief h1',
  'h1.title',
  '.title h1',
  '.article-title',
  'h1',
] as const;
const DETAIL_SOURCE_SELECTORS = [
  '.wx-tit .source',
  '.brief .source',
  '.source-info .source',
  '.sourinfo a',
  '.top-tip a',
] as const;
const DETAIL_AUTHOR_SELECTORS = [
  '.wx-tit .author',
  '.brief .author',
  '.author',
] as const;

const YEAR_PATTERN = /(?:19|20)\d{2}/;
const ELLIPSIS_AT_EDGE = /^(?:…|\.\.\.)|(?:…|\.\.\.)$/;
const LEADING_FIELD_LABEL = /^(?:来源|刊名|会议名称)\s*[:：]\s*/;

export function normalizeCnkiWhitespace(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\u00a0/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function findCnkiResultTitleElement(
  row: ParentNode,
): HTMLElement | undefined {
  return queryFirst(row, RESULT_TITLE_SELECTORS, (element) =>
    Boolean(normalizeCnkiWhitespace(element.textContent)),
  ) as HTMLElement | undefined;
}

export function findCnkiDetailTitleElement(
  root: ParentNode,
): HTMLElement | undefined {
  return queryFirst(root, DETAIL_TITLE_SELECTORS, (element) =>
    Boolean(normalizeCnkiWhitespace(element.textContent)),
  ) as HTMLElement | undefined;
}

export function parseCnkiResultRow(
  row: Element,
  position = 0,
): CnkiPaperResult | undefined {
  const titleElement = findCnkiResultTitleElement(row);
  if (!titleElement) {
    return undefined;
  }

  const title = normalizeCnkiWhitespace(titleElement.textContent);
  if (!title) {
    return undefined;
  }

  const url = normalizeOptional(titleElement.getAttribute('href'));
  const authorsText = elementText(row, RESULT_AUTHOR_SELECTORS);
  const venueCandidate = cleanSource(elementText(row, RESULT_SOURCE_SELECTORS));
  const publicationDateText = elementText(row, RESULT_DATE_SELECTORS);
  const databaseText = elementText(row, RESULT_DATABASE_SELECTORS);
  const year = parseYear(publicationDateText);
  const id =
    normalizeOptional(row.getAttribute('data-key')) ??
    normalizeOptional(row.getAttribute('data-id')) ??
    normalizeOptional(row.id) ??
    url ??
    `cnki-result-${position}`;

  return {
    id,
    kind: 'result',
    title,
    url,
    authorsText,
    venueCandidate,
    publicationDateText,
    year,
    databaseText,
    sourceTruncated: venueCandidate
      ? ELLIPSIS_AT_EDGE.test(venueCandidate)
      : false,
  };
}

export function parseCnkiResults(root: ParentNode): CnkiPaperResult[] {
  return Array.from(root.querySelectorAll(CNKI_RESULT_SELECTOR))
    .map((row, index) => parseCnkiResultRow(row, index))
    .filter((result): result is CnkiPaperResult => result !== undefined);
}

export function parseCnkiDetail(
  root: ParentNode,
): CnkiPaperResult | undefined {
  const titleElement = findCnkiDetailTitleElement(root);
  const title =
    metaContent(root, 'citation_title') ??
    normalizeOptional(titleElement?.textContent);
  if (!title || !titleElement) {
    return undefined;
  }

  const venueCandidate = cleanSource(
    metaContent(root, 'citation_journal_title') ??
      metaContent(root, 'citation_conference_title') ??
      elementText(root, DETAIL_SOURCE_SELECTORS),
  );
  const publicationDateText =
    metaContent(root, 'citation_publication_date') ??
    metaContent(root, 'citation_date');
  const authors = Array.from(
    root.querySelectorAll<HTMLMetaElement>('meta[name="citation_author"]'),
  )
    .map((meta) => normalizeCnkiWhitespace(meta.getAttribute('content')))
    .filter(Boolean);
  const authorsText =
    authors.length > 0
      ? authors.join(', ')
      : elementText(root, DETAIL_AUTHOR_SELECTORS);
  const url =
    metaContent(root, 'citation_public_url') ??
    metaContent(root, 'citation_abstract_html_url');
  const id =
    metaContent(root, 'citation_doi') ??
    url ??
    `cnki-detail:${title}`;

  return {
    id,
    kind: 'detail',
    title,
    url,
    authorsText,
    venueCandidate,
    publicationDateText,
    year: parseYear(publicationDateText),
    databaseText: undefined,
    sourceTruncated: venueCandidate
      ? ELLIPSIS_AT_EDGE.test(venueCandidate)
      : false,
  };
}

function elementText(
  root: ParentNode,
  selectors: readonly string[],
): string | undefined {
  return normalizeOptional(queryFirst(root, selectors)?.textContent);
}

function queryFirst(
  root: ParentNode,
  selectors: readonly string[],
  predicate: (element: Element) => boolean = () => true,
): Element | undefined {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    if (element && predicate(element)) {
      return element;
    }
  }
  return undefined;
}

function metaContent(root: ParentNode, name: string): string | undefined {
  return normalizeOptional(
    root
      .querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
      ?.getAttribute('content'),
  );
}

function cleanSource(value: string | undefined): string | undefined {
  return normalizeOptional(value?.replace(LEADING_FIELD_LABEL, ''));
}

function parseYear(value: string | undefined): number | undefined {
  const match = value?.match(YEAR_PATTERN);
  return match ? Number(match[0]) : undefined;
}

function normalizeOptional(value: string | null | undefined): string | undefined {
  const normalized = normalizeCnkiWhitespace(value);
  return normalized || undefined;
}

import { normalizeScholarWhitespace, parseGoogleScholarMetadata } from '../google-scholar/parser';

export const SCHOLAR_PRO_RESULT_SELECTOR =
  '.search-results > .card > .card-body > .card-main-content';

export interface ScholarProPaper {
  titleElement: HTMLElement;
  title: string;
  venueCandidate: string;
  sourceTruncated: boolean;
}

/** This site's Bootstrap cards are not standard Scholar cards. Scope the
 * adapter to its host so ordinary cards on other authorized sites stay alone. */
export function parseScholarProPapers(root: ParentNode): ScholarProPaper[] {
  const document = (root as Node).nodeType === 9
    ? root as Document : (root as Node).ownerDocument;
  if (!isScholarProUrl(document?.URL)) return [];

  const papers: ScholarProPaper[] = [];
  for (const card of Array.from(root.querySelectorAll(SCHOLAR_PRO_RESULT_SELECTOR)).slice(0, 500)) {
    const titleElement = card.querySelector<HTMLElement>('.card-title');
    if (!titleElement) continue;
    const titleLink = titleElement.querySelector('a[href]');
    const titleCopy = titleElement.cloneNode(true) as HTMLElement;
    titleCopy.querySelectorAll('.translate-btn, .translation-result').forEach((element) => element.remove());
    const title = normalizeScholarWhitespace(titleLink?.textContent ?? titleCopy.textContent)
      .replace(/^(?:\s*\[[^\]\r\n]{1,32}\]\s*)+/u, '').trim();
    const metadata = parseGoogleScholarMetadata(card.querySelector('.card-meta')?.textContent);
    // Books without a publication field, bare years and publisher domains are
    // not journal names. No inference from title, abstract or third-party badges.
    if (!title || !metadata.venueCandidate || metadata.year === undefined) continue;
    papers.push({
      titleElement, title, venueCandidate: metadata.venueCandidate,
      sourceTruncated: /…|\.\.\./u.test(metadata.venueCandidate),
    });
  }
  return papers;
}

export function isScholarProUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) &&
      ['www.googlescholar.pro', 'googlescholar.pro'].includes(url.hostname);
  } catch { return false; }
}

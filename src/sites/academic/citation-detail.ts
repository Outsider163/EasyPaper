import { normalizeCnkiWhitespace } from '../cnki/parser';
import type { AcademicPaper } from './types';

const CITATION_SELECTOR = 'meta[name="citation_title"], meta[name="citation_journal_title"], meta[name="citation_conference_title"]';

export function hasCitationMetadata(root: ParentNode): boolean {
  return root.querySelector(CITATION_SELECTOR) !== null;
}

export function parseCitationDetail(root: ParentNode, normalizeTitle: (title: string) => string = (title) => title): AcademicPaper | undefined {
  const titles = metaValues(root, 'citation_title');
  const venues = [...new Set([
    ...metaValues(root, 'citation_journal_title'), ...metaValues(root, 'citation_conference_title'),
  ])];
  if (titles.length !== 1 || venues.length !== 1) return undefined;
  const title = normalizeTitle(titles[0]!);
  // Prioritize the actual article heading over logos, share dialogs and sticky
  // duplicate headings. Then allow h2-h4, which JMLR and ACL use for paper titles.
  const selectors = ['#papertitle', '#artTitle', '#title', '.heading-title', '.c-article-title', '.paper-title',
    '.article-title', '[itemprop="headline"]', 'h1, h2, h3, h4'];
  let titleElement: HTMLElement | undefined;
  for (const selector of selectors) {
    titleElement = Array.from(root.querySelectorAll<HTMLElement>(selector)).slice(0, 200)
      .find((element) => !isHiddenOrNavigation(element) && normalizeTitle(normalizeCnkiWhitespace(element.textContent)) === title);
    if (titleElement) break;
  }
  if (!titleElement) return undefined;
  return {
    titleElement, title, venueCandidate: venues[0]!,
    sourceTruncated: /…|\.\.\./u.test(venues[0]!), adapter: '论文元数据',
  };
}

function isHiddenOrNavigation(element: HTMLElement): boolean {
  if (element.closest('[hidden], [aria-hidden="true"], .sr-only, .usa-sr-only, .float-title-inner, nav, template')) return true;
  let current: Element | null = element;
  while (current) {
    if (/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/iu.test(current.getAttribute('style') ?? '')) return true;
    current = current.parentElement;
  }
  return false;
}

function metaValues(root: ParentNode, name: string): string[] {
  return [...new Set(Array.from(root.querySelectorAll(`meta[name="${name}"]`))
    .map((element) => normalizeCnkiWhitespace(element.getAttribute('content'))).filter(Boolean))];
}

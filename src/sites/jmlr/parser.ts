import { normalizeCnkiWhitespace } from '../cnki/parser';
import { pageUrl, type AcademicPaper } from '../academic/types';

export function parseJmlrVolume(root: ParentNode): AcademicPaper[] {
  const url = pageUrl(root);
  if (!url || !['jmlr.org', 'www.jmlr.org'].includes(url.hostname)) return [];
  const volume = url.pathname.match(/^\/papers\/v(\d+)\/?$/u)?.[1];
  if (!volume) return [];
  const heading = normalizeCnkiWhitespace(root.querySelector('#content h1')?.textContent);
  if (heading !== `JMLR Volume ${volume}`) return [];
  const papers: AcademicPaper[] = [];
  for (const entry of Array.from(root.querySelectorAll('#content dl')).slice(0, 500)) {
    const titleElement = entry.querySelector<HTMLElement>('dt');
    const title = normalizeCnkiWhitespace(titleElement?.textContent);
    const hasArticleLink = Array.from(entry.querySelectorAll('dd a[href]')).some((link) => {
      try {
        const target = new URL(link.getAttribute('href')!, url);
        return ['jmlr.org', 'www.jmlr.org'].includes(target.hostname) &&
          new RegExp(`^/papers/v${volume}/[a-zA-Z0-9_-]+\\.html$`, 'u').test(target.pathname);
      } catch { return false; }
    });
    if (!titleElement || !title || !hasArticleLink) continue;
    papers.push({ titleElement, title, venueCandidate: 'Journal of Machine Learning Research',
      sourceTruncated: false, adapter: 'JMLR', sourceEvidence: heading });
  }
  return papers;
}

import { normalizeCnkiWhitespace } from '../cnki/parser';
import type { AcademicPaper } from '../academic/types';

// Official proceedings can contain several thousand papers on one page.
export const MAX_PROCEEDINGS_PAPERS = 5000;
export const textOf = (element: Element | null): string => normalizeCnkiWhitespace(element?.textContent);
export function linkUrl(element: Element | null, base: URL): URL | undefined {
  const href = element?.getAttribute('href');
  if (!href) return undefined;
  try { const url = new URL(href, base); return /^https?:$/u.test(url.protocol) ? url : undefined; }
  catch { return undefined; }
}
export function paper(titleElement: HTMLElement, venue: string, adapter: AcademicPaper['adapter'], evidence = venue): AcademicPaper {
  return { titleElement, title: textOf(titleElement), venueCandidate: venue,
    sourceTruncated: /…|\.\.\./u.test(evidence), adapter, sourceEvidence: evidence };
}

/** Only complete, known proceedings titles are normalized. Workshop suffixes,
 * Findings, tutorials, and unknown tracks never pass these anchored rules. */
export function pmlrVenue(source: string): string {
  const title = source.replace(/^Proceedings of (?:the )?/iu, '').replace(/^\d+(?:st|nd|rd|th) /iu, '');
  const venues: Record<string, string> = {
    'international conference on machine learning': 'International Conference on Machine Learning',
    'international conference on artificial intelligence and statistics': 'International Conference on Artificial Intelligence and Statistics',
    'conference on learning theory': 'Annual Conference on Computational Learning Theory',
    'conference on uncertainty in artificial intelligence': 'Conference on Uncertainty in Artificial Intelligence',
    'uncertainty in artificial intelligence': 'Conference on Uncertainty in Artificial Intelligence',
    'international conference on algorithmic learning theory': 'International Conference on Algorithmic Learning Theory',
    'algorithmic learning theory': 'International Conference on Algorithmic Learning Theory',
  };
  return venues[title.toLowerCase()] ?? source;
}

export const CVF_VENUES: Record<string, string> = {
  CVPR: 'IEEE/CVF Computer Vision and Pattern Recognition Conference',
  ICCV: 'International Conference on Computer Vision',
  WACV: 'IEEE/CVF Winter Conference on Applications of Computer Vision',
  ACCV: 'Asian Conference on Computer Vision',
};
export const USENIX_VENUES: Record<string, string> = {
  osdi: 'USENIX Symposium on Operating Systems Design and Implementation',
  fast: 'USENIX Conference on File and Storage Technologies',
  usenixsecurity: 'USENIX Security Symposium',
  atc: 'USENIX Annual Technical Conference',
  nsdi: 'USENIX Symposium on Networked Systems Design and Implementation',
};
export const NEURIPS_VENUE = 'Conference on Neural Information Processing Systems';
export const NEURIPS_HOSTS = ['proceedings.neurips.cc', 'papers.nips.cc', 'papers.neurips.cc'];
export const USENIX_HOSTS = ['www.usenix.org', 'usenix.org'];

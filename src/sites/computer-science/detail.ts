import { parseCitationDetail } from '../academic/citation-detail';
import { pageUrl, type AcademicPaper } from '../academic/types';
import { CVF_VENUES, NEURIPS_HOSTS, NEURIPS_VENUE, pmlrVenue, USENIX_HOSTS, USENIX_VENUES } from './shared';

export function parseCsCitationDetail(root: ParentNode): AcademicPaper | undefined {
  const url = pageUrl(root);
  const usenix = url && USENIX_HOSTS.includes(url.hostname);
  // USENIX embeds BibTeX case-preserving braces in citation_title.
  const result = parseCitationDetail(root, usenix ? (title) => title.replace(/[{}]/gu, '') : undefined);
  if (!result || !url) return result;
  const source = result.venueCandidate;
  if (url.hostname === 'proceedings.mlr.press' && /^\/v\d+\/[^/]+\.html$/u.test(url.pathname)) {
    return { ...result, adapter: 'PMLR', venueCandidate: pmlrVenue(source), sourceEvidence: source };
  }
  if (url.hostname === 'openaccess.thecvf.com') {
    const event = /^\/content(?:\/|_)(CVPR|ICCV|WACV|ACCV)\d{4}\/html\/[^/]+_paper\.html$/u.exec(url.pathname);
    if (!event) return undefined; // Do not treat a CVPRW workshop as CVPR.
    const expected: Record<string, RegExp> = {
      CVPR: /^(?:Proceedings of the )?IEEE(?:\/CVF)? Conference on Computer Vision and Pattern Recognition$/u,
      ICCV: /^(?:Proceedings of the )?(?:IEEE(?:\/CVF)? )?International Conference on Computer Vision$/u,
      WACV: /^(?:Proceedings of the )?IEEE(?:\/CVF)? Winter Conference on Applications of Computer Vision$/u,
      ACCV: /^(?:Proceedings of the )?Asian Conference on Computer Vision$/u,
    };
    if (!expected[event[1]!]!.test(source)) return undefined;
    return { ...result, adapter: 'CVF Open Access', venueCandidate: CVF_VENUES[event[1]!]!, sourceEvidence: source };
  }
  if (NEURIPS_HOSTS.includes(url.hostname)) {
    if (!/^\/(?:paper_files\/)?paper\/\d{4}\/hash\/[a-f0-9]{32}-Abstract(?:-Conference)?\.html$/u.test(url.pathname) ||
      source !== 'Advances in Neural Information Processing Systems') return undefined;
    return { ...result, adapter: 'NeurIPS Proceedings', venueCandidate: NEURIPS_VENUE, sourceEvidence: source };
  }
  if (usenix) {
    const event = /^\/conference\/(osdi|fast|usenixsecurity|atc|nsdi)(\d{2})\/presentation\/[^/]+\/?$/u.exec(url.pathname);
    if (!event || /keynote|invited|panel|tutorial/iu.test(url.pathname)) return undefined;
    const fullName = USENIX_VENUES[event[1]!]!;
    const acronym = event[1] === 'usenixsecurity' ? 'USENIX Security' : event[1]!.toUpperCase();
    const plainSource = source.replace(/^\d+(?:st|nd|rd|th) /u, '');
    if (plainSource !== `${fullName} (${acronym} ${event[2]})`) return undefined;
    return { ...result, adapter: 'USENIX', venueCandidate: fullName, sourceEvidence: source };
  }
  return result;
}

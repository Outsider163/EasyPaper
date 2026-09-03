import { pageUrl, type AcademicPaper } from '../academic/types';

/** An ACL-hosted workshop/Findings/demo is not automatically a CCF ACL paper.
 * Normalize only verified main-conference long/short volumes, checking BOTH
 * the article path and the full proceedings metadata. Other sources stay exact. */
export function normalizeAclVenue(root: ParentNode, paper: AcademicPaper): AcademicPaper {
  const url = pageUrl(root);
  if (!url || url.hostname !== 'aclanthology.org') return paper;
  const mainArticle = /^\/\d{4}\.acl-(long|short)\.\d+\/$/u.exec(url.pathname);
  const mainProceedings = /^Proceedings of the \d+(?:st|nd|rd|th) Annual Meeting of the Association for Computational Linguistics \(Volume ([12]): (Long|Short) Papers\)$/u.exec(paper.venueCandidate);
  const result: AcademicPaper = { ...paper, adapter: 'ACL Anthology' };
  if (!mainArticle || !mainProceedings || paper.sourceTruncated) return result;
  const matchingTrack = (mainArticle[1] === 'long' && mainProceedings[1] === '1' && mainProceedings[2] === 'Long') ||
    (mainArticle[1] === 'short' && mainProceedings[1] === '2' && mainProceedings[2] === 'Short');
  if (!matchingTrack) return result;
  return { ...result, venueCandidate: 'Annual Meeting of the Association for Computational Linguistics',
    sourceEvidence: paper.venueCandidate };
}

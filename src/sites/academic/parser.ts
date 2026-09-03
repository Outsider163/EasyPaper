import {
  CNKI_RESULT_SELECTOR, findCnkiDetailTitleElement, findCnkiResultTitleElement,
  parseCnkiDetail, parseCnkiResultRow,
} from '../cnki/parser';
import { GOOGLE_SCHOLAR_RESULT_SELECTOR, parseGoogleScholarResult } from '../google-scholar/parser';
import { parseScholarProPapers } from '../scholar-pro/parser';

import { parsePubmedResults } from '../pubmed/parser';
import { parseJmlrVolume } from '../jmlr/parser';
import { normalizeAclVenue } from '../acl-anthology/venue';
import { hasCitationMetadata } from './citation-detail';
import { parseCsProceedings } from '../computer-science/proceedings';
import { parseDblp } from '../computer-science/dblp';
import { parseCsCitationDetail } from '../computer-science/detail';
import type { AcademicPaper } from './types';
export type { AcademicPaper } from './types';

/** Recognize paper structures, never scan all page text for journal names. */
export function parseAcademicPapers(root: ParentNode): AcademicPaper[] {
  const papers: AcademicPaper[] = [];
  const seen = new Set<HTMLElement>();
  for (const row of Array.from(root.querySelectorAll(CNKI_RESULT_SELECTOR)).slice(0, 500)) {
    const result = parseCnkiResultRow(row);
    const titleElement = findCnkiResultTitleElement(row);
    if (result?.venueCandidate && titleElement && !seen.has(titleElement)) {
      papers.push({ ...result, venueCandidate: result.venueCandidate, titleElement, adapter: '知网兼容页面' });
      seen.add(titleElement);
    }
  }
  for (const card of Array.from(root.querySelectorAll(GOOGLE_SCHOLAR_RESULT_SELECTOR)).slice(0, 500)) {
    const result = parseGoogleScholarResult(card);
    const titleElement = card.querySelector<HTMLElement>('.gs_rt');
    if (result?.venueCandidate && titleElement && !seen.has(titleElement)) {
      papers.push({ ...result, venueCandidate: result.venueCandidate, titleElement, adapter: 'Scholar 兼容页面' });
      seen.add(titleElement);
    }
  }
  for (const paper of parseScholarProPapers(root)) {
    if (seen.has(paper.titleElement)) continue;
    papers.push({ ...paper, adapter: 'GoogleScholar.pro' });
    seen.add(paper.titleElement);
  }
  for (const paper of [...parsePubmedResults(root), ...parseJmlrVolume(root), ...parseCsProceedings(root), ...parseDblp(root)]) {
    if (seen.has(paper.titleElement)) continue;
    papers.push(paper);
    seen.add(paper.titleElement);
  }
  if (papers.length) return papers;

  if (hasCitationMetadata(root)) {
    const paper = parseCsCitationDetail(root);
    return paper ? [normalizeAclVenue(root, paper)] : [];
  }

  const titleElement = findCnkiDetailTitleElement(root);
  if (!titleElement) return [];
  // A bare h1 and a database navigation link are not a paper detail page.
  if (!titleElement.closest('.wx-tit, .brief')) return [];
  const detail = parseCnkiDetail(root);
  return detail?.venueCandidate ? [{
    ...detail, venueCandidate: detail.venueCandidate, titleElement, adapter: '知网兼容页面',
  }] : [];
}

import { normalizeCnkiWhitespace } from '../cnki/parser';
import { pageUrl, type AcademicPaper } from '../academic/types';

export function parsePubmedResults(root: ParentNode): AcademicPaper[] {
  if (pageUrl(root)?.hostname !== 'pubmed.ncbi.nlm.nih.gov') return [];
  const papers: AcademicPaper[] = [];
  for (const card of Array.from(root.querySelectorAll('article.full-docsum .docsum-content')).slice(0, 500)) {
    const titleElement = card.querySelector<HTMLElement>('a.docsum-title[href]');
    if (!titleElement || !/^\/\d+\/$/u.test(titleElement.getAttribute('href') ?? '')) continue;
    const title = normalizeCnkiWhitespace(titleElement.textContent);
    const full = normalizeCnkiWhitespace(card.querySelector('.full-journal-citation')?.textContent);
    const short = normalizeCnkiWhitespace(card.querySelector('.short-journal-citation')?.textContent);
    const venueCandidate = parsePubmedJournalCitation(full || short);
    if (!title || !venueCandidate) continue;
    papers.push({ titleElement, title, venueCandidate, adapter: 'PubMed',
      sourceTruncated: /…|\.\.\./u.test(venueCandidate), sourceEvidence: full || short });
  }
  return papers;
}

/** PubMed separates the abbreviated journal from its date with a period.
 * Keep that abbreviation; only catalog aliases can expand it, never a guess. */
export function parsePubmedJournalCitation(value: string): string | undefined {
  const text = normalizeCnkiWhitespace(value);
  if (/^In\s*:/iu.test(text)) return undefined;
  const match = text.match(/^(.{1,200}?)\.\s+(?:19|20)\d{2}(?=\s|[.;:]|$)/u);
  return match ? normalizeCnkiWhitespace(match[1]) || undefined : undefined;
}

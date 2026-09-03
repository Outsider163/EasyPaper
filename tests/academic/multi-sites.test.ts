import { parseHTML } from 'linkedom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseAcademicPapers } from '../../src/sites/academic/parser';
import { ACADEMIC_PANEL_ATTRIBUTE, decorateAcademicPapers } from '../../src/sites/academic/decorator';
import { parsePubmedJournalCitation } from '../../src/sites/pubmed/parser';
import { watchAcademicPage } from '../../src/sites/academic/observer';
import { resetUserVenueCatalog, setUserVenueCatalog } from '../../src/ranking/registry';
import { parseVenueCatalog } from '../../src/ranking/catalog-import';

function doc(body: string, head = '', url = 'https://publisher.example/paper'): Document {
  const document = parseHTML(`<html><head>${head}</head><body>${body}</body></html>`).document as unknown as Document;
  Object.defineProperty(document, 'URL', { value: url });
  return document;
}
function metadata(venue = 'Journal of Machine Learning Research', title = 'A Test Paper'): string {
  return `<meta name="citation_title" content="${title}"><meta name="citation_journal_title" content="${venue}">`;
}
const panel = (document: Document) => document.querySelector(`[${ACADEMIC_PANEL_ATTRIBUTE}]`);
afterEach(() => { resetUserVenueCatalog(); vi.useRealTimers(); });

describe('publisher detail title selection', () => {
  it.each(['h1', 'h2', 'h3', 'h4'])('recognizes exact citation titles rendered as %s', (tag) => {
    const document = doc(`<${tag}>A Test Paper</${tag}>`, metadata());
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(panel(document)?.textContent).toContain('CCF-A 类推荐');
  });
  it('skips a publisher logo and prefers the PLOS article title over a floating duplicate', () => {
    const document = doc('<nav><h1>PLOS One</h1></nav><div class="float-title-inner"><h1>A Test Paper</h1></div><h1 id="artTitle">A Test Paper</h1>', metadata('PLOS ONE'), 'https://journals.plos.org/plosone/article?id=test');
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(panel(document)?.previousElementSibling?.id).toBe('artTitle');
  });
  it.each(['hidden', 'aria-hidden="true"', 'style="display: none"', 'style="visibility: hidden !important"', 'class="sr-only"'])('does not select hidden titles: %s', (attribute) => {
    const document = doc(`<div ${attribute}><h2>A Test Paper</h2></div><h2>Different visible paper</h2>`, metadata());
    expect(decorateAcademicPapers(document)).toBe(0);
  });
  it('does not accept conflicting or stale metadata by falling back to a looser parser', () => {
    const document = doc('<div class="wx-tit"><h1>A Test Paper</h1><div class="source">Nature</div></div>', metadata() + '<meta name="citation_conference_title" content="Another Conference">');
    expect(parseAcademicPapers(document)).toHaveLength(0);
    document.querySelector('meta[name="citation_conference_title"]')!.remove();
    document.querySelector('h1')!.textContent = 'A New Paper';
    expect(parseAcademicPapers(document)).toHaveLength(0);
  });
  it('handles markup and whitespace but does not match a title by substring', () => {
    const document = doc('<h2>A <em>Test</em>\n Paper</h2>', metadata());
    expect(parseAcademicPapers(document)).toHaveLength(1);
    document.querySelector('h2')!.textContent = 'A Test Paper: A Correction';
    expect(parseAcademicPapers(document)).toHaveLength(0);
  });
  it('ignores challenge pages without a publication source', () => {
    expect(parseAcademicPapers(doc('<h1>Client Challenge</h1><p>Checking browser</p>'))).toHaveLength(0);
    expect(parseAcademicPapers(doc('<h1>Cookies must be enabled</h1>'))).toHaveLength(0);
  });
  it('responds to hidden-heading and metadata changes without retaining old badges', async () => {
    vi.useFakeTimers();
    const document = doc('<h2 hidden>A Test Paper</h2>', metadata());
    const render = vi.fn(() => decorateAcademicPapers(document));
    const stop = watchAcademicPage(document, render);
    expect(panel(document)).toBeNull();
    document.querySelector('h2')!.removeAttribute('hidden');
    await Promise.resolve(); await vi.advanceTimersByTimeAsync(160);
    expect(panel(document)?.textContent).toContain('CCF-A');
    document.querySelector('meta[name="citation_journal_title"]')!.setAttribute('content', 'Unknown Test Journal');
    await Promise.resolve(); await vi.advanceTimersByTimeAsync(160);
    expect(panel(document)?.textContent).not.toContain('CCF-A');
    expect(panel(document)?.textContent).toContain('Unknown Test Journal');
    stop();
  });
});

const pubmedBody = `<article class="full-docsum"><div class="docsum-content">
  <a class="docsum-title" href="/12345678/">A <b>Medical</b> Paper</a>
  <div class="docsum-citation"><span class="full-authors">A Author</span>
    <span class="docsum-journal-citation full-journal-citation">Nature. 2025 Jan;42(1):12-19. doi: 10.example/test.</span>
    <span class="docsum-journal-citation short-journal-citation">Nature. 2025.</span>
  </div><div class="docsum-snippet">Abstract mentioning Science and NeurIPS.</div>
</div></article>`;
describe('PubMed search results', () => {
  it.each([
    ['J Intern Med. 2018 Dec;284(6):603-619. doi: 10.example/test.', 'J Intern Med'],
    ['Science. 2025.', 'Science'], ['J. Med. Sci. 2025;3:1.', 'J. Med. Sci'],
    ['Nature meth…. 2025.', 'Nature meth…'],
  ])('extracts only the journal from %s', (citation, venue) => {
    expect(parsePubmedJournalCitation(citation)).toBe(venue);
  });
  it.each(['2025. PMID: 1', 'doi: 10.1234/science.2025', 'In: A Book. 2025.', 'A citation without a year', 'Nature. 20255.'])('rejects non-journal/date formats: %s', (text) => {
    expect(parsePubmedJournalCitation(text)).toBeUndefined();
  });
  it('places one panel below the actual result title', () => {
    const document = doc(pubmedBody, '', 'https://pubmed.ncbi.nlm.nih.gov/?term=test');
    expect(parseAcademicPapers(document)[0]).toEqual(expect.objectContaining({ title: 'A Medical Paper', venueCandidate: 'Nature', adapter: 'PubMed' }));
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(panel(document)?.previousElementSibling?.className).toBe('docsum-title');
    expect(panel(document)?.getAttribute('title')).toContain('Nature. 2025 Jan');
  });
  it('does not guess the full name from an abbreviation, but honors explicit catalog aliases', () => {
    const document = doc(pubmedBody.replaceAll('Nature.', 'J Test Med.'), '', 'https://pubmed.ncbi.nlm.nih.gov/');
    decorateAcademicPapers(document);
    expect(panel(document)?.textContent).toBe('EasyPaper · 来源：J Test Med');
    const data = parseVenueCatalog('期刊名称,别名,中科院分区\nJournal of Test Medicine,J Test Med,2区', 'test.csv');
    setUserVenueCatalog(data.records);
    decorateAcademicPapers(document);
    expect(panel(document)?.textContent).toContain('中科院 2区');
  });
  it('ignores lookalike DOM on another site and handles missing/full-truncated citations', () => {
    expect(parseAcademicPapers(doc(pubmedBody))).toHaveLength(0);
    const document = doc(pubmedBody, '', 'https://pubmed.ncbi.nlm.nih.gov/');
    document.querySelector('.full-journal-citation')!.textContent = 'Nature…. 2025.';
    decorateAcademicPapers(document);
    expect(panel(document)?.textContent).toContain('文字不完整');
    document.querySelector('.full-journal-citation')!.remove();
    expect(parseAcademicPapers(document)[0]?.venueCandidate).toBe('Nature');
  });
});

const jmlrBody = `<div id="content"><h1>JMLR Volume 12</h1>
<dl><dt>A Test Paper</dt><dd>A Author; 2011. [<a href="/papers/v12/test11.html">abs</a>][<a href="/papers/volume12/test.pdf">pdf</a>]</dd></dl>
<dl><dt>Navigation</dt><dd><a href="/about.html">About</a></dd></dl></div>`;
describe('JMLR official journal volume pages', () => {
  it('labels real volume entries as JMLR and preserves valid definition-list markup', () => {
    const document = doc(jmlrBody, '', 'https://www.jmlr.org/papers/v12/');
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(panel(document)?.tagName).toBe('DD');
    expect(panel(document)?.previousElementSibling?.tagName).toBe('DT');
    expect(panel(document)?.textContent).toContain('CCF-A 类推荐');
    expect(panel(document)?.getAttribute('title')).toContain('JMLR Volume 12');
  });
  it.each(['https://jmlr.org/workshop/', 'https://jmlr.org/papers/v13/', 'https://jmlr.org.example.test/papers/v12/'])('does not infer journal membership for %s', (url) => {
    expect(parseAcademicPapers(doc(jmlrBody, '', url))).toHaveLength(0);
  });
  it('requires a same-journal and same-volume paper link', () => {
    for (const href of ['https://another.test/papers/v12/test11.html', '/papers/v13/test11.html']) {
      const document = doc(jmlrBody.replace('/papers/v12/test11.html', href), '', 'https://jmlr.org/papers/v12/');
      expect(parseAcademicPapers(document)).toHaveLength(0);
    }
  });
});

const aclVenue = 'Proceedings of the 61st Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)';
describe('ACL Anthology conference boundaries', () => {
  it('normalizes the verified main long-paper volume and preserves the original source', () => {
    const document = doc('<h2 id="title"><a href="test.pdf">A Test Paper</a></h2>', metadata(aclVenue), 'https://aclanthology.org/2023.acl-long.10/');
    const paper = parseAcademicPapers(document)[0]!;
    expect(paper.venueCandidate).toBe('Annual Meeting of the Association for Computational Linguistics');
    expect(paper.sourceEvidence).toBe(aclVenue);
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(panel(document)?.textContent).toContain('CCF-A 类推荐');
    expect(panel(document)?.getAttribute('title')).toContain(aclVenue);
  });
  it('recognizes the matching short-paper volume', () => {
    const document = doc('<h2>A Test Paper</h2>', metadata(aclVenue.replace('1: Long', '2: Short')), 'https://aclanthology.org/2023.acl-short.1/');
    decorateAcademicPapers(document);
    expect(panel(document)?.textContent).toContain('CCF-A 类推荐');
  });
  it.each([
    ['2023.findings-acl.1', 'Findings of the Association for Computational Linguistics: ACL 2023'],
    ['2023.workshop-1.1', 'Proceedings of a Workshop at ACL 2023'],
    ['2023.acl-demo.1', 'Proceedings of the 61st Annual Meeting of the Association for Computational Linguistics: System Demonstrations'],
    ['2023.findings-acl.1', aclVenue], ['2023.acl-short.1', aclVenue],
    ['2023.acl-long.1', 'Proceedings of the 61st Annual Meeting of the Association for Computational Linguistics (Volume 3: Student Research Workshop)'],
  ])('does not assign main-conference CCF for %s', (path, venue) => {
    const document = doc('<h2>A Test Paper</h2>', metadata(venue), `https://aclanthology.org/${path}/`);
    decorateAcademicPapers(document);
    expect(panel(document)?.textContent).toContain('EasyPaper · 来源：');
    expect(panel(document)?.textContent).not.toContain('CCF-A');
  });
  it('does not apply ACL-specific normalization to an unrelated host', () => {
    const document = doc('<h2>A Test Paper</h2>', metadata(aclVenue), 'https://another.test/2023.acl-long.1/');
    expect(parseAcademicPapers(document)[0]?.venueCandidate).toBe(aclVenue);
  });
});

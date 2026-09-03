import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { parseAcademicPapers } from '../../src/sites/academic/parser';
import { ACADEMIC_PANEL_ATTRIBUTE, decorateAcademicPapers } from '../../src/sites/academic/decorator';
import { pmlrVenue } from '../../src/sites/computer-science/shared';

// Reduced, synthetic fixtures matching the observed public HTML structures.
function doc(body: string, url: string, head = ''): Document {
  const document = parseHTML(`<html><head>${head}</head><body>${body}</body></html>`).document as unknown as Document;
  Object.defineProperty(document, 'URL', { value: url });
  return document;
}
const meta = (venue: string, title = 'Test Paper') => `<meta name="citation_title" content="${title}"><meta name="citation_conference_title" content="${venue}">`;
const panels = (document: Document) => document.querySelectorAll(`[${ACADEMIC_PANEL_ATTRIBUTE}]`);
const pmlr = (source = 'Proceedings of the 34th International Conference on Machine Learning', path = '/v70/test17.html') => `<div class="paper"><p class="title">Test Paper</p><p class="details"><span class="info"><i>${source}</i>, PMLR 70:1-10</span></p><p class="links"><a href="${path}">abs</a></p></div>`;

describe('PMLR proceedings', () => {
  it('recognizes every paper beyond the old 500-result bound without duplicate panels', () => {
    const document = doc(pmlr().repeat(510), 'https://proceedings.mlr.press/v70/');
    expect(decorateAcademicPapers(document)).toBe(510);
    expect(decorateAcademicPapers(document)).toBe(510);
    expect(panels(document)).toHaveLength(510);
    expect(panels(document)[0]?.textContent).toContain('CCF-A');
  });
  it.each([
    ['Proceedings of The 27th International Conference on Artificial Intelligence and Statistics', 'International Conference on Artificial Intelligence and Statistics'],
    ['Proceedings of the 36th Conference on Learning Theory', 'Annual Conference on Computational Learning Theory'],
    ['Proceedings of the 39th Conference on Uncertainty in Artificial Intelligence', 'Conference on Uncertainty in Artificial Intelligence'],
    ['Proceedings of Algorithmic Learning Theory', 'International Conference on Algorithmic Learning Theory'],
  ])('normalizes a complete conference source: %s', (source, expected) => {
    expect(pmlrVenue(source)).toBe(expected);
  });
  it.each(['Proceedings of the 34th International Conference on Machine Learning Workshops', 'Proceedings of Machine Learning Research', 'ICML workshop', 'International Conference on Machine Learning…'])('does not infer main conference for %s', (source) => {
    expect(pmlrVenue(source)).toBe(source);
    const document = doc(pmlr(source), 'https://proceedings.mlr.press/v70/');
    decorateAcademicPapers(document);
    expect(panels(document)[0]?.textContent).not.toContain('CCF-A');
  });
  it.each(['/v71/test.html','https://elsewhere.test/v70/test.html','javascript:alert(1)'])('rejects a wrong volume or foreign paper link %s', (path) => {
    expect(parseAcademicPapers(doc(pmlr(undefined,path),'https://proceedings.mlr.press/v70/'))).toHaveLength(0);
  });
  it('does not apply the list rule on another host or the publisher homepage', () => {
    expect(parseAcademicPapers(doc(pmlr(),'https://proceedings.mlr.press/'))).toHaveLength(0);
    expect(parseAcademicPapers(doc(pmlr(),'https://elsewhere.test/v70/'))).toHaveLength(0);
  });
});

const cvf = (path = '/content/CVPR2025/html/Test_CVPR_2025_paper.html') => `<dl><dt class="ptitle"><br><a href="${path}">Test Paper</a></dt><dd>Test Author</dd></dl>`;
describe('CVF Open Access', () => {
  it.each(['CVPR', 'ICCV', 'WACV', 'ACCV'])('recognizes the main %s collection', (event) => {
    const document = doc(cvf().replaceAll('CVPR',event), `https://openaccess.thecvf.com/${event}2025?day=all`);
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(panels(document)[0]?.tagName).toBe('DD');
    expect(decorateAcademicPapers(document)).toBe(1);
  });
  it.each([
    ['/CVPR2025_workshops','/content/CVPR2025/html/Test_paper.html'],
    ['/CVPR2025','/content/CVPR2025W/html/Test_paper.html'],
    ['/CVPR2025','/content/ICCV2025/html/Test_paper.html'],
    ['/CVPR2025','https://unrelated.test/content/CVPR2025/html/Test_paper.html'],
  ])('rejects workshop, wrong conference and foreign links', (path,href) => {
    expect(parseAcademicPapers(doc(cvf(href),`https://openaccess.thecvf.com${path}`))).toHaveLength(0);
  });
  it('recognizes the actual non-heading title in CVF details', () => {
    const document = doc('<div id="papertitle">Test Paper</div>','https://openaccess.thecvf.com/content/CVPR2025/html/Test_paper.html',meta('Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition'));
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(panels(document)[0]?.textContent).toContain('CCF-A');
  });
  it('does not apply main-conference metadata on workshop or mismatched conference details', () => {
    for (const event of ['CVPR2025W','ICCV2025']) {
      const document = doc('<div id="papertitle">Test Paper</div>',`https://openaccess.thecvf.com/content/${event}/html/Test_paper.html`,meta('Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition'));
      expect(decorateAcademicPapers(document)).toBe(0);
    }
  });
});

const hash = '0123456789abcdef0123456789abcdef';
const neuripsBody = (suffix = '') => `<h1 class="book-title">Advances in Neural Information Processing Systems 30</h1><ul><li><a title="paper title" href="/paper_files/paper/2017/hash/${hash}-Abstract${suffix}.html">Test Paper</a></li></ul>`;
describe('NeurIPS proceedings', () => {
  it.each(['','-Conference'])('recognizes main paper links with suffix %s', (suffix) => {
    const document = doc(neuripsBody(suffix),'https://proceedings.neurips.cc/paper_files/paper/2017');
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(panels(document)[0]?.textContent).toContain('CCF-A');
  });
  it.each(['-Datasets_and_Benchmarks','-Workshop'])('does not assign main track labels for %s', (suffix) => {
    expect(parseAcademicPapers(doc(neuripsBody(suffix),'https://proceedings.neurips.cc/paper_files/paper/2017'))).toHaveLength(0);
    expect(parseAcademicPapers(doc('<h1>Test Paper</h1>',`https://proceedings.neurips.cc/paper_files/paper/2017/hash/${hash}-Abstract${suffix}.html`,meta('Advances in Neural Information Processing Systems')))).toHaveLength(0);
  });
  it('requires matching year, book heading and official host', () => {
    for (const url of ['https://proceedings.neurips.cc/paper_files/paper/2018','https://elsewhere.test/paper_files/paper/2017']) {
      expect(parseAcademicPapers(doc(neuripsBody(),url))).toHaveLength(0);
    }
    expect(parseAcademicPapers(doc(neuripsBody().replace('Systems 30','Systems Workshop'),'https://proceedings.neurips.cc/paper_files/paper/2017'))).toHaveLength(0);
  });
});

const usenixBody = (event='osdi24',slug='author',pdf=true) => `<article class="node-paper"><h2><a href="/conference/${event}/presentation/${slug}">Test Paper</a></h2>${pdf?'<span class="usenix-schedule-media pdf"></span>':''}</article>`;
describe('USENIX research papers, not arbitrary schedule entries', () => {
  it('recognizes a same-event paper with PDF media', () => {
    const document=doc(usenixBody(),'https://www.usenix.org/conference/osdi24/technical-sessions');
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(panels(document)[0]?.textContent).toContain('CCF-A');
  });
  it.each([['atc24','author',true],['osdi24','joint-keynote',true],['osdi24','panel',true],['osdi24','author',false]])('excludes joint events, invited talks and missing paper media', (event,slug,pdf) => {
    expect(parseAcademicPapers(doc(usenixBody(event as string,slug as string,pdf as boolean),'https://www.usenix.org/conference/osdi24/technical-sessions'))).toHaveLength(0);
  });
  it('handles USENIX BibTeX title braces without relaxing the venue/year checks', () => {
    const body='<h1 id="page-title">Test Paper</h1>';
    const url='https://www.usenix.org/conference/osdi24/presentation/author';
    const document=doc(body,url,meta('18th USENIX Symposium on Operating Systems Design and Implementation (OSDI 24)','{Test} Paper'));
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(panels(document)[0]?.textContent).toContain('CCF-A');
    expect(parseAcademicPapers(doc(body,url,meta('18th USENIX Symposium on Operating Systems Design and Implementation (OSDI 23)','{Test} Paper')))).toHaveLength(0);
    expect(parseAcademicPapers(doc(body,'https://elsewhere.test/paper',meta('OSDI','{Test} Paper')))).toHaveLength(0);
  });
});

function dblp(source='NIPS',key='conf/nips',path='/db/conf/nips/nips2017.html',type='inproceedings'):string {
  return `<li class="entry ${type}" id="${key}/Test17"><cite class="data"><span itemprop="author">Test Author</span><span class="title">Test Paper</span><a href="${path}"><span itemprop="isPartOf" itemtype="http://schema.org/${type==='article'?'Periodical':'BookSeries'}"><span itemprop="name">${source}</span></span><span itemprop="datePublished">2017</span></a></cite></li>`;
}
describe('DBLP bibliographic records', () => {
  it.each(['https://dblp.org/search?q=test','https://dblp.org/pid/12/345.html','https://dblp.uni-trier.de/rec/conf/nips/Test17.html'])('recognizes structured publications on %s', (url) => {
    const document=doc(`<ul>${dblp()}</ul>`,url);
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(panels(document)[0]?.textContent).toContain('CCF-A');
    expect(panels(document)[0]?.tagName).toBe('SPAN');
    expect(panels(document)[0]?.getAttribute('title')).toContain('NIPS');
  });
  it('recognizes a verified journal abbreviation without using unrelated page text', () => {
    const document=doc(dblp('Expert Syst. Appl.','journals/eswa','/db/journals/eswa/eswa333.html','article'),'https://dblp.org/search');
    expect(decorateAcademicPapers(document)).toBe(1);
    expect(panels(document)[0]?.textContent).toContain('CCF-C');
  });
  it.each(['NIPS Workshops', 'NIPS…'])('does not truncate %s to a main conference', (source) => {
    const document=doc(dblp(source),'https://dblp.org/search');
    decorateAcademicPapers(document);
    expect(panels(document)[0]?.textContent).not.toContain('CCF-A');
  });
  it('rejects a mismatched record key, non-official link, non-publication entry or lookalike host', () => {
    for (const html of [dblp('NIPS','conf/icml'),dblp('NIPS','conf/nips','https://elsewhere.test/db/conf/nips/nips2017.html'),dblp().replace('entry inproceedings','entry informal')]) {
      expect(parseAcademicPapers(doc(html,'https://dblp.org/search'))).toHaveLength(0);
    }
    expect(parseAcademicPapers(doc(dblp(),'https://dblp.org.fake.test/search'))).toHaveLength(0);
  });
  it('removes stale badges after a source changes', () => {
    const document=doc(dblp(),'https://dblp.org/search');
    decorateAcademicPapers(document);
    document.querySelector('[itemprop="isPartOf"] [itemprop="name"]')!.textContent='Unknown proceedings';
    decorateAcademicPapers(document);
    expect(panels(document)[0]?.textContent).not.toContain('CCF-A');
    document.querySelector('.entry')!.className='entry informal';
    expect(decorateAcademicPapers(document)).toBe(0);
    expect(panels(document)).toHaveLength(0);
  });
});

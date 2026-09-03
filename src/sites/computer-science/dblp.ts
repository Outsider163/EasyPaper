import { pageUrl, type AcademicPaper } from '../academic/types';
import { linkUrl, MAX_PROCEEDINGS_PAPERS, paper, textOf } from './shared';

const HOSTS = ['dblp.org', 'www.dblp.org', 'dblp.uni-trier.de'];

export function parseDblp(root: ParentNode): AcademicPaper[] {
  const url = pageUrl(root);
  if (!url || !HOSTS.includes(url.hostname)) return [];
  const results: AcademicPaper[] = [];
  for (const entry of Array.from(root.querySelectorAll('.entry.article, .entry.inproceedings')).slice(0, MAX_PROCEEDINGS_PAPERS)) {
    const title = entry.querySelector<HTMLElement>('cite.data > .title');
    const sources = Array.from(entry.querySelectorAll('cite.data [itemprop="isPartOf"][itemtype$="/Periodical"] > [itemprop="name"], cite.data [itemprop="isPartOf"][itemtype$="/BookSeries"] > [itemprop="name"]'));
    if (!title || !textOf(title) || sources.length !== 1) continue;
    const source = textOf(sources[0]!);
    const link = linkUrl(sources[0]!.closest('a[href]'), url);
    const kind = entry.classList.contains('article') ? 'journals' : 'conf';
    const entryKey = entry.id.split('/').slice(0, 2).join('/');
    const volumeKey = link?.pathname.split('/').slice(2, 4).join('/');
    if (!source || !link || !HOSTS.includes(link.hostname) || !link.pathname.startsWith(`/db/${kind}/`) || entryKey !== volumeKey) continue;
    let venue = source;
    // Explicit historical abbreviation, verified against the publication's
    // volume URL. Never truncate "NIPS Workshops" into the main conference.
    if (kind === 'conf' && /^(?:NIPS|NeurIPS)$/u.test(source) && /^\/db\/conf\/nips\/nips\d{4}(?:-\d+)?\.html$/u.test(link.pathname)) venue = 'NeurIPS';
    if (kind === 'journals' && entryKey === 'journals/eswa' && source === 'Expert Syst. Appl.') venue = 'Expert Systems with Applications';
    results.push(paper(title, venue, 'DBLP', `${source} · ${link.pathname}`));
  }
  return results;
}

import { pageUrl, type AcademicPaper } from '../academic/types';
import { CVF_VENUES, linkUrl, MAX_PROCEEDINGS_PAPERS, NEURIPS_HOSTS, NEURIPS_VENUE,
  paper, pmlrVenue, textOf, USENIX_HOSTS, USENIX_VENUES } from './shared';

export function parseCsProceedings(root: ParentNode): AcademicPaper[] {
  const url = pageUrl(root);
  if (!url) return [];
  if (url.hostname === 'proceedings.mlr.press') return parsePmlr(root, url);
  if (url.hostname === 'openaccess.thecvf.com') return parseCvf(root, url);
  if (NEURIPS_HOSTS.includes(url.hostname)) return parseNeurips(root, url);
  if (USENIX_HOSTS.includes(url.hostname)) return parseUsenix(root, url);
  return [];
}

function parsePmlr(root: ParentNode, url: URL): AcademicPaper[] {
  const volume = /^\/v(\d+)\/?$/u.exec(url.pathname)?.[1];
  if (!volume) return [];
  const results: AcademicPaper[] = [];
  for (const card of Array.from(root.querySelectorAll('.paper')).slice(0, MAX_PROCEEDINGS_PAPERS)) {
    const title = card.querySelector<HTMLElement>('p.title');
    const source = textOf(card.querySelector('.details .info i'));
    const link = linkUrl(card.querySelector('.links a'), url);
    if (!title || !textOf(title) || !source || !link || link.hostname !== url.hostname ||
      !new RegExp(`^/v${volume}/[^/]+\\.html$`, 'u').test(link.pathname)) continue;
    results.push(paper(title, pmlrVenue(source), 'PMLR', source));
  }
  return results;
}

function parseCvf(root: ParentNode, url: URL): AcademicPaper[] {
  const event = /^\/(CVPR|ICCV|WACV|ACCV)(\d{4})\/?$/u.exec(url.pathname);
  if (!event) return [];
  const results: AcademicPaper[] = [];
  for (const title of Array.from(root.querySelectorAll<HTMLElement>('dt.ptitle')).slice(0, MAX_PROCEEDINGS_PAPERS)) {
    const link = linkUrl(title.querySelector('a[href]'), url);
    if (!link || link.hostname !== url.hostname || !textOf(title) ||
      !new RegExp(`^/content(?:/|_)${event[1]}${event[2]}/html/[^/]+_paper\\.html$`, 'u').test(link.pathname)) continue;
    results.push(paper(title, CVF_VENUES[event[1]!]!, 'CVF Open Access', `${event[1]} ${event[2]} · ${link.pathname}`));
  }
  return results;
}

function parseNeurips(root: ParentNode, url: URL): AcademicPaper[] {
  const year = /^\/(?:paper_files\/)?paper\/(\d{4})\/?$/u.exec(url.pathname)?.[1];
  const heading = textOf(root.querySelector('h1.book-title'));
  if (!year || !/^Advances in Neural Information Processing Systems \d+$/u.test(heading)) return [];
  const results: AcademicPaper[] = [];
  for (const title of Array.from(root.querySelectorAll<HTMLElement>('li a[title="paper title"]')).slice(0, MAX_PROCEEDINGS_PAPERS)) {
    const link = linkUrl(title, url);
    if (!link || link.hostname !== url.hostname || !textOf(title) ||
      !new RegExp(`^/(?:paper_files/)?paper/${year}/hash/[a-f0-9]{32}-Abstract(?:-Conference)?\\.html$`, 'u').test(link.pathname)) continue;
    results.push(paper(title, NEURIPS_VENUE, 'NeurIPS Proceedings', heading));
  }
  return results;
}

function parseUsenix(root: ParentNode, url: URL): AcademicPaper[] {
  const event = /^\/conference\/(osdi|fast|usenixsecurity|atc|nsdi)(\d{2})\/technical-sessions\/?$/u.exec(url.pathname);
  if (!event) return [];
  const eventId = `${event[1]}${event[2]}`;
  const results: AcademicPaper[] = [];
  for (const card of Array.from(root.querySelectorAll('.node-paper')).slice(0, MAX_PROCEEDINGS_PAPERS)) {
    const title = card.querySelector<HTMLElement>('h2');
    const link = linkUrl(title?.querySelector('a') ?? null, url);
    // A schedule also contains keynotes, panels and breaks. Require paper media
    // and a title link to this exact conference, not a joint-event presentation.
    if (!title || !textOf(title) || !card.querySelector('.usenix-schedule-media.pdf') || !link ||
      !USENIX_HOSTS.includes(link.hostname) ||
      !new RegExp(`^/conference/${eventId}/presentation/[^/]+/?$`, 'u').test(link.pathname) ||
      /keynote|invited|panel|tutorial/iu.test(link.pathname)) continue;
    results.push(paper(title, USENIX_VENUES[event[1]!]!, 'USENIX', `${eventId} · ${link.pathname}`));
  }
  return results;
}

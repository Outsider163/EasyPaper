import type { GoogleScholarResult } from '../types';

export const GOOGLE_SCHOLAR_RESULT_SELECTOR =
  '#gs_res_ccl_mid .gs_r[data-rp], .gs_r.gs_or.gs_scl';

const TITLE_SELECTOR = '.gs_rt';
const RESULT_BODY_SELECTOR = '.gs_ri';
const METADATA_SELECTOR = '.gs_a';
const TITLE_MARKER_SELECTOR = '.gs_ctu, .gs_ctc';
const LEADING_TITLE_MARKERS = /^(?:\s*\[[^\]\r\n]{1,32}\]\s*)+/;
const METADATA_SEPARATOR = /\s+[-–—]\s+/;
const VENUE_AND_YEAR_PATTERN = /^(.*),\s*((?:19|20)\d{2})$/;
const YEAR_ONLY_PATTERN = /^((?:19|20)\d{2})$/;
const ELLIPSIS_AT_EDGE = /^(?:…|\.\.\.)|(?:…|\.\.\.)$/;

export function normalizeScholarWhitespace(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseGoogleScholarResults(root: ParentNode): GoogleScholarResult[] {
  return Array.from(root.querySelectorAll(GOOGLE_SCHOLAR_RESULT_SELECTOR))
    .filter((card) => card.querySelector(RESULT_BODY_SELECTOR) !== null)
    .map((card, index) => parseGoogleScholarResult(card, index))
    .filter((result): result is GoogleScholarResult => result !== undefined);
}

export function parseGoogleScholarResult(
  card: Element,
  position = 0,
): GoogleScholarResult | undefined {
  if (!card.querySelector(RESULT_BODY_SELECTOR)) {
    return undefined;
  }

  const titleElement = card.querySelector(TITLE_SELECTOR);
  if (!titleElement) {
    return undefined;
  }

  const link = titleElement.querySelector<HTMLAnchorElement>('a[href]');
  const title = extractTitle(titleElement, link);
  if (!title) {
    return undefined;
  }

  const url = normalizeOptional(link?.getAttribute('href'));
  const metadata = parseGoogleScholarMetadata(card.querySelector(METADATA_SELECTOR)?.textContent);

  const id =
    normalizeOptional(card.getAttribute('data-cid')) ??
    normalizeOptional(card.getAttribute('data-aid')) ??
    normalizeOptional(card.getAttribute('data-rp')) ??
    normalizeOptional(card.id) ??
    `google-scholar-result-${position}`;

  return {
    id,
    title,
    url,
    ...metadata,
  };
}

export type ScholarPublicationMetadata = Pick<GoogleScholarResult,
  'metadataText' | 'authorsText' | 'publicationText' | 'venueCandidate' |
  'publisherText' | 'year' | 'sourceTruncated'>;

/** Shared by official Scholar and its custom-layout academic search adapters. */
export function parseGoogleScholarMetadata(value: string | null | undefined): ScholarPublicationMetadata {
  const metadataText = normalizeScholarWhitespace(value);
  const metadataParts = metadataText
    ? metadataText.split(METADATA_SEPARATOR).map(normalizeScholarWhitespace)
    : [];
  const { authorsText, publicationText, publisherText } = partitionMetadata(metadataParts);
  const { venueCandidate, year } = parsePublication(publicationText);
  return {
    metadataText, authorsText, publicationText, venueCandidate, publisherText, year,
    sourceTruncated: venueCandidate ? ELLIPSIS_AT_EDGE.test(venueCandidate) : false,
  };
}

function extractTitle(
  titleElement: Element,
  link: HTMLAnchorElement | null,
): string {
  if (link) {
    return stripLeadingMarkers(normalizeScholarWhitespace(link.textContent));
  }

  const titleCopy = titleElement.cloneNode(true) as Element;
  titleCopy
    .querySelectorAll(TITLE_MARKER_SELECTOR)
    .forEach((marker) => marker.remove());
  return stripLeadingMarkers(normalizeScholarWhitespace(titleCopy.textContent));
}

function stripLeadingMarkers(title: string): string {
  return normalizeScholarWhitespace(title.replace(LEADING_TITLE_MARKERS, ''));
}

function partitionMetadata(parts: string[]): Pick<
  GoogleScholarResult,
  'authorsText' | 'publicationText' | 'publisherText'
> {
  const authorsText = normalizeOptional(parts[0]);

  if (parts.length >= 3) {
    return {
      authorsText,
      publicationText: normalizeOptional(parts.slice(1, -1).join(' - ')),
      publisherText: normalizeOptional(parts.at(-1)),
    };
  }

  if (parts.length === 2) {
    const rightHandSide = normalizeOptional(parts[1]);
    const isPublication =
      rightHandSide !== undefined && VENUE_AND_YEAR_PATTERN.test(rightHandSide);
    return {
      authorsText,
      publicationText: isPublication ? rightHandSide : undefined,
      publisherText: isPublication ? undefined : rightHandSide,
    };
  }

  return {
    authorsText,
    publicationText: undefined,
    publisherText: undefined,
  };
}

function parsePublication(publicationText: string | undefined): Pick<
  GoogleScholarResult,
  'venueCandidate' | 'year'
> {
  if (!publicationText) {
    return { venueCandidate: undefined, year: undefined };
  }

  const yearOnlyMatch = publicationText.match(YEAR_ONLY_PATTERN);
  if (yearOnlyMatch) {
    return { venueCandidate: undefined, year: Number(yearOnlyMatch[1]) };
  }

  const venueAndYearMatch = publicationText.match(VENUE_AND_YEAR_PATTERN);
  if (venueAndYearMatch) {
    return {
      venueCandidate: normalizeOptional(venueAndYearMatch[1]),
      year: Number(venueAndYearMatch[2]),
    };
  }

  return { venueCandidate: publicationText, year: undefined };
}

function normalizeOptional(value: string | null | undefined): string | undefined {
  const normalized = normalizeScholarWhitespace(value);
  return normalized || undefined;
}

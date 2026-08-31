import { createVenueMatcher, type VenueMatchResult } from '../matcher';
import { normalizeVenueName } from '../normalize';
import type { VenueRecord } from '../types';
import { CCF_7TH_VENUES } from './ccf-7th';
import { YNUFE_2026_VENUES } from './ynufe-2026';

export const BUNDLED_VENUES: readonly VenueRecord[] = mergeBundledCatalogs();

export const BUNDLED_CATALOG_STATS = Object.freeze({
  ccfPdfRows: 681,
  ccfUniqueVenues: CCF_7TH_VENUES.length,
  ynufeVenues: YNUFE_2026_VENUES.length,
  activeVenues: BUNDLED_VENUES.length,
});

function mergeBundledCatalogs(): VenueRecord[] {
  const records = CCF_7TH_VENUES.map(cloneVenue);
  const ccfMatcher = createVenueMatcher(records);
  const recordIndex = new Map(records.map((venue, index) => [venue.id, index]));
  const exactTypeIndex = new Map(
    records.map((venue) => [typeNameKey(venue), venue]),
  );

  for (const schoolVenue of YNUFE_2026_VENUES) {
    const exact = exactTypeIndex.get(typeNameKey(schoolVenue));
    const matched = exact ?? selectSameType(ccfMatcher.match({
      candidate: schoolVenue.canonicalName,
      sourceTruncated: false,
    }), schoolVenue.type);
    const index = matched ? recordIndex.get(matched.id) : undefined;

    if (index === undefined) {
      const cloned = cloneVenue(schoolVenue);
      records.push(cloned);
      exactTypeIndex.set(typeNameKey(cloned), cloned);
      continue;
    }

    const bundledVenue = records[index]!;
    const enriched: VenueRecord = {
      ...bundledVenue,
      aliases: unique([
        ...bundledVenue.aliases,
        schoolVenue.canonicalName,
        ...schoolVenue.aliases,
      ]),
      acronyms: optionalUnique([
        ...(bundledVenue.acronyms ?? []),
        ...(schoolVenue.acronyms ?? []),
      ]),
      issn: optionalUnique([
        ...(bundledVenue.issn ?? []),
        ...(schoolVenue.issn ?? []),
      ]),
      school: schoolVenue.school ? { ...schoolVenue.school } : undefined,
    };
    records[index] = enriched;
    exactTypeIndex.set(typeNameKey(enriched), enriched);
  }

  applyYnufeCcfRules(records);
  return records;
}

function applyYnufeCcfRules(records: VenueRecord[]): void {
  for (const venue of records) {
    if (!venue.ccf || venue.school) {
      continue;
    }
    venue.school = {
      rank: venue.ccf.rank === 'C' ? 'D' : 'C',
      edition: '2026',
      catalog: '云南财经大学',
    };
  }
}

function selectSameType(
  match: VenueMatchResult,
  type: VenueRecord['type'],
): VenueRecord | undefined {
  if (match.status === 'matched') {
    return match.venue.type === type ? match.venue : undefined;
  }
  if (match.status !== 'ambiguous') {
    return undefined;
  }
  const sameType = match.candidates.filter((venue) => venue.type === type);
  return sameType.length === 1 ? sameType[0] : undefined;
}

function typeNameKey(venue: VenueRecord): string {
  return `${venue.type}\u0000${normalizeVenueName(venue.canonicalName)}`;
}

function cloneVenue(venue: VenueRecord): VenueRecord {
  return {
    ...venue,
    aliases: [...venue.aliases],
    acronyms: venue.acronyms ? [...venue.acronyms] : undefined,
    issn: venue.issn ? [...venue.issn] : undefined,
    ccf: venue.ccf ? { ...venue.ccf } : undefined,
    cas: venue.cas ? { ...venue.cas } : undefined,
    impactFactor: venue.impactFactor ? { ...venue.impactFactor } : undefined,
    school: venue.school ? { ...venue.school } : undefined,
  };
}

function optionalUnique(values: string[]): string[] | undefined {
  const result = unique(values);
  return result.length > 0 ? result : undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

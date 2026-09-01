import { BUNDLED_VENUES } from './data/bundled';
import {
  createVenueMatcher,
  type VenueKeyConflict,
  type VenueMatchInput,
  type VenueMatchResult,
  type VenueMatcher,
} from './matcher';
import type { VenueRecord } from './types';

const bundledMatcher = createVenueMatcher(BUNDLED_VENUES);
const bundledConflictSignatures = new Set(
  bundledMatcher.conflicts.map(conflictSignature),
);
let activeMatcher: VenueMatcher = bundledMatcher;

export const activeVenueMatcher: VenueMatcher = {
  get conflicts() {
    return activeMatcher.conflicts;
  },
  match(input: VenueMatchInput) {
    return activeMatcher.match(input);
  },
};

// Compatibility name retained while the site adapters migrate to activeVenueMatcher.
export const ccf2026SeedMatcher = activeVenueMatcher;

export function setUserVenueCatalog(
  userVenues: readonly VenueRecord[],
): { userRecords: number; activeRecords: number } {
  const records = mergeVenueCatalogs(userVenues);
  const matcher = createVenueMatcher(records);
  const newConflict = matcher.conflicts.find(
    (conflict) =>
      !bundledConflictSignatures.has(conflictSignature(conflict)) &&
      !isCrossTypeConflict(conflict),
  );
  if (newConflict) {
    const names = newConflict.venues
      .map((venue) => venue.canonicalName)
      .join(' / ');
    throw new Error(`目录别名冲突“${newConflict.key}”：${names}`);
  }
  activeMatcher = matcher;
  return { userRecords: userVenues.length, activeRecords: records.length };
}

export function resetUserVenueCatalog(): void {
  activeMatcher = bundledMatcher;
}

export function mergeVenueCatalogs(
  userVenues: readonly VenueRecord[],
): VenueRecord[] {
  const records: VenueRecord[] = BUNDLED_VENUES.map(cloneVenue);
  const recordIndex = new Map(records.map((venue, index) => [venue.id, index]));

  for (const userVenue of userVenues) {
    const bundledMatch = findBundledVenue(userVenue);

    if (!bundledMatch) {
      records.push(cloneVenue(userVenue));
      continue;
    }

    const index = recordIndex.get(bundledMatch.id);
    if (index === undefined) {
      records.push(cloneVenue(userVenue));
      continue;
    }

    const bundledVenue = records[index]!;
    records[index] = {
      ...bundledVenue,
      aliases: unique([
        ...bundledVenue.aliases,
        userVenue.canonicalName,
        ...userVenue.aliases,
      ]),
      acronyms: optionalUnique([
        ...(bundledVenue.acronyms ?? []),
        ...(userVenue.acronyms ?? []),
      ]),
      issn: optionalUnique([
        ...(bundledVenue.issn ?? []),
        ...(userVenue.issn ?? []),
      ]),
      ccf: bundledVenue.ccf ?? userVenue.ccf,
      cas: userVenue.cas ?? bundledVenue.cas,
      impactFactor: userVenue.impactFactor ?? bundledVenue.impactFactor,
      school: userVenue.school ?? bundledVenue.school,
      labels: optionalLabelUnique([
        ...(bundledVenue.labels ?? []),
        ...(userVenue.labels ?? []),
      ]),
    };
  }

  return records;
}

function findBundledVenue(userVenue: VenueRecord): VenueRecord | undefined {
  const candidates = [
    userVenue.canonicalName,
    ...userVenue.aliases,
    ...(userVenue.acronyms ?? []),
  ];
  for (const candidate of candidates) {
    const venue = selectSameType(
      bundledMatcher.match({ candidate, sourceTruncated: false }),
      userVenue.type,
    );
    if (venue) {
      return venue;
    }
  }
  return undefined;
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

function isCrossTypeConflict(conflict: VenueKeyConflict): boolean {
  const venueTypes = new Set(conflict.venues.map((venue) => venue.type));
  return venueTypes.size === conflict.venues.length;
}

function conflictSignature(conflict: VenueKeyConflict): string {
  const venueIds = conflict.venues
    .map((venue) => venue.id)
    .sort()
    .join('\u0000');
  return `${conflict.namespace}\u0000${conflict.key}\u0000${venueIds}`;
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
    labels: venue.labels?.map((label) => ({ ...label })),
  };
}

function optionalUnique(values: string[]): string[] | undefined {
  const result = unique(values);
  return result.length > 0 ? result : undefined;
}

function optionalLabelUnique(
  values: NonNullable<VenueRecord['labels']>,
): VenueRecord['labels'] {
  const seen = new Set<string>();
  const result = values.filter((label) => {
    const key = `${label.kind}\u0000${label.text.normalize('NFKC').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return result.length > 0 ? result.map((label) => ({ ...label })) : undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

import type { VenueRecord } from './types';
import { normalizeVenueAcronym, normalizeVenueName } from './normalize';

export type VenueMatchedBy = 'canonicalName' | 'alias' | 'acronym';
export type VenueMatchConfidence = 'high' | 'medium';

export interface VenueMatchInput {
  candidate: string | undefined;
  sourceTruncated?: boolean;
}

export type VenueMatchResult =
  | {
      status: 'matched';
      venue: VenueRecord;
      matchedBy: VenueMatchedBy;
      matchedValue: string;
      confidence: VenueMatchConfidence;
      normalizedCandidate: string;
    }
  | {
      status: 'ambiguous';
      candidates: readonly VenueRecord[];
      normalizedCandidate: string;
      reason: 'key-conflict';
    }
  | {
      status: 'unmatched';
      normalizedCandidate: string;
      reason: 'missing-candidate' | 'truncated-source' | 'no-exact-match';
    };

export interface VenueKeyConflict {
  namespace: 'name' | 'acronym' | 'cross';
  key: string;
  venues: readonly VenueRecord[];
}

export interface VenueMatcher {
  match(input: VenueMatchInput): VenueMatchResult;
  readonly conflicts: readonly VenueKeyConflict[];
}

interface IndexedVenue {
  venue: VenueRecord;
  matchedBy: VenueMatchedBy;
  matchedValue: string;
  confidence: VenueMatchConfidence;
}

type VenueIndex = Map<string, Map<string, IndexedVenue>>;

const MATCH_PRIORITY: Record<VenueMatchedBy, number> = {
  canonicalName: 0,
  alias: 1,
  acronym: 2,
};

export function createVenueMatcher(
  venues: readonly VenueRecord[],
): VenueMatcher {
  assertUniqueVenueIds(venues);

  const nameIndex: VenueIndex = new Map();
  const acronymIndex: VenueIndex = new Map();

  for (const venue of venues) {
    addIndexEntry(
      nameIndex,
      normalizeVenueName(venue.canonicalName),
      createEntry(venue, 'canonicalName', venue.canonicalName),
    );

    for (const alias of venue.aliases) {
      addIndexEntry(
        nameIndex,
        normalizeVenueName(alias),
        createEntry(venue, 'alias', alias),
      );
    }

    for (const acronym of venue.acronyms ?? []) {
      const key = normalizeVenueAcronym(acronym);
      if (key) {
        addIndexEntry(
          acronymIndex,
          key,
          createEntry(venue, 'acronym', acronym),
        );
      }
    }
  }

  const conflicts = Object.freeze([
    ...collectConflicts(nameIndex, 'name'),
    ...collectConflicts(acronymIndex, 'acronym'),
    ...collectCrossIndexConflicts(nameIndex, acronymIndex),
  ]);

  return {
    conflicts,
    match(input) {
      return matchVenue(input, nameIndex, acronymIndex);
    },
  };
}

function assertUniqueVenueIds(venues: readonly VenueRecord[]): void {
  const seenIds = new Set<string>();

  for (const venue of venues) {
    const id = venue.id.trim();
    if (!id) {
      throw new Error('Venue id must not be empty.');
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate venue id: ${id}`);
    }
    seenIds.add(id);
  }
}

function matchVenue(
  input: VenueMatchInput,
  nameIndex: VenueIndex,
  acronymIndex: VenueIndex,
): VenueMatchResult {
  const normalizedCandidate = normalizeVenueName(input.candidate ?? '');

  if (!normalizedCandidate) {
    return {
      status: 'unmatched',
      normalizedCandidate,
      reason: 'missing-candidate',
    };
  }

  if (input.sourceTruncated) {
    return {
      status: 'unmatched',
      normalizedCandidate,
      reason: 'truncated-source',
    };
  }

  const matches = new Map<string, IndexedVenue>();
  mergeMatches(matches, nameIndex.get(normalizedCandidate));

  const acronymKey = normalizeVenueAcronym(input.candidate ?? '');
  if (acronymKey) {
    mergeMatches(matches, acronymIndex.get(acronymKey));
  }

  if (matches.size === 0) {
    return {
      status: 'unmatched',
      normalizedCandidate,
      reason: 'no-exact-match',
    };
  }

  if (matches.size > 1) {
    return {
      status: 'ambiguous',
      candidates: sortVenues(matches.values()),
      normalizedCandidate,
      reason: 'key-conflict',
    };
  }

  const [match] = matches.values();
  if (!match) {
    throw new Error('Venue matcher reached an invalid empty match state.');
  }

  return {
    status: 'matched',
    venue: match.venue,
    matchedBy: match.matchedBy,
    matchedValue: match.matchedValue,
    confidence: match.confidence,
    normalizedCandidate,
  };
}

function createEntry(
  venue: VenueRecord,
  matchedBy: VenueMatchedBy,
  matchedValue: string,
): IndexedVenue {
  return {
    venue,
    matchedBy,
    matchedValue,
    confidence: matchedBy === 'acronym' ? 'medium' : 'high',
  };
}

function addIndexEntry(
  index: VenueIndex,
  key: string,
  entry: IndexedVenue,
): void {
  if (!key) {
    return;
  }

  let entries = index.get(key);
  if (!entries) {
    entries = new Map();
    index.set(key, entries);
  }

  const existing = entries.get(entry.venue.id);
  if (
    !existing ||
    MATCH_PRIORITY[entry.matchedBy] < MATCH_PRIORITY[existing.matchedBy]
  ) {
    entries.set(entry.venue.id, entry);
  }
}

function mergeMatches(
  target: Map<string, IndexedVenue>,
  source: Map<string, IndexedVenue> | undefined,
): void {
  for (const [venueId, entry] of source ?? []) {
    const existing = target.get(venueId);
    if (
      !existing ||
      MATCH_PRIORITY[entry.matchedBy] < MATCH_PRIORITY[existing.matchedBy]
    ) {
      target.set(venueId, entry);
    }
  }
}

function collectConflicts(
  index: VenueIndex,
  namespace: 'name' | 'acronym',
): VenueKeyConflict[] {
  const conflicts: VenueKeyConflict[] = [];

  for (const [key, entries] of index) {
    if (entries.size > 1) {
      conflicts.push({
        namespace,
        key,
        venues: sortVenues(entries.values()),
      });
    }
  }

  return conflicts;
}

function collectCrossIndexConflicts(
  nameIndex: VenueIndex,
  acronymIndex: VenueIndex,
): VenueKeyConflict[] {
  const conflicts: VenueKeyConflict[] = [];

  for (const [nameKey, nameEntries] of nameIndex) {
    const acronymKey = normalizeVenueAcronym(nameKey);
    const acronymEntries = acronymKey ? acronymIndex.get(acronymKey) : undefined;
    if (!acronymEntries) {
      continue;
    }

    const combined = new Map<string, IndexedVenue>();
    mergeMatches(combined, nameEntries);
    mergeMatches(combined, acronymEntries);
    if (combined.size > 1) {
      conflicts.push({
        namespace: 'cross',
        key: nameKey,
        venues: sortVenues(combined.values()),
      });
    }
  }

  return conflicts;
}

function sortVenues(entries: Iterable<IndexedVenue>): readonly VenueRecord[] {
  return Object.freeze(
    [...entries]
      .map((entry) => entry.venue)
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
}

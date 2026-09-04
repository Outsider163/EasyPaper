import { normalizeVenueName } from '../src/ranking/normalize';
import type { VenueRecord } from '../src/ranking/types';

interface KnownIssnConflict {
  fmsName: string;
  fmsIssn: string;
  existingName: string;
}

const KNOWN_ISSN_CONFLICTS: readonly KnownIssnConflict[] = [
  {
    fmsName: '世界经济文汇',
    fmsIssn: '02539772',
    existingName: '遗传',
  },
];

export function assertKnownFmsIssnConflict(
  fmsVenue: VenueRecord,
  existingVenue: VenueRecord,
): void {
  const fmsName = normalizeVenueName(fmsVenue.canonicalName);
  const existingName = normalizeVenueName(existingVenue.canonicalName);
  const issn = new Set((fmsVenue.issn ?? []).map(normalizeIssn));
  const known = KNOWN_ISSN_CONFLICTS.some(
    (conflict) =>
      fmsName === normalizeVenueName(conflict.fmsName) &&
      existingName === normalizeVenueName(conflict.existingName) &&
      issn.has(conflict.fmsIssn),
  );
  if (!known) {
    throw new Error(
      `FMS 记录“${fmsVenue.canonicalName}”存在未知 ISSN 冲突：` +
        `${(fmsVenue.issn ?? []).join('|')} → ${existingVenue.canonicalName}。`,
    );
  }
}

function normalizeIssn(value: string): string {
  return value.normalize('NFKC').toUpperCase().replace(/[^0-9X]/gu, '');
}

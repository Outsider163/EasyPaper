import { normalizeVenueName } from '../normalize';
import { mergeSchools, venueSchools } from '../schools';
import type { VenueRecord } from '../types';

/** Compiled source records are already checked against the public catalog. */
export function addSchoolData(base: VenueRecord[], additions: readonly VenueRecord[]): VenueRecord[] {
  const records = [...base];
  for (const incoming of additions) {
    const key = normalizeVenueName(incoming.canonicalName);
    const matches = records.filter((record) => record.type === incoming.type &&
      (record.id === incoming.id || [record.canonicalName, ...record.aliases].some((name) => normalizeVenueName(name) === key)));
    if (matches.length > 1) throw new Error(`内置学校目录名称冲突：${incoming.canonicalName}`);
    if (!matches.length) {
      records.push({ ...incoming, aliases: [...incoming.aliases], schools: venueSchools(incoming) });
      continue;
    }
    const existing = matches[0]!;
    existing.schools = mergeSchools(venueSchools(existing), venueSchools(incoming));
    existing.aliases = [...new Set([...existing.aliases, incoming.canonicalName, ...incoming.aliases])];
  }
  return records;
}

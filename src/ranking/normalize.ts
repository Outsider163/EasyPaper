const NON_BREAKING_SPACE = /\u00a0/gu;
const UNICODE_DASH = /[\u2010-\u2015\u2212]/gu;
const UNICODE_SINGLE_QUOTE = /[\u2018\u2019]/gu;
const UNICODE_DOUBLE_QUOTE = /[\u201c\u201d]/gu;
const EDGE_PUNCTUATION =
  /^[\s.,;:!?()[\]{}'"“”‘’]+|[\s.,;:!?()[\]{}'"“”‘’]+$/gu;
const ACRONYM_CHARACTERS = /^[\p{L}\p{N}.+/#\-\s]+$/u;

export function normalizeVenueName(value: string): string {
  return value
    .normalize('NFKC')
    .replace(NON_BREAKING_SPACE, ' ')
    .replace(UNICODE_DASH, '-')
    .replace(UNICODE_SINGLE_QUOTE, "'")
    .replace(UNICODE_DOUBLE_QUOTE, '"')
    .toLowerCase()
    .replace(EDGE_PUNCTUATION, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function normalizeVenueAcronym(value: string): string | undefined {
  const normalized = normalizeVenueName(value);

  if (
    !normalized ||
    normalized.length > 24 ||
    !ACRONYM_CHARACTERS.test(normalized)
  ) {
    return undefined;
  }

  const withoutDots = normalized.replace(/\./gu, '');
  if (!normalized.includes('.')) {
    return withoutDots;
  }

  const tokens = withoutDots.split(' ');
  const isDottedInitialism =
    tokens.length > 1 && tokens.every((token) => [...token].length === 1);

  return isDottedInitialism ? tokens.join('') : withoutDots;
}

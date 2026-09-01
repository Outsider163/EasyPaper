export type VenueType = 'journal' | 'conference';
export type CcfRank = 'A' | 'B' | 'C';
export type CasQuartile = '1' | '2' | '3' | '4';
export type VenueLabelKind =
  | 'cas-upgraded'
  | 'cas-discipline'
  | 'jcr-quartile'
  | 'new-rising'
  | 'indexing'
  | 'sjr'
  | 'publication-type'
  | 'warning'
  | 'note';

export interface VenueLabel {
  kind: VenueLabelKind;
  text: string;
  edition?: string;
}

export interface RankingValue<Rank extends string = string> {
  rank: Rank;
  edition?: string;
  sourceUrl?: string;
  catalog?: string;
}

export interface ImpactFactorValue {
  value: number;
  year: string;
  sourceUrl?: string;
  sourceLabel?: string;
}

export interface VenueRecord {
  id: string;
  type: VenueType;
  canonicalName: string;
  aliases: string[];
  acronyms?: string[];
  issn?: string[];
  dblpKey?: string;
  ccf?: RankingValue<CcfRank>;
  cas?: RankingValue<CasQuartile>;
  impactFactor?: ImpactFactorValue;
  school?: RankingValue;
  labels?: VenueLabel[];
}

export interface GoogleScholarResult {
  id: string;
  title: string;
  url: string | undefined;
  metadataText: string;
  authorsText: string | undefined;
  publicationText: string | undefined;
  venueCandidate: string | undefined;
  publisherText: string | undefined;
  year: number | undefined;
  sourceTruncated: boolean;
}

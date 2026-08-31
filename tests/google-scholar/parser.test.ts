import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';

import {
  decorateGoogleScholarResults,
  removeGoogleScholarDecorations,
  SCHOLAR_PANEL_ATTRIBUTE,
  SCHOLAR_STYLE_ID,
} from '../../src/sites/google-scholar/decorator';
import { parseGoogleScholarResults } from '../../src/sites/google-scholar/parser';
import { GOOGLE_SCHOLAR_RESULTS_HTML } from '../fixtures/google-scholar-results';

function createDocument(): Document {
  return parseHTML(GOOGLE_SCHOLAR_RESULTS_HTML).document as unknown as Document;
}

describe('parseGoogleScholarResults', () => {
  it('parses a conference result', () => {
    const [result] = parseGoogleScholarResults(createDocument());

    expect(result).toEqual({
      id: 'conference-result',
      title: 'Attention Is All You Need',
      url: 'https://example.org/attention',
      metadataText:
        'A Vaswani, N Shazeer, N Parmar - Advances in Neural Information Processing Systems, 2017 - proceedings.neurips.cc',
      authorsText: 'A Vaswani, N Shazeer, N Parmar',
      publicationText: 'Advances in Neural Information Processing Systems, 2017',
      venueCandidate: 'Advances in Neural Information Processing Systems',
      publisherText: 'proceedings.neurips.cc',
      year: 2017,
      sourceTruncated: false,
    });
  });

  it('parses a journal result, removes its marker, and uses data-aid as its id', () => {
    const result = parseGoogleScholarResults(createDocument())[1]!;

    expect(result.id).toBe('journal-result');
    expect(result.title).toBe('A Journal Article');
    expect(result.venueCandidate).toBe('Journal of Useful Results');
    expect(result.year).toBe(2024);
    expect(result.publisherText).toBe('Elsevier');
  });

  it('supports a citation without a link and does not treat a bare year as a venue', () => {
    const result = parseGoogleScholarResults(createDocument())[2]!;

    expect(result.title).toBe('A Classic Paper');
    expect(result.url).toBeUndefined();
    expect(result.publicationText).toBe('1999');
    expect(result.venueCandidate).toBeUndefined();
    expect(result.year).toBe(1999);
  });

  it('normalizes whitespace in titles and metadata fields', () => {
    const result = parseGoogleScholarResults(createDocument())[3]!;

    expect(result.id).toBe('3');
    expect(result.title).toBe('A Title With Irregular Whitespace');
    expect(result.metadataText).toBe(
      'First Author, Second Author - Example Conference, 2022 - ACM',
    );
    expect(result.authorsText).toBe('First Author, Second Author');
    expect(result.venueCandidate).toBe('Example Conference');
  });

  it('keeps a two-part host out of the publication field', () => {
    const result = parseGoogleScholarResults(createDocument())[4]!;

    expect(result.publicationText).toBeUndefined();
    expect(result.venueCandidate).toBeUndefined();
    expect(result.publisherText).toBe('repository.example.org');
  });

  it('marks a visibly truncated source as low-confidence input', () => {
    const result = parseGoogleScholarResults(createDocument())[5]!;

    expect(result.venueCandidate).toBe('…International Conference on Examples');
    expect(result.year).toBe(2021);
    expect(result.sourceTruncated).toBe(true);
  });
});

describe('Google Scholar decoration', () => {
  it('adds one panel per result and remains idempotent', () => {
    const document = createDocument();

    expect(decorateGoogleScholarResults(document)).toBe(6);
    expect(decorateGoogleScholarResults(document)).toBe(6);
    expect(document.querySelectorAll(`[${SCHOLAR_PANEL_ATTRIBUTE}]`)).toHaveLength(6);
    expect(document.querySelectorAll(`#${SCHOLAR_STYLE_ID}`)).toHaveLength(1);

    const firstTitle = document.querySelector('.gs_rt');
    expect(firstTitle?.nextElementSibling?.hasAttribute(SCHOLAR_PANEL_ATTRIBUTE)).toBe(true);
  });

  it('removes all panels and their shared style', () => {
    const document = createDocument();
    decorateGoogleScholarResults(document);

    removeGoogleScholarDecorations(document);

    expect(document.querySelectorAll(`[${SCHOLAR_PANEL_ATTRIBUTE}]`)).toHaveLength(0);
    expect(document.getElementById(SCHOLAR_STYLE_ID)).toBeNull();
  });
});

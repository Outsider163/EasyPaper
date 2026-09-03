export interface AcademicPaper {
  titleElement: HTMLElement;
  title: string;
  venueCandidate: string;
  sourceTruncated: boolean;
  adapter: '知网兼容页面' | 'Scholar 兼容页面' | 'GoogleScholar.pro' |
    'PubMed' | 'JMLR' | 'ACL Anthology' | 'DBLP' | 'PMLR' |
    'CVF Open Access' | 'NeurIPS Proceedings' | 'USENIX' | '论文元数据';
  /** Preserve the page's original source when a verified site rule normalizes it. */
  sourceEvidence?: string;
}

export function pageUrl(root: ParentNode): URL | undefined {
  const document = (root as Node).nodeType === 9 ? root as Document : (root as Node).ownerDocument;
  try {
    const url = new URL(document?.URL ?? '');
    return ['http:', 'https:'].includes(url.protocol) ? url : undefined;
  } catch { return undefined; }
}

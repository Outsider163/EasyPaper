import { afterEach, describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { normalizeLabelDisplay, setLabelDisplay } from '../../src/ranking/display-settings';
import { renderRankingBadges } from '../../src/ranking/badges';

afterEach(() => setLabelDisplay(undefined));
describe('label display preferences', () => {
  it('keeps old installations visible and drops invalid stored values', () => {
    expect(normalizeLabelDisplay(undefined)).toEqual({ hiddenKinds: [], showEdition: true });
    expect(normalizeLabelDisplay({ hiddenKinds: ['ccf', 'ccf', 'unknown', 1], showEdition: false }))
      .toEqual({ hiddenKinds: ['ccf'], showEdition: false });
  });
  it('updates existing panels, preserves edition in tooltip and restores hidden labels', () => {
    const { document } = parseHTML('<html><body><div></div></body></html>');
    const panel = document.querySelector('div') as unknown as HTMLElement;
    const badges = [{ kind: 'ccf' as const, text: 'CCF-A', edition: '2022' },
      { kind: 'impact-factor' as const, text: 'IF 5（2025）' }];
    renderRankingBadges(panel, badges);
    expect(panel.textContent).toContain('CCF-A（2022）');
    setLabelDisplay({ hiddenKinds: ['ccf'], showEdition: false });
    renderRankingBadges(panel, badges);
    expect(panel.textContent).toBe('IF 5（2025）');
    setLabelDisplay({ hiddenKinds: [], showEdition: false });
    renderRankingBadges(panel, badges);
    expect(panel.firstElementChild?.textContent).toBe('CCF-A');
    expect(panel.firstElementChild?.getAttribute('title')).toBe('CCF-A（2022）');
  });
});

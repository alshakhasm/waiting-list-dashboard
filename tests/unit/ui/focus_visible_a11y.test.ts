import { describe, it, expect } from '@jest/globals';
import { getTheme } from '../../../src/lib/design/tokens';
import { meetsContrast } from '../../../src/lib/design/a11y';

describe('Focus-visible accessibility', () => {
  it('meets contrast in both themes', () => {
    const d = getTheme('default');
    const hc = getTheme('high-contrast');
    expect(meetsContrast(d.palette.focusOutline, d.palette.background, 3)).toBe(true);
    expect(meetsContrast(hc.palette.focusOutline, hc.palette.background, 3)).toBe(true);
  });
});

import { describe, it, expect } from '@jest/globals';
import { typographyPresets, scale } from '../../../src/lib/design/typography';

describe('Typography scaling', () => {
  it('scales font size and spacing across presets', () => {
    const m = typographyPresets.medium;
    const base = m.baseFontSizePx;
    const up1 = scale(m, 1);
    const down1 = scale(m, -1);
    expect(up1).toBeGreaterThan(base);
    expect(down1).toBeLessThan(base);
  });
});

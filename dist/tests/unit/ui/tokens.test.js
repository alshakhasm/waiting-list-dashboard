import { describe, it, expect } from '@jest/globals';
import { getTheme } from '../../../src/lib/design/tokens';
describe('Design tokens', () => {
    it('resolve palettes for Default and High-Contrast', () => {
        const d = getTheme('default');
        const hc = getTheme('high-contrast');
        expect(d.palette.background).toBeDefined();
        expect(hc.palette.text).toBe('#ffffff');
        expect(d.typography.baseFontSizePx).toBeGreaterThan(0);
    });
});

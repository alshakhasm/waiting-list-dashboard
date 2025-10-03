import { describe, it, expect } from '@jest/globals';
import { getLegend } from '../../src/api/legend';
describe('GET /legend', () => {
    it('should return case type to color map', async () => {
        const legend = getLegend('default');
        expect(Array.isArray(legend)).toBe(true);
        const keys = legend.map(l => l.key);
        expect(keys).toEqual(['case-elective', 'case-urgent', 'case-emergency', 'case-success']);
        for (const item of legend) {
            expect(item).toHaveProperty('label');
            expect(item).toHaveProperty('color');
        }
    });
});

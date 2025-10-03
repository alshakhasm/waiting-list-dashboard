import { describe, it, expect } from '@jest/globals';
import { getLegend } from '../../../src/services/legendService';
import { getTheme } from '../../../src/lib/design/tokens';

describe('Legend consistency', () => {
  it('legend colors/labels match tokens used in UI', () => {
    const theme = getTheme('default');
    const legend = getLegend('default');
    const accentEntry = legend.find((l) => l.key === 'case-elective');
    expect(accentEntry?.color).toBe(theme.palette.accent);
  });
});

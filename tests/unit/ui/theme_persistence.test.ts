import { describe, it, expect, beforeEach } from '@jest/globals';
import { PreferenceService } from '../../../src/services/preferenceService';
import { ThemeManager } from '../../../src/ui/ThemeProvider';

describe('Theme preference persistence', () => {
  beforeEach(() => PreferenceService._reset());

  it('loads and saves via PreferenceService', () => {
    const mgr = new ThemeManager();
    expect(mgr.getState().themeName).toBe('default');
    mgr.setThemeName('high-contrast');
    const mgr2 = new ThemeManager();
    expect(mgr2.getState().themeName).toBe('high-contrast');
  });
});

import { getTheme } from '../lib/design/tokens';

export type LegendEntry = {
  key: string;
  label: string;
  color: string;
};

export function getLegend(themeName: 'default' | 'high-contrast'): LegendEntry[] {
  const palette = getTheme(themeName).palette;
  return [
    { key: 'case-elective', label: 'Elective', color: palette.accent },
    { key: 'case-urgent', label: 'Urgent', color: palette.warning },
    { key: 'case-emergency', label: 'Emergency', color: palette.danger },
    { key: 'case-success', label: 'Completed', color: palette.success },
  ];
}

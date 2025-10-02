import { getTheme } from '../lib/design/tokens';
export function getLegend(themeName) {
    const palette = getTheme(themeName).palette;
    return [
        { key: 'case-elective', label: 'Elective', color: palette.accent },
        { key: 'case-urgent', label: 'Urgent', color: palette.warning },
        { key: 'case-emergency', label: 'Emergency', color: palette.danger },
        { key: 'case-success', label: 'Completed', color: palette.success },
    ];
}

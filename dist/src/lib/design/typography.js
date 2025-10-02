export const typographyPresets = {
    small: { baseFontSizePx: 13, lineHeight: 1.45, scaleRatio: 1.2 },
    medium: { baseFontSizePx: 14, lineHeight: 1.5, scaleRatio: 1.25 },
    large: { baseFontSizePx: 16, lineHeight: 1.55, scaleRatio: 1.25 },
};
export function scale(preset, steps = 0) {
    // Returns font size in px given steps on modular scale
    const size = preset.baseFontSizePx * Math.pow(preset.scaleRatio, steps);
    return Math.round(size * 100) / 100;
}

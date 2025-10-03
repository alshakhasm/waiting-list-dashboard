function luminanceFromHex(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const transform = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const R = transform(r);
  const G = transform(g);
  const B = transform(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const L1 = luminanceFromHex(fgHex);
  const L2 = luminanceFromHex(bgHex);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100; // round to 2 decimals
}

export function meetsContrast(fgHex: string, bgHex: string, threshold = 3): boolean {
  // For UI outlines/icons, 3:1 is a common minimum; text often 4.5:1
  return contrastRatio(fgHex, bgHex) >= threshold;
}

// Small color utilities used across UI components

// Returns a readable text color (white or near-black) for a given hex background color
export function getContrastText(bg: string | undefined): string {
  if (!bg) return 'inherit';
  let hex = bg.trim();
  if (hex.startsWith('var(')) return 'inherit';
  if (hex.startsWith('#')) hex = hex.slice(1);
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  if (hex.length !== 6) return 'inherit';
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const srgb = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  const L = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  return L > 0.6 ? '#0b1220' : '#ffffff';
}

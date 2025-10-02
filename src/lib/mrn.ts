export function maskMRN(mrn: string): string {
  if (!mrn) return '';
  const last4 = mrn.slice(-4);
  return `••••${last4}`;
}

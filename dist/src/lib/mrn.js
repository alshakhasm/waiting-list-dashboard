export function maskMRN(mrn) {
    if (!mrn)
        return '';
    const last4 = mrn.slice(-4);
    return `••••${last4}`;
}

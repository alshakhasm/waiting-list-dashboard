export function saveAsCsv(rows: any[], fileName: string) {
  const headers = collectHeaders(rows);
  const csv = [headers.join(',')]
    .concat(rows.map(r => headers.map(h => escapeCsv(String(r[h] ?? ''))).join(',')))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

function collectHeaders(rows: any[]): string[] {
  const set = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) set.add(k);
  return Array.from(set);
}
function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

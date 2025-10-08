export type ProcedureGroupKey =
  | 'dental'
  | 'minorPath'
  | 'majorPath'
  | 'tmj'
  | 'orthognathic'
  | 'uncategorized';

export const GROUP_LABELS: Record<ProcedureGroupKey, string> = {
  dental: 'Dental extraction',
  minorPath: 'Minor pathology',
  majorPath: 'Major pathology',
  tmj: 'TMJ',
  orthognathic: 'Orthognathic',
  uncategorized: 'Uncategorized',
};

export const GROUP_ORDER: ProcedureGroupKey[] = [
  'dental',
  'minorPath',
  'majorPath',
  'tmj',
  'orthognathic',
  'uncategorized',
];

const keyword = (_s: string) => _s.toLowerCase();

const MATCHERS: Array<{ key: ProcedureGroupKey; match: (p: string) => boolean }> = [
  // TMJ-specific procedures (any TMJ variant)
  {
    key: 'tmj',
    match: (p) => {
      const t = keyword(p);
      return t.includes('tmj');
    },
  },
  {
    key: 'dental',
    match: (p) => {
      const t = keyword(p);
      return (
        t.includes('dental') ||
        t.includes('extraction') ||
        t.includes('tooth') ||
        t.includes('molar')
      );
    },
  },
  {
    key: 'minorPath',
    match: (p) => {
      const t = keyword(p);
      return (
        t.includes('biopsy') ||
        t.includes('excision') ||
        t.includes('lesion') ||
        t.includes('cyst') ||
        t.includes('mucocele')
      );
    },
  },
  {
    key: 'majorPath',
    match: (p) => {
      const t = keyword(p);
      return (
        t.includes('resection') ||
        t.includes('mandibulectomy') ||
        t.includes('maxillectomy') ||
        t.includes('neck dissection') ||
        t.includes('parotidectomy')
      );
    },
  },
  {
    key: 'orthognathic',
    match: (p) => {
      const t = keyword(p);
      return (
        t.includes('orthognathic') ||
        t.includes('le fort') ||
        t.includes('bssro') ||
        t.includes('sagittal split') ||
        t.includes('genioplasty')
      );
    },
  },
];

export function classifyProcedure(procedure: string | undefined | null): ProcedureGroupKey {
  const p = (procedure ?? '').trim();
  if (!p) return 'uncategorized';
  const found = MATCHERS.find((m) => m.match(p));
  return found ? found.key : 'uncategorized';
}

// Optional simple colors per group (can be aligned with /legend later)
export const GROUP_COLORS: Record<ProcedureGroupKey, string> = {
  dental: '#E6F4EA', // light green
  minorPath: '#E8F0FE', // light blue
  majorPath: '#FDE8E8', // light red
  tmj: '#EDE9FE', // light purple
  orthognathic: '#FFF4E5', // light orange
  uncategorized: '#F3F4F6', // light gray
};

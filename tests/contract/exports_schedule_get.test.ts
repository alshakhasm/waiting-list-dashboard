import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb } from '../../src/lib/store';
import { postImportsExcel } from '../../src/api/imports';
import { getWeeklyExport } from '../../src/api/exports';

describe('GET /exports/schedule', () => {
  beforeEach(() => resetDb());

  it('should export schedule with masked MRN', async () => {
    postImportsExcel('seed.xlsx', [
      { patientName: 'F', mrn: '654321', procedure: 'Proc', estDurationMin: 30, caseTypeName: 'case:elective' },
    ]);
    const rows = getWeeklyExport('2025-01-01');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('name');
    expect(rows[0]).toHaveProperty('maskedMrn');
    expect(rows[0].maskedMrn.endsWith('4321')).toBe(true);
  });
});

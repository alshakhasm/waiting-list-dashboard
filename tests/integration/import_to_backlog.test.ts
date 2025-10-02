import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb } from '../../src/lib/store';
import { postImportsExcel } from '../../src/api/imports';
import { listBacklog } from '../../src/api/backlog';

describe('Excel import → backlog items', () => {
  beforeEach(() => resetDb());

  it('should create backlog items with dedup', async () => {
    postImportsExcel('seed.xlsx', [
      { patientName: 'X', mrn: '100200', procedure: 'Proc1', estDurationMin: 30 },
      { patientName: 'X', mrn: '100200', procedure: 'Proc1', estDurationMin: 30 },
      { patientName: 'Y', mrn: '200300', procedure: 'Proc2', estDurationMin: 45 },
    ]);
    const backlog = listBacklog();
    expect(backlog.length).toBe(2);
    const names = backlog.map(b => b.patientName).sort();
    expect(names).toEqual(['X', 'Y']);
  });
});

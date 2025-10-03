import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb } from '../../src/lib/store';
import { createMappingProfile, listMappingProfiles } from '../../src/api/mappingProfiles';

describe('POST /mapping-profiles', () => {
  beforeEach(() => resetDb());

  it('should persist a new mapping profile', async () => {
    const created = createMappingProfile({ name: 'Anesthesia Map', owner: 'admin', fieldMappings: { patient: 'Patient Name' } });
    expect(created.id).toBeTruthy();
    expect(created).toMatchObject({ name: 'Anesthesia Map', owner: 'admin' });
    const all = listMappingProfiles();
    expect(all.find(p => p.id === created.id)).toBeTruthy();
  });
});

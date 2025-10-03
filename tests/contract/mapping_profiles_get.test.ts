import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb } from '../../src/lib/store';
import { listMappingProfiles, createMappingProfile } from '../../src/api/mappingProfiles';

describe('GET /mapping-profiles', () => {
  beforeEach(() => resetDb());

  it('should return array of mapping profiles', async () => {
    createMappingProfile({ name: 'Default', owner: 'ops', fieldMappings: { A: 'a' } });
    createMappingProfile({ name: 'Alt', owner: 'ops', fieldMappings: { B: 'b' } });
    const profiles = listMappingProfiles();
    expect(Array.isArray(profiles)).toBe(true);
    expect(profiles.length).toBe(2);
    expect(profiles[0]).toHaveProperty('id');
    expect(profiles[0]).toMatchObject({ name: expect.any(String), owner: expect.any(String), fieldMappings: expect.any(Object) });
  });
});

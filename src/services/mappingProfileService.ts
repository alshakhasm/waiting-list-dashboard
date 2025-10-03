import { db } from '../lib/store';
import { newId } from '../lib/id';
import type { MappingProfile } from '../models/types';

export const MappingProfileService = {
  list(): MappingProfile[] {
    return Array.from(db.mappings.values());
  },
  create(input: Omit<MappingProfile, 'id'>): MappingProfile {
    const id = newId('mp');
    const profile: MappingProfile = { id, ...input };
    db.mappings.set(id, profile);
    return profile;
  }
};

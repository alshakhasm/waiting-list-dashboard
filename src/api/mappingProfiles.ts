import { MappingProfileService } from '../services/mappingProfileService';
import type { MappingProfile } from '../models/types';

export function listMappingProfiles(): MappingProfile[] {
  return MappingProfileService.list();
}

export function createMappingProfile(input: Omit<MappingProfile, 'id'>): MappingProfile {
  return MappingProfileService.create(input);
}

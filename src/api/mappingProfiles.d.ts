import type { MappingProfile } from '../models/types';
export declare function listMappingProfiles(): MappingProfile[];
export declare function createMappingProfile(input: Omit<MappingProfile, 'id'>): MappingProfile;

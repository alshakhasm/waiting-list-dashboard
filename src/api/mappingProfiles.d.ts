import type { MappingProfile } from '../models/types';
export declare function listMappingProfiles(): MappingProfile[];
export declare function createMappingProfile(_input: Omit<MappingProfile, 'id'>): MappingProfile;

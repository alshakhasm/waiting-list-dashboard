import type { MappingProfile } from '../models/types';
export declare const MappingProfileService: {
    list(): MappingProfile[];
    create(input: Omit<MappingProfile, "id">): MappingProfile;
};

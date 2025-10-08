import type { MappingProfile } from '../models/types';
export declare const MappingProfileService: {
    list(): MappingProfile[];
    create(_input: Omit<MappingProfile, "id">): MappingProfile;
};

import { MappingProfileService } from '../services/mappingProfileService';
export function listMappingProfiles() {
    return MappingProfileService.list();
}
export function createMappingProfile(input) {
    return MappingProfileService.create(input);
}

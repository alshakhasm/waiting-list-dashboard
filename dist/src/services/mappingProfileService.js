import { db } from '../lib/store';
import { newId } from '../lib/id';
export const MappingProfileService = {
    list() {
        return Array.from(db.mappings.values());
    },
    create(input) {
        const id = newId('mp');
        const profile = { id, ...input };
        db.mappings.set(id, profile);
        return profile;
    }
};

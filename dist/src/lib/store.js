export const db = {
    waiting: new Map(),
    schedule: new Map(),
    imports: new Map(),
    caseTypes: new Map(),
};
export function resetDb() {
    db.waiting.clear();
    db.schedule.clear();
    db.imports.clear();
    db.caseTypes.clear();
}

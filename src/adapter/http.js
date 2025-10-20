import { postImportsExcel } from '../api/imports';
import { listBacklog, softRemoveBacklog } from '../api/backlog';
import { deleteSchedule, patchSchedule, postSchedule, getScheduleList } from '../api/schedule';
import { getWeeklyExport } from '../api/exports';
import { getLegend } from '../api/legend';
function match(pattern, path) {
    const pSeg = pattern.split('/').filter(Boolean);
    const aSeg = path.split('/').filter(Boolean);
    if (pSeg.length !== aSeg.length)
        return { ok: false, params: {} };
    const params = {};
    for (let i = 0; i < pSeg.length; i++) {
        const p = pSeg[i];
        const a = aSeg[i];
        if (p.startsWith(':'))
            params[p.slice(1)] = decodeURIComponent(a);
        else if (p !== a)
            return { ok: false, params: {} };
    }
    return { ok: true, params };
}
function ok(body, headers = {}) {
    return { status: 200, body, headers };
}
function created(body) { return { status: 201, body }; }
function noContent() { return { status: 204 }; }
function badRequest(message) { return { status: 400, body: { error: message } }; }
function notFound(message = 'Not Found') { return { status: 404, body: { error: message } }; }
function conflict(message) { return { status: 409, body: { error: message } }; }
function serverError(message) { return { status: 500, body: { error: message } }; }
const routes = [
    // Imports
    {
        method: 'POST', pattern: '/imports/excel', handler: (req) => {
            const body = req.body;
            if (!body || !body.fileName || !Array.isArray(body.rows))
                return badRequest('fileName and rows are required');
            const batch = postImportsExcel(body.fileName, body.rows);
            return created(batch);
        }
    },
    // Backlog
    {
    method: 'GET', pattern: '/backlog', handler: (req) => {
        const { caseTypeId, surgeonId, search } = req.query || {};
        const items = listBacklog({ caseTypeId, surgeonId, search });
        return ok(items);
    }
}, {
    method: 'DELETE', pattern: '/backlog/:id', handler: (_req, params) => {
        const removed = softRemoveBacklog(params.id);
        if (!removed)
            return notFound('Backlog item not found');
        return noContent();
    }
}, 
    // Schedule
    {
        method: 'GET', pattern: '/schedule', handler: (req) => {
            const { date } = req.query || {};
            const entries = getScheduleList(date ? { date } : undefined);
            return ok(entries);
        }
    },
    {
        method: 'POST', pattern: '/schedule', handler: (req) => {
            const body = req.body;
            if (!body || !body.waitingListItemId || !body.roomId || !body.surgeonId || !body.date || !body.startTime || !body.endTime) {
                return badRequest('Missing required schedule fields');
            }
            try {
                const entry = postSchedule({
                    waitingListItemId: body.waitingListItemId,
                    roomId: body.roomId,
                    surgeonId: body.surgeonId,
                    date: body.date,
                    startTime: body.startTime,
                    endTime: body.endTime,
                    notes: body.notes,
                });
                return created(entry);
            }
            catch (e) {
                const msg = e?.message || 'Error creating schedule';
                if (msg.includes('unavailable'))
                    return conflict(msg);
                return serverError(msg);
            }
        }
    },
    {
        method: 'PATCH', pattern: '/schedule/:id', handler: (req, params) => {
            const id = params.id;
            const body = req.body;
            if (!body)
                return badRequest('Missing body');
            try {
                if (typeof body.version === 'number') {
                    const updated = patchSchedule(id, body);
                    return ok(updated);
                }
                const existing = getScheduleList().find(e => e.id === id);
                if (!existing)
                    return notFound('Not found');
                const patch = { version: existing.version };
                if (body.startTime !== undefined)
                    patch.startTime = body.startTime;
                if (body.endTime !== undefined)
                    patch.endTime = body.endTime;
                if (body.status !== undefined)
                    patch.status = body.status;
                if (body.notes !== undefined)
                    patch.notes = body.notes;
                const updated = patchSchedule(id, patch);
                return ok(updated);
            }
            catch (e) {
                const msg = e?.message || 'Error updating schedule';
                if (msg.includes('Not found'))
                    return notFound(msg);
                if (msg.includes('Version conflict'))
                    return conflict(msg);
                return serverError(msg);
            }
        }
    },
    {
        method: 'DELETE', pattern: '/schedule/:id', handler: (_req, params) => {
            deleteSchedule(params.id);
            return noContent();
        }
    },
    // Exports
    {
        method: 'GET', pattern: '/exports/schedule', handler: (req) => {
            const { date = new Date().toISOString().slice(0, 10) } = req.query || {};
            const rows = getWeeklyExport(date);
            return ok(rows);
        }
    },
    // Legend
    {
        method: 'GET', pattern: '/legend', handler: (req) => {
            const theme = req.query?.theme || 'default';
            const legend = getLegend(theme);
            return ok(legend);
        }
    },
];
export async function handleRequest(req) {
    const route = routes.find(r => r.method === req.method && match(r.pattern, req.path).ok);
    if (!route)
        return { status: 404, body: { error: 'Route not found' } };
    const { params } = match(route.pattern, req.path);
    try {
        const res = await route.handler(req, params);
        return res;
    }
    catch (e) {
        return serverError(e?.message || 'Unknown error');
    }
}
export const __routes = routes; // for introspection/testing

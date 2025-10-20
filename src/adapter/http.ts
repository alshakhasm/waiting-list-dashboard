import { postImportsExcel } from '../api/imports';
import { listBacklog, softRemoveBacklog, updateBacklog } from '../api/backlog';
import { deleteSchedule, patchSchedule, postSchedule, getScheduleList } from '../api/schedule';
import { getWeeklyExport } from '../api/exports';
import { getLegend } from '../api/legend';

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type Request = {
  method: Method;
  path: string;
  query?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
  body?: unknown;
};

export type Response<T = any> = {
  status: number;
  body?: T;
  headers?: Record<string, string>;
};

type Handler = (_req: Request, _params: Record<string, string>) => Response | Promise<Response>;

type Route = { method: Method; pattern: string; handler: Handler };

function match(pattern: string, path: string): { ok: boolean; params: Record<string, string> } {
  const pSeg = pattern.split('/').filter(Boolean);
  const aSeg = path.split('/').filter(Boolean);
  if (pSeg.length !== aSeg.length) return { ok: false, params: {} };
  const params: Record<string, string> = {};
  for (let i = 0; i < pSeg.length; i++) {
    const p = pSeg[i];
    const a = aSeg[i];
    if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(a);
    else if (p !== a) return { ok: false, params: {} };
  }
  return { ok: true, params };
}

function ok<T>(body: T, headers: Record<string, string> = {}): Response<T> {
  return { status: 200, body, headers };
}
function created<T>(body: T): Response<T> { return { status: 201, body }; }
function noContent(): Response { return { status: 204 }; }
function badRequest(message: string): Response<{ error: string }> { return { status: 400, body: { error: message } }; }
function notFound(message = 'Not Found'): Response<{ error: string }> { return { status: 404, body: { error: message } }; }
function conflict(message: string): Response<{ error: string }> { return { status: 409, body: { error: message } }; }
function serverError(message: string): Response<{ error: string }> { return { status: 500, body: { error: message } }; }

const routes: Route[] = [
  // Imports
  {
    method: 'POST', pattern: '/imports/excel', handler: (req) => {
      const body = req.body as { fileName?: string; rows?: any[] } | undefined;
      if (!body || !body.fileName || !Array.isArray(body.rows)) return badRequest('fileName and rows are required');
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
  },
  {
    method: 'DELETE', pattern: '/backlog/:id', handler: (_req, params) => {
      const removed = softRemoveBacklog(params.id);
      if (!removed) return notFound('Backlog item not found');
      return noContent();
    }
  },
  {
    method: 'PATCH', pattern: '/backlog/:id', handler: (req, params) => {
      const id = params.id;
      const body = req.body as Partial<{
        patientName: string;
        mrn: string;
        procedure: string;
        estDurationMin: number;
        surgeonId?: string;
        caseTypeId: string;
        phone1?: string;
        phone2?: string;
        preferredDate?: string;
        notes?: string;
      }> | undefined;
      if (!body || Object.keys(body).length === 0) return badRequest('No fields to update');
      const updated = updateBacklog(id, body as any);
      if (!updated) return notFound('Backlog item not found');
      return ok(updated);
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
      const body = req.body as {
        waitingListItemId?: string; roomId?: string; surgeonId?: string; date?: string; startTime?: string; endTime?: string; notes?: string;
      } | undefined;
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
      } catch (e: any) {
        const msg = e?.message || 'Error creating schedule';
        if (msg.includes('future')) return badRequest(msg);
        if (msg.includes('past')) return badRequest(msg);
        if (msg.includes('unavailable')) return conflict(msg);
        return serverError(msg);
      }
    }
  },
  {
    method: 'PATCH', pattern: '/schedule/:id', handler: (req, params) => {
      const id = params.id;
      const body = req.body as { version?: number; startTime?: string; endTime?: string; status?: string; notes?: string } | undefined;
      if (!body) return badRequest('Missing body');
      try {
        if (typeof body.version === 'number') {
          const updated = patchSchedule(id, body as any);
          return ok(updated);
        }
        // Permit simple status/notes updates without explicit version by reading current and applying
        const existing = getScheduleList().find(e => e.id === id);
        if (!existing) return notFound('Not found');
        const patch: any = { version: existing.version };
        if (body.startTime !== undefined) patch.startTime = body.startTime;
        if (body.endTime !== undefined) patch.endTime = body.endTime;
        if (body.status !== undefined) patch.status = body.status as any;
        if (body.notes !== undefined) patch.notes = body.notes;
        const updated = patchSchedule(id, patch);
        return ok(updated);
      } catch (e: any) {
        const msg = e?.message || 'Error updating schedule';
        if (msg.includes('Not found')) return notFound(msg);
        if (msg.includes('Version conflict')) return conflict(msg);
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
      const theme = (req.query?.theme as 'default' | 'high-contrast') || 'default';
      const legend = getLegend(theme);
      return ok(legend);
    }
  },
];

export async function handleRequest(req: Request): Promise<Response> {
  const route = routes.find(r => r.method === req.method && match(r.pattern, req.path).ok);
  if (!route) return { status: 404, body: { error: 'Route not found' } };
  const { params } = match(route.pattern, req.path);
  try {
    const res = await route.handler(req, params);
    return res;
  } catch (e: any) {
    return serverError(e?.message || 'Unknown error');
  }
}

export const __routes = routes; // for introspection/testing

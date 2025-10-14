import { describe, it, expect, beforeEach } from '@jest/globals';
import { handleRequest } from '../../src/index';
import { resetDb, db } from '../../src/lib/store';

describe('HTTP adapter', () => {
  beforeEach(() => resetDb());

  it('routes GET /legend', async () => {
    const res = await handleRequest({ method: 'GET', path: '/legend' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 404 for unknown route', async () => {
    const res = await handleRequest({ method: 'GET', path: '/unknown' });
    expect(res.status).toBe(404);
  });

  it('POST /schedule validates payload', async () => {
    // Missing fields
    const bad = await handleRequest({ method: 'POST', path: '/schedule', body: {} });
    expect(bad.status).toBe(400);
  });

  it('POST /imports/excel and GET /backlog', async () => {
    const imp = await handleRequest({ method: 'POST', path: '/imports/excel', body: { fileName: 'a.xlsx', rows: [ { patientName: 'A', mrn: '1', procedure: 'P', estDurationMin: 10 } ] } });
    expect(imp.status).toBe(201);
    const backlog = await handleRequest({ method: 'GET', path: '/backlog' });
    expect(backlog.status).toBe(200);
    expect(backlog.body.length).toBe(1);
  });

  it('DELETE /backlog/:id removes waiting item from store', async () => {
    await handleRequest({ method: 'POST', path: '/imports/excel', body: { fileName: 'seed.xlsx', rows: [ { patientName: 'A', mrn: '1', procedure: 'P', estDurationMin: 10 } ] } });
    const [id] = Array.from(db.waiting.keys());
    expect(typeof id).toBe('string');
    const res = await handleRequest({ method: 'DELETE', path: `/backlog/${id}` });
    expect(res.status).toBe(204);
    expect(db.waiting.has(id)).toBe(false);
    const after = await handleRequest({ method: 'GET', path: '/backlog' });
    expect(after.body.length).toBe(0);
  });

  it('PATCH /schedule/:id maps version conflict to 409', async () => {
    // seed one waiting item & schedule
    await handleRequest({ method: 'POST', path: '/imports/excel', body: { fileName: 'seed.xlsx', rows: [ { patientName: 'A', mrn: '1', procedure: 'P', estDurationMin: 10, surgeonId: 's:1' } ] } });
    const w = Array.from(db.waiting.values())[0];
    const created = await handleRequest({ method: 'POST', path: '/schedule', body: { waitingListItemId: w.id, roomId: 'or:1', surgeonId: 's:1', date: '2025-01-01', startTime: '08:00', endTime: '09:00' } });
    const id = created.body.id as string;
    const v = created.body.version as number;
    const ok = await handleRequest({ method: 'PATCH', path: `/schedule/${id}`, body: { version: v, startTime: '09:00', endTime: '10:00' } });
    expect(ok.status).toBe(200);
    const conflict = await handleRequest({ method: 'PATCH', path: `/schedule/${id}`, body: { version: v, startTime: '10:00', endTime: '11:00' } });
    expect(conflict.status).toBe(409);
  });
});

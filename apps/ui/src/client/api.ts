// Defer core adapter import to runtime to avoid blocking initial render if dev server fs.allow is strict
async function getHandleRequest(): Promise<(req: any) => Promise<any>> {
  const mod: any = await import('@core');
  return mod.handleRequest as (req: any) => Promise<any>;
}
import { supabase } from '../supabase/client';

export type BacklogItem = {
  id: string; patientName: string; mrn: string; procedure: string; estDurationMin: number; surgeonId?: string; caseTypeId: string; maskedMrn: string;
};

export async function getBacklog(params?: { caseTypeId?: string; surgeonId?: string; search?: string }): Promise<BacklogItem[]> {
  if (supabase) {
    let q = supabase.from('backlog').select('*');
    if (params?.search) {
      // simple ilike filter on patient_name/procedure
      q = q.or(`patient_name.ilike.%${params.search}%,procedure.ilike.%${params.search}%`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      patientName: r.patient_name,
      mrn: r.mrn,
      maskedMrn: r.masked_mrn,
      procedure: r.procedure,
      estDurationMin: r.est_duration_min,
      surgeonId: r.surgeon_id || undefined,
      caseTypeId: r.case_type_id,
    }));
  }
  const url = '/backlog';
  const handleRequest = await getHandleRequest();
  const res = await handleRequest({ method: 'GET', path: url, query: params as any });
  if (res.status !== 200) throw new Error('Failed to fetch backlog');
  return res.body as BacklogItem[];
}

export async function seedDemoData(): Promise<void> {
  // Seed a small demo import
  const rows = [
    { patientName: 'Alice', mrn: '123456', procedure: 'Molar extraction', estDurationMin: 30, caseTypeName: 'case:elective', surgeonId: 's:1' },
    { patientName: 'Bob', mrn: '987654', procedure: 'Lesion excision (minor pathology)', estDurationMin: 40, caseTypeName: 'case:urgent', surgeonId: 's:2' },
    { patientName: 'Carla', mrn: '11119999', procedure: 'Mandibulectomy (major pathology)', estDurationMin: 180, caseTypeName: 'case:elective', surgeonId: 's:1' },
    { patientName: 'Dan', mrn: '22223333', procedure: 'Le Fort I orthognathic', estDurationMin: 150, caseTypeName: 'case:elective', surgeonId: 's:3' },
    { patientName: 'Eve', mrn: '33334444', procedure: 'Appendectomy', estDurationMin: 60, caseTypeName: 'case:elective', surgeonId: 's:4' },
    { patientName: 'Fay', mrn: '44445555', procedure: 'TMJ wash (arthrocentesis)', estDurationMin: 35, caseTypeName: 'case:elective', surgeonId: 's:5' },
    { patientName: 'Gus', mrn: '55556666', procedure: 'TMJ open surgery', estDurationMin: 120, caseTypeName: 'case:elective', surgeonId: 's:6' },
  ];
  if (supabase) {
    // Only seed once: skip if backlog already has any rows
    const { count, error: countErr } = await supabase.from('backlog').select('*', { count: 'exact', head: true });
    if (countErr) throw countErr;
    if ((count ?? 0) > 0) return;
    const mask = (mrn: string) => mrn.replace(/.(?=.{2}$)/g, '•');
    const inserts = rows.map(r => ({
      patient_name: r.patientName,
      mrn: r.mrn,
      masked_mrn: mask(r.mrn),
      procedure: r.procedure,
      est_duration_min: r.estDurationMin,
      surgeon_id: r.surgeonId ?? null,
      case_type_id: r.caseTypeName ?? 'case:elective',
    }));
    const { error } = await supabase.from('backlog').insert(inserts);
    if (error) throw error;
    return;
  }
  const handleRequest = await getHandleRequest();
  await handleRequest({ method: 'POST', path: '/imports/excel', body: { fileName: 'demo.xlsx', rows } });
}

export type ScheduleEntry = {
  id: string; waitingListItemId: string; roomId: string; surgeonId: string; date: string; startTime: string; endTime: string; status: string; notes?: string; version: number;
};

export async function getSchedule(params?: { date?: string }): Promise<ScheduleEntry[]> {
  if (supabase) {
    let q = supabase.from('schedule').select('*');
    if (params?.date) q = q.eq('date', params.date);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      waitingListItemId: r.waiting_list_item_id,
      roomId: r.room_id,
      surgeonId: r.surgeon_id,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time,
      status: r.status || 'tentative',
      version: 1,
      notes: r.notes || undefined,
    }));
  }
  const handleRequest = await getHandleRequest();
  const res = await handleRequest({ method: 'GET', path: '/schedule', query: params as any });
  if (res.status !== 200) throw new Error('Failed to fetch schedule');
  return res.body as ScheduleEntry[];
}

export async function createSchedule(input: { waitingListItemId: string; roomId: string; surgeonId: string; date: string; startTime: string; endTime: string; notes?: string }): Promise<ScheduleEntry> {
  if (supabase) {
    const { data, error } = await supabase.from('schedule').insert({
      waiting_list_item_id: input.waitingListItemId,
      room_id: input.roomId,
      surgeon_id: input.surgeonId,
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      status: 'tentative',
      notes: input.notes ?? null,
    }).select('*').single();
    if (error) throw error;
    return {
      id: data!.id,
      waitingListItemId: data!.waiting_list_item_id,
      roomId: data!.room_id,
      surgeonId: data!.surgeon_id,
      date: data!.date,
      startTime: data!.start_time,
      endTime: data!.end_time,
      status: data!.status,
      version: 1,
      notes: data!.notes || undefined,
    } as ScheduleEntry;
  }
  const handleRequest = await getHandleRequest();
  const res = await handleRequest({ method: 'POST', path: '/schedule', body: input });
  if (res.status !== 201) throw new Error((res.body as any)?.error || 'Failed to create schedule');
  return res.body as ScheduleEntry;
}

export async function confirmSchedule(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('schedule').update({ status: 'confirmed' }).eq('id', id);
    if (error) throw error;
    return;
  }
  const handleRequest = await getHandleRequest();
  await handleRequest({ method: 'PATCH', path: `/schedule/${id}`, body: { status: 'confirmed' } });
}

export async function updateSchedule(id: string, patch: Partial<{ date: string; startTime: string; endTime: string; roomId: string; surgeonId: string; notes: string; status: string }>): Promise<void> {
  if (supabase) {
    const payload: any = {};
    if (patch.date) payload.date = patch.date;
    if (patch.startTime) payload.start_time = patch.startTime;
    if (patch.endTime) payload.end_time = patch.endTime;
    if (patch.roomId) payload.room_id = patch.roomId;
    if (patch.surgeonId) payload.surgeon_id = patch.surgeonId;
    if (patch.notes !== undefined) payload.notes = patch.notes;
    if (patch.status) payload.status = patch.status;
    const { error } = await supabase.from('schedule').update(payload).eq('id', id);
    if (error) throw error;
    return;
  }
  const handleRequest = await getHandleRequest();
  await handleRequest({ method: 'PATCH', path: `/schedule/${id}`, body: patch as any });
}

export async function deleteSchedule(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('schedule').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const handleRequest = await getHandleRequest();
  await handleRequest({ method: 'DELETE', path: `/schedule/${id}` });
}

export type MappingProfile = { id: string; name: string; owner: string; fieldMappings: Record<string, string> };
export async function listMappingProfiles(): Promise<MappingProfile[]> {
  const handleRequest = await getHandleRequest();
  const res = await handleRequest({ method: 'GET', path: '/mapping-profiles' });
  if (res.status !== 200) throw new Error('Failed to list mapping profiles');
  return res.body as MappingProfile[];
}
export async function createMappingProfile(body: { name: string; owner: string; fieldMappings: Record<string, string> }): Promise<MappingProfile> {
  const handleRequest = await getHandleRequest();
  const res = await handleRequest({ method: 'POST', path: '/mapping-profiles', body });
  if (res.status !== 201) throw new Error('Failed to create mapping profile');
  return res.body as MappingProfile;
}

export type LegendEntry = { key: string; label: string; color: string };
export async function getLegend(theme: 'default' | 'high-contrast' = 'default'): Promise<LegendEntry[]> {
  const handleRequest = await getHandleRequest();
  const res = await handleRequest({ method: 'GET', path: '/legend', query: { theme } });
  if (res.status !== 200) throw new Error('Failed to load legend');
  return res.body as LegendEntry[];
}

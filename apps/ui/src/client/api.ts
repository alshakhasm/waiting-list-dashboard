// Defer core adapter import to runtime to avoid blocking initial render if dev server fs.allow is strict
async function getHandleRequest(): Promise<(_req: any) => Promise<any>> {
  const mod: any = await import('@core');
  return mod.handleRequest as (_req: any) => Promise<any>;
}
import { supabase } from '../supabase/client';

export type BacklogItem = {
  id: string;
  patientName: string;
  mrn: string;
  maskedMrn: string;
  procedure: string;
  estDurationMin: number;
  surgeonId?: string;
  caseTypeId: string;
  phone1?: string;
  phone2?: string;
  preferredDate?: string; // YYYY-MM-DD
  notes?: string;
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
      phone1: r.phone1 || undefined,
      phone2: r.phone2 || undefined,
      preferredDate: r.preferred_date || undefined,
      notes: r.notes || undefined,
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
    const { error } = await (supabase as any).from('backlog').insert(inserts);
    if (error) {
      const msg = String((error as any)?.message || '');
      // If RLS prevents inserts (e.g., no backlog insert policy), ignore and continue without demo data
      if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('permission denied')) {
        console.warn('[seedDemoData] skipped due to RLS/permissions');
        return;
      }
      throw error;
    }
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
    const { data, error } = await (supabase as any).from('schedule').insert({
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
    const { error } = await (supabase as any).from('schedule').update({ status: 'confirmed' }).eq('id', id);
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
    const { error } = await (supabase as any).from('schedule').update(payload).eq('id', id);
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

// Legend API removed per request

// --- Access control: app users & invitations (MVP manual link) ---

export type AppUser = {
  userId: string;
  email: string;
  role: 'owner' | 'member';
  status: 'approved' | 'pending' | 'revoked';
  invitedBy?: string | null;
};

export type Invitation = {
  id: string;
  email: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string; // ISO
  invitedBy: string;
};

export async function getCurrentAppUser(): Promise<AppUser | null> {
  if (!supabase) return { userId: 'guest', email: 'guest@example.com', role: 'owner', status: 'approved' };
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.from('app_users').select('*').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r: any = data as any;
  return {
    userId: r.user_id,
    email: r.email,
    role: r.role,
    status: r.status,
    invitedBy: r.invited_by,
  } as AppUser;
}

export async function hasAnyAppUsers(): Promise<boolean> {
  if (!supabase) return false;
  // Prefer RPC that works even when no auth row exists and under RLS
  const { data, error } = await (supabase as any).rpc('app_users_is_empty');
  if (error) throw error as any;
  // data: true => empty, so hasAny = !data
  return data === true ? false : true;
}

export async function ensureBootstrapOwner(): Promise<void> {
  if (!supabase) return;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  const email = auth.user?.email ?? '';
  if (!uid) return;
  // First try to bootstrap if empty; then ensure a membership; owner can be explicitly requested by UI
  const { error: rpcErr } = await (supabase as any).rpc('app_users_bootstrap_owner');
  if (rpcErr && !String(rpcErr.message || '').includes('not authenticated')) {
    // ignore non-critical bootstrap errors (e.g., function exists but not empty)
  }
  const { data: me, error: meErr } = await supabase.from('app_users').select('*').eq('user_id', uid).maybeSingle();
  if (meErr) throw meErr;
  // Do not auto-insert pending member to avoid RLS issues.
  // Membership should be created via Create Account (becomeOwner) or Accept Invite.
}

// Explicitly become owner (user-initiated action)
export async function becomeOwner(): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('Not authenticated');
  const { error } = await (supabase as any).rpc('app_users_become_owner');
  if (error) {
    try { (window as any).__LAST_BECOME_OWNER_ERROR__ = error; console.error('[becomeOwner] RPC failed', error); } catch {}
    throw error;
  }
}

export async function inviteByEmail(email: string): Promise<Invitation> {
  if (!supabase) throw new Error('Invites require Supabase to be configured');
  const { data: auth } = await supabase.auth.getUser();
  const inviter = auth.user?.id;
  if (!inviter) throw new Error('Not authenticated');
  // random token
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const expires_at = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await (supabase as any)
    .from('invitations')
    .insert({ email, token, invited_by: inviter, expires_at })
    .select('*')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    email: data.email,
    token: data.token,
    status: data.status,
    expiresAt: data.expires_at,
    invitedBy: data.invited_by,
  } as Invitation;
}

export async function listInvitations(): Promise<Invitation[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('invitations').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({ id: r.id, email: r.email, token: r.token, status: r.status, expiresAt: r.expires_at, invitedBy: r.invited_by }));
}

export async function listMembers(): Promise<AppUser[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('app_users').select('*');
  if (error) throw error;
  return (data || []).map((r: any) => ({ userId: r.user_id, email: r.email, role: r.role, status: r.status, invitedBy: r.invited_by }));
}

export async function updateMember(userId: string, patch: Partial<{ status: AppUser['status']; role: AppUser['role'] }>): Promise<void> {
  if (!supabase) return;
  const payload: any = {};
  if (patch.status) payload.status = patch.status;
  if (patch.role) payload.role = patch.role;
  const { error } = await (supabase as any).from('app_users').update(payload).eq('user_id', userId);
  if (error) throw error;
}

export async function acceptInvite(token: string): Promise<{ ok: boolean; reason?: string }> {
  if (!supabase) return { ok: false, reason: 'Supabase not configured' };
  const nowIso = new Date().toISOString();
  const { data: inv, error } = await supabase.from('invitations').select('*').eq('token', token).maybeSingle();
  if (error) throw error;
  if (!inv) return { ok: false, reason: 'invalid' };
  const invRow: any = inv as any;
  if (invRow.status !== 'pending') return { ok: false, reason: 'used' };
  if (invRow.expires_at && invRow.expires_at < nowIso) return { ok: false, reason: 'expired' };
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  const email = auth.user?.email ?? '';
  if (!uid) return { ok: false, reason: 'unauthenticated' };
  if (email.toLowerCase() !== String(invRow.email).toLowerCase()) return { ok: false, reason: 'email-mismatch' };
  // mark accepted and upsert app_users (pending member)
  const { error: upErr } = await (supabase as any).from('invitations').update({ status: 'accepted' }).eq('id', invRow.id);
  if (upErr) throw upErr;
  const { data: existing, error: exErr } = await supabase.from('app_users').select('*').eq('user_id', uid).maybeSingle();
  if (exErr) throw exErr;
  if (!existing) {
    const { error: insErr } = await (supabase as any).from('app_users').insert({ user_id: uid, email, role: 'member', status: 'pending', invited_by: invRow.invited_by });
    if (insErr) throw insErr;
  }
  return { ok: true };
}

// Defer core adapter import to runtime to avoid blocking initial render if dev server fs.allow is strict
// @core is only available in production builds; dev mode uses a stub
async function getHandleRequest(): Promise<(_req: any) => Promise<any>> {
  // Return a stub that works in dev; @core is not available until production build
  const stub = async () => ({ error: 'Backend not available in dev mode' });
  if (typeof window !== 'undefined' && !window.location.hostname.includes('github')) {
    return stub;
  }
  // Try to load @core only in production
  try {
    // Use string concatenation to avoid static analysis errors
    const moduleName = '@' + 'core';
    const mod: any = await import(moduleName);
    return mod.handleRequest as (_req: any) => Promise<any>;
  } catch (e) {
    console.debug('[getHandleRequest] @core not available', e);
    return stub;
  }
}
import { supabase } from '../supabase/client';

const LOCAL_SOFT_REMOVED_KEY = 'backlog.softRemoved.v1';

function readSoftRemovedSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(LOCAL_SOFT_REMOVED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id: any) => typeof id === 'string' && id));
  } catch {
    return new Set();
  }
}

function writeSoftRemovedSet(set: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_SOFT_REMOVED_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

function rememberSoftRemovedId(id: string) {
  if (!id) return;
  const set = readSoftRemovedSet();
  if (!set.has(id)) {
    set.add(id);
    writeSoftRemovedSet(set);
  }
}

function getSoftRemovedSet(existingIds: Iterable<string>): Set<string> {
  const set = readSoftRemovedSet();
  const existing = new Set(existingIds);
  let changed = false;
  for (const id of Array.from(set)) {
    if (!existing.has(id)) {
      set.delete(id);
      changed = true;
    }
  }
  if (changed) writeSoftRemovedSet(set);
  return set;
}

function filterLocallyRemoved<T extends { id: string }>(items: T[]): T[] {
  const suppressed = getSoftRemovedSet(items.map((item) => item.id));
  if (suppressed.size === 0) return items;
  return items.filter((item) => !suppressed.has(item.id));
}

// --- Debug helpers ---
export async function debugCurrentAccess(): Promise<{
  authUserId: string | null;
  authEmail: string | null;
  appUserById: any | null;
  appUsersByEmail: Array<{ user_id: string; email: string; role: AppUser['role']; status: AppUser['status']; created_at?: string }>;
}> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return { authUserId: null, authEmail: null, appUserById: null, appUsersByEmail: [] };
  }
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? null;
  const email = auth.user?.email ?? null;
  let byId: any = null;
  if (uid) {
    const { data } = await supabase.from('app_users').select('*').eq('user_id', uid).maybeSingle();
    byId = data || null;
  }
  let byEmail: any[] = [];
  if (email) {
    const { data } = await supabase.from('app_users').select('*').ilike('email', email); // case-insensitive exact
    byEmail = data || [];
  }
  const compact = (r: any) => r ? { user_id: r.user_id, email: r.email, role: r.role, status: r.status, created_at: r.created_at } : null;
  console.log('[debugCurrentAccess] auth uid:', uid, 'email:', email);
  console.log('[debugCurrentAccess] app_users by user_id:', compact(byId));
  console.table((byEmail || []).map(compact));
  return {
    authUserId: uid,
    authEmail: email,
    appUserById: compact(byId),
    appUsersByEmail: (byEmail || []).map(compact).filter(Boolean) as any,
  };
}

function emitDashboardChange() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('dashboard-data-changed'));
  } catch {}
}

try {
  if (typeof window !== 'undefined') {
    (window as any).appDebug = { ...(window as any).appDebug, debugCurrentAccess };
    // Attach a small helper to dump backlog items and their category keys
    (window as any).appDebug.dumpBacklogWithCategories = async () => {
      try {
        const items = await getBacklog();
        console.table((items || []).map(i => ({ id: i.id, patientName: i.patientName, categoryKey: i.categoryKey })));
        return items;
      } catch (e) {
        console.error('dumpBacklogWithCategories failed', e);
        throw e;
      }
    };
    // Expose persisted category prefs for debugging
    (window as any).appDebug.dumpCategoryPrefs = () => {
      try {
        const raw = localStorage.getItem('category-prefs-v1');
        console.log('[dumpCategoryPrefs] raw:', raw);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        console.table((parsed || []).map((p: any) => ({ key: p.key, label: p.label, color: p.color, hidden: p.hidden })));
        return parsed;
      } catch (e) {
        console.error('dumpCategoryPrefs failed', e);
        return null;
      }
    };
  }
} catch {}
export type BacklogItem = {
  id: string;
  patientName: string;
  mrn: string;
  maskedMrn: string;
  procedure: string;
  // allow built-in and custom category keys
  categoryKey?: string;
  estDurationMin: number;
  surgeonId?: string;
  caseTypeId: string;
  phone1?: string;
  phone2?: string;
  preferredDate?: string; // YYYY-MM-DD
  notes?: string;
  isRemoved?: boolean;
  createdAt?: string;
};

// Capability flag remembered during session: whether the DB has backlog.is_removed
let HAS_BACKLOG_IS_REMOVED: boolean | null = null;

// --- Data hygiene helpers ---
function normalizeMrn(mrn: string): string {
  return (mrn || '').replace(/\D+/g, '');
}
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D+/g, '');
  return digits || null;
}
function getDefaultSurgeonId(): string {
  try {
    const v = localStorage.getItem('cfg.defaultSurgeonId');
    if (v && v.trim()) return v.trim();
  } catch {}
  return 's:1';
}

export async function getBacklog(params?: { caseTypeId?: string; surgeonId?: string; search?: string }): Promise<BacklogItem[]> {
  if (supabase) {
    // Prefer filtering out soft-removed rows if column exists; otherwise, retry without the filter
    let data: any[] | null = null;
    let error: any = null;
    if (HAS_BACKLOG_IS_REMOVED !== false) {
      try {
          let q = supabase.from('backlog').select('*').eq('is_removed', false);
        if (params?.search) q = q.or(`patient_name.ilike.%${params.search}%,procedure.ilike.%${params.search}%`);
        const res = await q;
        data = res.data as any[];
        error = res.error;
        if (!error) HAS_BACKLOG_IS_REMOVED = true;
      } catch (e: any) {
        error = e;
      }
      // If column missing, retry without filter
      if (error && /column\s+backlog\.is_removed\s+does not exist/i.test(String(error.message || ''))) {
        HAS_BACKLOG_IS_REMOVED = false;
          // Fallback: hide rows marked as removed via notes marker
          let q2 = supabase.from('backlog').select('*').not('notes','ilike','removed@%');
          if (params?.search) q2 = q2.or(`patient_name.ilike.%${params.search}%,procedure.ilike.%${params.search}%`);
          const res2 = await q2;
        data = res2.data as any[];
        error = res2.error;
      }
    } else {
      // When we know the is_removed column is absent, exclude rows tagged as removed via notes
      let q = supabase.from('backlog').select('*').not('notes','ilike','removed@%');
      if (params?.search) q = q.or(`patient_name.ilike.%${params.search}%,procedure.ilike.%${params.search}%`);
      const res = await q;
      data = res.data as any[];
      error = res.error;
    }
    if (error) throw error;
    const sanitized = (data || []).filter((r: any) => {
      // Always hide rows that were soft-removed, whether flagged via column or legacy note marker
      const note = typeof r?.notes === 'string' ? r.notes : '';
      if (/^removed@/i.test(note.trim())) return false;
      if (r?.is_removed === true) return false;
      return true;
    });
    const mapped = sanitized.map((r: any) => ({
      id: r.id,
      patientName: r.patient_name,
      mrn: r.mrn,
      maskedMrn: r.masked_mrn,
      procedure: r.procedure,
      categoryKey: r.category_key || undefined,
      estDurationMin: r.est_duration_min,
      surgeonId: r.surgeon_id || undefined,
      caseTypeId: r.case_type_id,
      phone1: r.phone1 || undefined,
      phone2: r.phone2 || undefined,
      preferredDate: r.preferred_date || undefined,
        notes: r.notes || undefined,
        // Consider row removed if boolean flag is true, or (fallback) notes starts with our marker
        isRemoved: Boolean(r.is_removed) || (typeof r.notes === 'string' && /^removed@/i.test(r.notes)),
      createdAt: r.created_at || undefined,
    }));
    return filterLocallyRemoved(mapped);
  }
  const url = '/backlog';
  const handleRequest = await getHandleRequest();
  const res = await handleRequest({ method: 'GET', path: url, query: params as any });
  if (res.status !== 200) throw new Error('Failed to fetch backlog');
  return filterLocallyRemoved(res.body as BacklogItem[]);
}

export async function createBacklogItem(input: {
  patientName: string;
  mrn: string;
  procedure: string;
  categoryKey?: string;
  estDurationMin: number;
  caseTypeId?: string;
  surgeonId?: string;
  phone1?: string;
  phone2?: string;
  preferredDate?: string; // YYYY-MM-DD
  notes?: string;
}): Promise<BacklogItem> {
  if (!supabase) throw new Error('Supabase not configured');
  // Ensure auth session is loaded so the client will attach the Authorization header.
  try {
    // This is a no-op if the session is already available, but forces supabase-js to refresh internal state.
    const sess = await (supabase as any).auth.getSession();
    if (!sess?.data?.session) {
      console.warn('[createBacklogItem] no active auth session');
    }
  } catch (e) {
    // Ignore — proceed to attempt the insert which will fail with a permission error if unauthenticated.
    console.warn('[createBacklogItem] failed to load session', e);
  }
  const mask = (mrn: string) => mrn.replace(/.(?=.{2}$)/g, '•');
  const cleanMrn = normalizeMrn(input.mrn);
  const payload: any = {
    patient_name: input.patientName,
    mrn: cleanMrn,
    masked_mrn: mask(cleanMrn),
    procedure: input.procedure,
  category_key: input.categoryKey ?? null,
    est_duration_min: input.estDurationMin,
  surgeon_id: (input.surgeonId ?? getDefaultSurgeonId()),
    case_type_id: input.caseTypeId ?? 'case:elective',
    phone1: normalizePhone(input.phone1) ?? null,
    phone2: normalizePhone(input.phone2) ?? null,
    preferred_date: input.preferredDate ?? null,
    notes: input.notes ?? null,
  };
  const { data, error } = await (supabase as any).from('backlog').insert(payload).select('*').single();
  if (error) {
    const msg = String((error as any)?.message || '');
    // If direct insert is blocked by RLS, fallback to RPC that runs as SECURITY DEFINER
    if (/row-level security|new row violates row-level security policy/i.test(msg)) {
      try {
        const rpcParams: any = {
          p_patient_name: payload.patient_name,
          p_mrn: payload.mrn,
          p_procedure: payload.procedure,
          p_phone1: payload.phone1,
          p_phone2: payload.phone2,
          p_notes: payload.notes,
          // ensure we send a trimmed non-empty string or null so server preserves legitimate custom keys
          p_category_key: (typeof payload.category_key === 'string' && payload.category_key.trim() !== '') ? payload.category_key.trim() : null,
          p_case_type_id: payload.case_type_id,
          p_est_duration_min: payload.est_duration_min,
          p_surgeon_id: payload.surgeon_id,
        };
        // Debug: log that we're using the RPC fallback and which category key we're sending
        try { console.debug('[createBacklogItem] RPC fallback submit_backlog_user params', { p_category_key: rpcParams.p_category_key }); } catch {}
        const { data: rpcData, error: rpcErr } = await (supabase as any).rpc('submit_backlog_user', rpcParams as any);
        if (rpcErr) throw rpcErr;
        // rpcData may be the returned id or an array/record; normalize to id
        const returnedId = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        // Fetch the inserted row by id
        const { data: fetched, error: fetchErr } = await (supabase as any).from('backlog').select('*').eq('id', returnedId).maybeSingle();
        if (fetchErr) throw fetchErr;
        const row = fetched;
        const out: BacklogItem = {
          id: row.id,
          patientName: row.patient_name,
          mrn: row.mrn,
          maskedMrn: row.masked_mrn,
          procedure: row.procedure,
          categoryKey: row.category_key || undefined,
          estDurationMin: row.est_duration_min,
          surgeonId: row.surgeon_id || undefined,
          caseTypeId: row.case_type_id,
          phone1: row.phone1 || undefined,
          phone2: row.phone2 || undefined,
          preferredDate: row.preferred_date || undefined,
          notes: row.notes || undefined,
          isRemoved: row.is_removed || false,
        };
        emitDashboardChange();
        return out;
      } catch (rpcFallbackErr) {
        throw rpcFallbackErr;
      }
    }
    throw error;
  }
  const result: BacklogItem = {
    id: data.id,
    patientName: data.patient_name,
    mrn: data.mrn,
    maskedMrn: data.masked_mrn,
    procedure: data.procedure,
    categoryKey: data.category_key || undefined,
    estDurationMin: data.est_duration_min,
    surgeonId: data.surgeon_id || undefined,
    caseTypeId: data.case_type_id,
    phone1: data.phone1 || undefined,
    phone2: data.phone2 || undefined,
    preferredDate: data.preferred_date || undefined,
    notes: data.notes || undefined,
    isRemoved: data.is_removed || false,
  };
  emitDashboardChange();
  return result;
}

function coerceSupabaseDate(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return String(value ?? '').slice(0, 10);
  }
}

function coerceSupabaseTime(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 5);
  if (value instanceof Date) return value.toISOString().slice(11, 16);
  const str = String(value ?? '');
  return str.includes(':') ? str.slice(0, 5) : str;
}

export type ScheduleEntry = {
  id: string;
  waitingListItemId: string;
  roomId: string;
  surgeonId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
  version: number;
  updatedAt?: string;
  patientName?: string;
  procedure?: string;
  maskedMrn?: string;
};

function statusWeight(status: string | undefined): number {
  const normalized = (status || '').toLowerCase();
  switch (normalized) {
    case 'operated':
      return 5;
    case 'completed':
      return 4;
    case 'confirmed':
      return 3;
    case 'scheduled':
      return 2;
    case 'tentative':
      return 1;
    default:
      return 0;
  }
}

function chooseNewerEntry(a: ScheduleEntry | undefined, b: ScheduleEntry): ScheduleEntry {
  if (!a) return b;
  const weightA = statusWeight(a.status);
  const weightB = statusWeight(b.status);
  if (weightA !== weightB) return weightB >= weightA ? b : a;
  const score = (e: ScheduleEntry) => {
    const t = e.updatedAt ? Date.parse(e.updatedAt) : NaN;
    if (!Number.isNaN(t)) return t;
    return e.version ?? 0;
  };
  return score(b) >= score(a) ? b : a;
}

function dedupeSchedule(entries: ScheduleEntry[]): ScheduleEntry[] {
  const map = new Map<string, ScheduleEntry>();
  for (const entry of entries) {
    const key = entry.waitingListItemId || `__${entry.id}`;
    map.set(key, chooseNewerEntry(map.get(key), entry));
  }
  return Array.from(map.values());
}

function mapScheduleRow(row: any, fallbackStatus: string = 'tentative'): ScheduleEntry {
  const backlog = row?.backlog || row?.backlog_row || null;
  const entry: ScheduleEntry = {
    id: row.id,
    waitingListItemId: row.waiting_list_item_id,
    roomId: row.room_id,
    surgeonId: row.surgeon_id,
    date: coerceSupabaseDate(row.date),
    startTime: coerceSupabaseTime(row.start_time),
    endTime: coerceSupabaseTime(row.end_time),
    status: (row.status as string | null | undefined) || fallbackStatus,
    version: (row.version as number | undefined) ?? 1,
    notes: row.notes || undefined,
    updatedAt: row.updated_at || row.created_at || undefined,
  };
  if (backlog && typeof backlog === 'object') {
    entry.patientName = backlog.patient_name ?? backlog.patientName ?? entry.patientName;
    entry.procedure = backlog.procedure ?? backlog.last_procedure ?? entry.procedure;
    entry.maskedMrn = backlog.masked_mrn ?? backlog.maskedMrn ?? entry.maskedMrn;
    if (!entry.surgeonId && backlog.surgeon_id) entry.surgeonId = backlog.surgeon_id;
    if (!entry.notes && backlog.notes) entry.notes = backlog.notes;
  }
  return entry;
}

export async function getSchedule(params?: { date?: string }): Promise<ScheduleEntry[]> {
  if (supabase) {
    let q = supabase.from('schedule').select('*');
    if (params?.date) {
      const start = params.date;
      const endIso = (() => {
        try {
          const d = new Date(`${start}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() + 1);
          return d.toISOString();
        } catch {
          return start;
        }
      })();
      q = q.gte('date', start).lt('date', endIso);
    }
    const { data, error } = await q;
    if (error) throw error;
    const mapped = (data || []).map((row: any) => mapScheduleRow(row));
    return dedupeSchedule(mapped);
  }
  const handleRequest = await getHandleRequest();
  const res = await handleRequest({ method: 'GET', path: '/schedule', query: params as any });
  if (res.status !== 200) throw new Error('Failed to fetch schedule');
  return dedupeSchedule(res.body as ScheduleEntry[]);
}

export async function getScheduleRange(params: { start: string; end: string }): Promise<ScheduleEntry[]> {
  if (supabase) {
    const { data, error } = await (supabase as any)
      .from('schedule')
      .select('*, backlog:backlog ( patient_name, procedure, masked_mrn, surgeon_id, notes )')
      .gte('date', params.start)
      .lt('date', params.end);
    if (error) throw error;
    return dedupeSchedule((data || []).map((row: any) => mapScheduleRow(row)));
  }
  const all = await getSchedule();
  return all.filter(entry => entry.date >= params.start && entry.date < params.end);
}

export async function createSchedule(input: { waitingListItemId: string; roomId: string; surgeonId: string; date: string; startTime: string; endTime: string; notes?: string }): Promise<ScheduleEntry> {
  const today = new Date().toISOString().slice(0, 10);
  if (input.date <= today) {
    throw new Error('Scheduled date must be in the future');
  }
  if (supabase) {
    const mapRow = (row: any): ScheduleEntry => mapScheduleRow(row, 'scheduled');
    const { data: existingRows, error: existingError } = await (supabase as any)
      .from('schedule')
      .select('*')
      .eq('waiting_list_item_id', input.waitingListItemId);
    if (existingError) throw existingError;
    const rows = existingRows || [];
    const existing = rows.find((row: any) => row.status !== 'cancelled') || rows[0] || null;
    const duplicates = rows.filter((row: any) => !existing || row.id !== existing.id);
    if (duplicates.length > 0) {
      const { error: cleanupError } = await (supabase as any)
        .from('schedule')
        .delete()
        .in('id', duplicates.map((row: any) => row.id));
      if (cleanupError) throw cleanupError;
    }
    if (existing) {
      const nextStatus = existing.status === 'operated'
        ? 'operated'
        : existing.status === 'confirmed'
          ? 'confirmed'
          : 'scheduled';
      const payload: Record<string, any> = {
        room_id: input.roomId,
        surgeon_id: input.surgeonId,
        date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        status: nextStatus,
        notes: input.notes ?? existing.notes ?? null,
      };
      const { data, error } = await (supabase as any)
        .from('schedule')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      const out = mapRow(data);
      emitDashboardChange();
      return out;
    }
    const { data, error } = await (supabase as any).from('schedule').insert({
      waiting_list_item_id: input.waitingListItemId,
      room_id: input.roomId,
      surgeon_id: input.surgeonId,
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      status: 'scheduled',
      notes: input.notes ?? null,
    }).select('*').single();
    if (error) throw error;
    const out = mapRow(data);
    emitDashboardChange();
    return out;
  }
  const handleRequest = await getHandleRequest();
  const res = await handleRequest({ method: 'POST', path: '/schedule', body: input });
  if (res.status !== 201) throw new Error((res.body as any)?.error || 'Failed to create schedule');
  emitDashboardChange();
  return res.body as ScheduleEntry;
}

export async function confirmSchedule(id: string): Promise<void> {
  if (supabase) {
    const { error } = await (supabase as any).from('schedule').update({ status: 'confirmed' }).eq('id', id);
    if (error) throw error;
    emitDashboardChange();
    return;
  }
  const handleRequest = await getHandleRequest();
  await handleRequest({ method: 'PATCH', path: `/schedule/${id}`, body: { status: 'confirmed' } });
  emitDashboardChange();
}

export async function markScheduleOperated(id: string, operated: boolean): Promise<void> {
  if (supabase) {
    const status = operated ? 'operated' : 'confirmed';
    const { data, error } = await (supabase as any)
      .from('schedule')
      .update({ status })
      .eq('id', id)
      .select('waiting_list_item_id')
      .single();
    if (error) throw error;
    const waitingId = data?.waiting_list_item_id;
    if (waitingId) {
      try {
        const { error: rpcError } = await (supabase as any)
          .rpc('backlog_set_removed', { p_id: waitingId, p_removed: operated });
        if (rpcError) console.warn('[markScheduleOperated] backlog_set_removed failed', rpcError);
      } catch (e) {
        console.warn('[markScheduleOperated] failed to sync backlog removal flag:', e);
      }
    }
    emitDashboardChange();
    return;
  }
  const handleRequest = await getHandleRequest();
  await handleRequest({ method: 'PATCH', path: `/schedule/${id}`, body: { status: operated ? 'operated' : 'confirmed' } });
  emitDashboardChange();
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
    emitDashboardChange();
    return;
  }
  const handleRequest = await getHandleRequest();
  await handleRequest({ method: 'PATCH', path: `/schedule/${id}`, body: patch as any });
  emitDashboardChange();
}

export type ArchivedPatient = {
  mrn: string;
  lastPatientName?: string;
  firstSeenAt: string; // ISO
  lastSeenAt: string; // ISO
  totalBacklogEntries: number;
  lastCategoryKey?: BacklogItem['categoryKey'];
  lastCaseTypeId?: string;
  lastProcedure?: string;
};

export async function getArchivedPatients(params?: { search?: string }): Promise<ArchivedPatient[]> {
  if (!supabase) throw new Error('Supabase not configured');
  let q = supabase.from('patients_archive').select('*');
  if (params?.search) {
    q = q.or(`mrn.ilike.%${params.search}%,last_patient_name.ilike.%${params.search}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((r: any) => ({
    mrn: r.mrn,
    lastPatientName: r.last_patient_name || undefined,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    totalBacklogEntries: r.total_backlog_entries ?? 0,
    lastCategoryKey: r.last_category_key || undefined,
    lastCaseTypeId: r.last_case_type_id || undefined,
    lastProcedure: r.last_procedure || undefined,
  }));
}

export async function softRemoveBacklogItem(id: string): Promise<void> {
  if (supabase) {
    // Try soft-delete flag; fallback to notes marker if column missing
    if (HAS_BACKLOG_IS_REMOVED !== false) {
      const { error } = await (supabase as any).from('backlog').update({ is_removed: true }).eq('id', id);
      if (error) {
        if (/column\s+backlog\.is_removed\s+does not exist/i.test(String(error.message || ''))) {
          HAS_BACKLOG_IS_REMOVED = false;
        } else {
          rememberSoftRemovedId(id);
          throw error;
        }
      } else {
        HAS_BACKLOG_IS_REMOVED = true;
        rememberSoftRemovedId(id);
        emitDashboardChange();
        return;
      }
    }
    // Fallback path: mark removal in notes
    const marker = `removed@${new Date().toISOString()}`;
    const { error: e2 } = await (supabase as any).from('backlog').update({ notes: marker }).eq('id', id);
    if (e2) {
      rememberSoftRemovedId(id);
      throw e2;
    }
    rememberSoftRemovedId(id);
    emitDashboardChange();
    return;
  }
  const handleRequest = await getHandleRequest();
  const res = await handleRequest({ method: 'DELETE', path: `/backlog/${id}` });
  if (res.status !== 204) {
    rememberSoftRemovedId(id);
    throw new Error((res.body && (res.body as any).error) || 'Failed to remove backlog item');
  }
  rememberSoftRemovedId(id);
  emitDashboardChange();
}

export async function updateBacklogItem(id: string, patch: Partial<{
  phone1: string | null;
  phone2: string | null;
  notes: string | null;
}>): Promise<BacklogItem> {
  const payload: any = {};
  if ('phone1' in patch) payload.phone1 = normalizePhone(patch.phone1 ?? null);
  if ('phone2' in patch) payload.phone2 = normalizePhone(patch.phone2 ?? null);
  if ('notes' in patch) payload.notes = patch.notes ?? null;
  if (supabase) {
    const { data, error } = await (supabase as any)
      .from('backlog')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    const out: BacklogItem = {
      id: data.id,
      patientName: data.patient_name,
      mrn: data.mrn,
      maskedMrn: data.masked_mrn,
      procedure: data.procedure,
      categoryKey: data.category_key || undefined,
      estDurationMin: data.est_duration_min,
      surgeonId: data.surgeon_id || undefined,
      caseTypeId: data.case_type_id,
      phone1: data.phone1 || undefined,
      phone2: data.phone2 || undefined,
      preferredDate: data.preferred_date || undefined,
      notes: data.notes || undefined,
      isRemoved: data.is_removed || false,
      createdAt: data.created_at || undefined,
    };
    emitDashboardChange();
    return out;
  }
  const handleRequest = await getHandleRequest();
  const res = await handleRequest({ method: 'PATCH', path: `/backlog/${id}`, body: payload });
  if (res.status !== 200) throw new Error((res.body && (res.body as any).error) || 'Failed to update backlog item');
  const r = res.body as any;
  const out = {
    id: r.id,
    patientName: r.patientName,
    mrn: r.mrn,
    maskedMrn: r.maskedMrn || (r.mrn ? `••••${String(r.mrn).slice(-4)}` : ''),
    procedure: r.procedure,
    categoryKey: r.categoryKey || undefined,
    estDurationMin: r.estDurationMin,
    surgeonId: r.surgeonId || undefined,
    caseTypeId: r.caseTypeId,
    phone1: r.phone1 || undefined,
    phone2: r.phone2 || undefined,
    preferredDate: r.preferredDate || undefined,
    notes: r.notes || undefined,
    isRemoved: r.isRemoved || false,
    createdAt: r.createdAt || undefined,
  } as BacklogItem;
  emitDashboardChange();
  return out;
}

export async function deleteSchedule(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('schedule').delete().eq('id', id);
    if (error) throw error;
    emitDashboardChange();
    return;
  }
  const handleRequest = await getHandleRequest();
  await handleRequest({ method: 'DELETE', path: `/schedule/${id}` });
  emitDashboardChange();
}

// --- Access control: app users & invitations (MVP manual link) ---

export type AppUser = {
  userId: string;
  email: string;
  role: 'owner' | 'member' | 'viewer' | 'editor';
  status: 'approved' | 'pending' | 'revoked';
  invitedBy?: string | null;
};

export type InvitationRole = 'member' | 'viewer' | 'editor';

export type Invitation = {
  id: string;
  email: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string; // ISO
  invitedBy: string;
  invitedRole: InvitationRole;
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

export async function inviteByEmail(email: string, role: InvitationRole): Promise<Invitation> {
  if (!supabase) throw new Error('Invites require Supabase to be configured');
  const { data: auth } = await supabase.auth.getUser();
  const inviter = auth.user?.id;
  if (!inviter) throw new Error('Not authenticated');
  // random token
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const expires_at = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await (supabase as any)
    .from('invitations')
    .insert({ email, token, invited_by: inviter, expires_at, invited_role: role })
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
    invitedRole: data.invited_role ?? 'member',
  } as Invitation;
}

export async function listInvitations(): Promise<Invitation[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('invitations').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({ id: r.id, email: r.email, token: r.token, status: r.status, expiresAt: r.expires_at, invitedBy: r.invited_by, invitedRole: r.invited_role ?? 'member' }));
}

export async function deleteInvitation(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('invitations').delete().eq('id', id);
  if (error) throw error;
}

export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('invitations').select('*').eq('token', token).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    token: data.token,
    status: data.status,
    expiresAt: data.expires_at,
    invitedBy: data.invited_by,
    invitedRole: data.invited_role ?? 'member',
  } as Invitation;
}

export async function sendInviteLink(email: string, token: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  // Build accept URL with token param; the recipient will authenticate via the magic link email
  const origin = window.location.origin;
  const path = window.location.pathname || '/';
  const acceptUrl = new URL(origin + path);
  acceptUrl.searchParams.set('accept', '1');
  acceptUrl.searchParams.set('token', token);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: acceptUrl.toString() },
  });
  if (error) throw error;
}

export async function acceptInvitationFromUrl(): Promise<'done' | 'skipped'> {
  if (!supabase) throw new Error('Supabase not configured');
  const u = new URL(window.location.href);
  const accept = u.searchParams.get('accept');
  const token = u.searchParams.get('token');
  if (accept !== '1' || !token) return 'skipped';
  // Ensure user is signed in first; if not, prompt email sign-in
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.id) {
    const email = window.prompt('Enter your email to accept the invitation:');
    if (!email) throw new Error('Email is required to accept invitation');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
    if (error) throw error;
    alert('Check your email for a sign-in link, then return to this page to complete acceptance.');
    return 'skipped';
  }
  // Call server to accept (validates token and email match on server)
  const { error } = await (supabase as any).rpc('invitations_accept', { p_token: token });
  if (error) throw error;
  try {
    const clean = new URL(window.location.href);
    clean.searchParams.delete('accept');
    clean.searchParams.delete('token');
    window.history.replaceState({}, document.title, clean.toString());
  } catch {}
  return 'done';
}
// --- Dangerous: owner-only purge flow with email confirmation ---
// Contract:
// - Step 1: requestPurgeEmail() -> sends a sign-in/verification email containing a link with ?confirmPurge=<token>
// - Step 2: confirmPurge(token) -> verifies token by checking current session email match, then calls RPC to purge.

export async function requestPurgeEmail(opts?: { redirectTo?: string }): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: auth } = await supabase.auth.getUser();
  const email = auth.user?.email;
  if (!email) throw new Error('Not authenticated');
  const origin = window.location.origin;
  const redirect = opts?.redirectTo ?? `${origin}${window.location.pathname}`;
  // Generate a one-time token (client-side marker); the real security is the auth email link itself.
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const url = new URL(redirect);
  url.searchParams.set('confirmPurge', token);
  // Send a magic link to the current email that returns to the URL above
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: url.toString() } });
  if (error) throw error;
  // Stash token locally to require the same browser to confirm (defense-in-depth UX guard)
  try { localStorage.setItem('purge.token', token); } catch {}
}

export async function confirmPurgeFromUrl(): Promise<'done' | 'skipped'> {
  if (!supabase) throw new Error('Supabase not configured');
  const u = new URL(window.location.href);
  const token = u.searchParams.get('confirmPurge');
  if (!token) return 'skipped';
  // Optional local check to ensure same device initiated the flow
  try {
    const t = localStorage.getItem('purge.token');
    if (!t || t !== token) {
      // Not fatal, but add a small delay to reduce CSRF-like attempts
      await new Promise(r => setTimeout(r, 500));
    }
  } catch {}
  // Ensure session exists and user is owner
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('Not authenticated');
  // Server-side check occurs inside RPC; client-side we just call it
  const { error } = await (supabase as any).rpc('app_purge_everything');
  if (error) throw error;
  // Clean URL param & local token
  try { localStorage.removeItem('purge.token'); } catch {}
  try {
    const clean = new URL(window.location.href);
    clean.searchParams.delete('confirmPurge');
    window.history.replaceState({}, document.title, clean.toString());
  } catch {}
  return 'done';
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
  if (patch.role) {
    // Disallow assigning owner via the client UI. Owner assignment must go through owner bootstrap or server-side flows.
    if (patch.role === 'owner') throw new Error('Assigning owner role via UI is not allowed');
    payload.role = patch.role;
  }
  const { error } = await (supabase as any).from('app_users').update(payload).eq('user_id', userId);
  if (error) throw error;
}

export async function deleteMemberCompletely(userId: string, mode: 'delete' | 'null' = 'delete'): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  // Try server-side RPC first (preferred: cleans up dependents)
  const { error } = await (supabase as any).rpc('app_users_delete_completely', { p_user_id: userId, p_mode: mode });
  if (!error) return;
  const originalErr = error;
  // Fallback path: ensure target is not an owner, then delete related invitations and the app_user row
  try {
    const { data: target, error: qErr } = await supabase
      .from('app_users')
      .select('user_id,email,role')
      .eq('user_id', userId)
      .maybeSingle<{ user_id: string; email: string | null; role: AppUser['role'] }>();
    if (qErr) throw qErr;
    if (!target) return; // Already gone
    if (target.role === 'owner') throw new Error('refusing to delete an owner via fallback');
    // Best-effort cleanup of invitations for this email
    if (target.email) {
      await (supabase as any)
        .from('invitations')
        .delete()
        .ilike('email', target.email);
    }
    // Delete the app user
    const { error: delErr } = await supabase.from('app_users').delete().eq('user_id', userId);
    if (delErr) throw delErr;
  } catch (_fallbackErr) {
    // Bubble original RPC error for clarity
    throw originalErr;
  }
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

// --- Owner profile ---
export type OwnerProfile = {
  userId: string;
  fullName: string;
  workspaceName: string;
  orgName?: string;
  phone?: string;
  timezone?: string;
  locale?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function getMyOwnerProfile(): Promise<OwnerProfile | null> {
  if (supabase) {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return null;
    const { data, error } = await supabase.from('owner_profiles').select('*').eq('user_id', uid).maybeSingle();
    if (error) {
      const msg = String(error.message || '');
      // Fallback if table doesn't exist yet in project
      if (msg.includes("Could not find the table 'public.owner_profiles'")) {
        try {
          const raw = localStorage.getItem('owner-profile:me');
          return raw ? (JSON.parse(raw) as OwnerProfile) : null;
        } catch { return null; }
      }
      throw error;
    }
    if (!data) return null;
    const r: any = data as any;
    return {
      userId: r.user_id,
      fullName: r.full_name,
      workspaceName: r.workspace_name,
      orgName: r.org_name || undefined,
      phone: r.phone || undefined,
      timezone: r.timezone || undefined,
      locale: r.locale || undefined,
      createdAt: r.created_at || undefined,
      updatedAt: r.updated_at || undefined,
    } as OwnerProfile;
  }
  try {
    const raw = localStorage.getItem('owner-profile:me');
    if (!raw) return null;
    return JSON.parse(raw) as OwnerProfile;
  } catch {
    return null;
  }
}

export async function upsertMyOwnerProfile(patch: Partial<Omit<OwnerProfile, 'userId'>> & { fullName: string; workspaceName: string }): Promise<OwnerProfile> {
  if (supabase) {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Not authenticated');
    const payload: any = {
      user_id: uid,
      full_name: patch.fullName,
      workspace_name: patch.workspaceName,
      org_name: patch.orgName ?? null,
      phone: patch.phone ?? null,
      timezone: patch.timezone ?? null,
      locale: patch.locale ?? null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await (supabase as any)
      .from('owner_profiles')
      .upsert(payload)
      .select('*')
      .single();
    if (error) {
      const msg = String(error.message || '');
      if (msg.includes("Could not find the table 'public.owner_profiles'")) {
        // Fallback to local storage
        const next: OwnerProfile = {
          userId: uid,
          fullName: payload.full_name,
          workspaceName: payload.workspace_name,
          orgName: payload.org_name || undefined,
          phone: payload.phone || undefined,
          timezone: payload.timezone || undefined,
          locale: payload.locale || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        try { localStorage.setItem('owner-profile:me', JSON.stringify(next)); } catch {}
        return next;
      }
      throw error;
    }
    const r: any = data as any;
    return {
      userId: r.user_id,
      fullName: r.full_name,
      workspaceName: r.workspace_name,
      orgName: r.org_name || undefined,
      phone: r.phone || undefined,
      timezone: r.timezone || undefined,
      locale: r.locale || undefined,
      createdAt: r.created_at || undefined,
      updatedAt: r.updated_at || undefined,
    } as OwnerProfile;
  }
  // Fallback to local storage for non-Supabase/dev mode
  const existing = await getMyOwnerProfile();
  const next: OwnerProfile = {
    userId: existing?.userId || 'local-owner',
    fullName: patch.fullName,
    workspaceName: patch.workspaceName,
    orgName: patch.orgName,
    phone: patch.phone,
    timezone: patch.timezone,
    locale: patch.locale,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try { localStorage.setItem('owner-profile:me', JSON.stringify(next)); } catch {}
  return next;
}

// --- Intake links management ---

export type IntakeLink = {
  id: string;
  token: string;
  label?: string;
  active: boolean;
  defaultCategoryKey?: BacklogItem['categoryKey'];
  defaultCaseTypeId?: string;
  defaultSurgeonId?: string;
  createdBy: string;
  createdAt: string;
};

function generateIntakeToken(): string {
  // Simple random token; consider switching to crypto if available
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}

export async function listIntakeLinks(opts?: { ownerUserId?: string | 'all' }): Promise<IntakeLink[]> {
  if (!supabase) return [];
  let q = supabase.from('intake_links').select('*').order('created_at', { ascending: false });
  if (opts?.ownerUserId && opts.ownerUserId !== 'all') q = q.eq('created_by', opts.ownerUserId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id,
    token: r.token,
    label: r.label || undefined,
    active: !!r.active,
    defaultCategoryKey: r.default_category_key || undefined,
    defaultCaseTypeId: r.default_case_type_id || undefined,
    defaultSurgeonId: r.default_surgeon_id || undefined,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }));
}

export async function createIntakeLink(input: {
  label?: string;
  ownerUserId: string; // who owns this link; may be another owner
  defaultCategoryKey?: BacklogItem['categoryKey'];
  defaultCaseTypeId?: string;
  defaultSurgeonId?: string;
}): Promise<IntakeLink> {
  if (!supabase) throw new Error('Supabase not configured');
  const token = generateIntakeToken();
  const row: any = {
    token,
    label: input.label ?? null,
    active: true,
    default_category_key: input.defaultCategoryKey ?? null,
    default_case_type_id: input.defaultCaseTypeId ?? null,
    default_surgeon_id: input.defaultSurgeonId ?? null,
    created_by: input.ownerUserId,
  };
  const { data, error } = await (supabase as any).from('intake_links').insert(row).select('*').single();
  if (error) throw error;
  return {
    id: data.id,
    token: data.token,
    label: data.label || undefined,
    active: !!data.active,
    defaultCategoryKey: data.default_category_key || undefined,
    defaultCaseTypeId: data.default_case_type_id || undefined,
    defaultSurgeonId: data.default_surgeon_id || undefined,
    createdBy: data.created_by,
    createdAt: data.created_at,
  } as IntakeLink;
}

export async function updateIntakeLink(id: string, patch: Partial<{
  label: string | null;
  active: boolean;
  defaultCategoryKey: BacklogItem['categoryKey'] | null;
  defaultCaseTypeId: string | null;
  defaultSurgeonId: string | null;
  ownerUserId: string; // allow reassigning owner
}>): Promise<void> {
  if (!supabase) return;
  const payload: any = {};
  if ('label' in patch) payload.label = patch.label;
  if ('active' in patch) payload.active = patch.active;
  if ('defaultCategoryKey' in patch) payload.default_category_key = patch.defaultCategoryKey;
  if ('defaultCaseTypeId' in patch) payload.default_case_type_id = patch.defaultCaseTypeId;
  if ('defaultSurgeonId' in patch) payload.default_surgeon_id = patch.defaultSurgeonId;
  if ('ownerUserId' in patch) payload.created_by = patch.ownerUserId;
  const { error } = await (supabase as any).from('intake_links').update(payload).eq('id', id);
  if (error) throw error;
}

export function getIntakeShareUrl(token: string): string {
  try {
    const base = window.location.origin;
    return `${base}?intake=1&token=${encodeURIComponent(token)}`;
  } catch {
    return `?intake=1&token=${encodeURIComponent(token)}`;
  }
}

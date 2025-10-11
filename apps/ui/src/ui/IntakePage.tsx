import { useMemo, useState } from 'react';
import { supabase } from '../supabase/client';
import { defaultCategoryPrefs } from './categoryPrefs';

function normalizeDigits(s: string): string { return s.replace(/\D+/g, ''); }

export function IntakePage() {
  const url = new URL(window.location.href);
  let tokenFromUrl = url.searchParams.get('token') || '';
  // Also support tokens passed in the hash, e.g., http://host/#/?intake=1&token=...
  if (!tokenFromUrl && url.hash && url.hash.includes('token=')) {
    try {
      const h = new URL(url.hash.replace(/^#/, ''), url.origin);
      tokenFromUrl = h.searchParams.get('token') || '';
    } catch {}
  }
  const [token, setToken] = useState<string>(tokenFromUrl);
  const [patientName, setPatientName] = useState('');
  const [mrn, setMrn] = useState('');
  const [procedure, setProcedure] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryKey, setCategoryKey] = useState<string>('');
  const [caseTypeId, setCaseTypeId] = useState<string>('');
  const [pending, setPending] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const valid = useMemo(() => patientName.trim() && mrn.trim() && procedure.trim(), [patientName, mrn, procedure]);

  async function submit() {
    if (!supabase) { setError('Supabase not configured'); return; }
    if (!token.trim()) { setError('Missing token'); return; }
    setPending(true); setError(null);
    try {
      // First try with optional category override (newer RPC signature)
      const argsNew: any = {
        p_token: token.trim(),
        p_patient_name: patientName.trim(),
        p_mrn: normalizeDigits(mrn.trim()),
        p_procedure: procedure.trim(),
        p_phone1: normalizeDigits(phone1.trim()),
        p_phone2: normalizeDigits(phone2.trim()),
        p_notes: notes.trim() || null,
        p_category_key: categoryKey || null,
        p_case_type_id: caseTypeId || null,
      };
      let resp = await (supabase as any).rpc('submit_backlog_intake', argsNew);
      if (resp.error) {
        const msg = String(resp.error?.message || '');
        // Backward-compat: if function signature doesn’t accept p_category_key, retry without it
        if (/function .*submit_backlog_intake/i.test(msg) || /too many arguments/i.test(msg) || /named argument/i.test(msg)) {
          setWarn('Category override not yet enabled on server. Submitting without category…');
          const { data, error } = await (supabase as any).rpc('submit_backlog_intake', {
            p_token: argsNew.p_token,
            p_patient_name: argsNew.p_patient_name,
            p_mrn: argsNew.p_mrn,
            p_procedure: argsNew.p_procedure,
            p_phone1: argsNew.p_phone1,
            p_phone2: argsNew.p_phone2,
            p_notes: argsNew.p_notes,
          });
          if (error) throw error;
          setWarn(prev => prev || null);
          setDoneId(String(data));
        } else {
          throw resp.error;
        }
      } else {
        setDoneId(String(resp.data));
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  const tokenMissing = !token || !token.trim();

  if (doneId) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
        <div>
          <h2>Submitted</h2>
          <div style={{ opacity: 0.8 }}>Thank you. Your case has been added to the backlog.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
      <div style={{ width: 'min(520px, 92vw)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--surface-1)' }}>
        <h2 style={{ marginTop: 0 }}>Submit a case</h2>
        <p style={{ fontSize: 13, opacity: 0.8 }}>Please fill the form below. Required fields are marked with *</p>
        {tokenMissing && (
          <div style={{ marginBottom: 8, padding: 8, border: '1px solid #f59e0b', borderRadius: 6, background: '#fffbeb', color: '#78350f' }}>
            <div style={{ fontWeight: 600 }}>Missing token</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              This form was opened without a token. Paste your token here or use a link like:
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, wordBreak: 'break-all', marginTop: 4 }}>
              http://your-app?intake=1&token=YOURTOKEN
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <input placeholder="Token" value={token} onChange={(e) => setToken(e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>
        )}
        {error && <div style={{ color: '#a11', marginBottom: 8 }}>Error: {error}</div>}
        {warn && !error && <div style={{ color: '#92400e', background: '#fffbeb', border: '1px solid #f59e0b', padding: '6px 8px', borderRadius: 6, marginBottom: 8 }}>{warn}</div>}
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Patient name *</span>
            <input value={patientName} onChange={e => setPatientName(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Case type</span>
            <select value={caseTypeId} onChange={(e) => setCaseTypeId(e.target.value)}>
              <option value="">(use link default)</option>
              <option value="case:elective">Elective</option>
              <option value="case:urgent">Urgent</option>
              <option value="case:emergency">Emergency</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>MRN *</span>
            <input value={mrn} onChange={e => setMrn(e.target.value.replace(/\D+/g,'').slice(0,32))} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Procedure *</span>
            <input value={procedure} onChange={e => setProcedure(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Category</span>
            <select value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)}>
              <option value="">(use link default)</option>
              {defaultCategoryPrefs().map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ display: 'grid', gap: 6, flex: 1 }}>
              <span>Phone 1</span>
              <input value={phone1} onChange={e => setPhone1(e.target.value.replace(/\D+/g,''))} />
            </label>
            <label style={{ display: 'grid', gap: 6, flex: 1 }}>
              <span>Phone 2</span>
              <input value={phone2} onChange={e => setPhone2(e.target.value.replace(/\D+/g,''))} />
            </label>
          </div>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Notes</span>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={submit} disabled={!valid || pending}>{pending ? 'Submitting…' : 'Submit'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

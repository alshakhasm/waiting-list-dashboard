import { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';

function usePersistedForm<T extends object>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue] as const;
}

export function CreateAccountPage() {
  const [form, setForm] = usePersistedForm('create-owner-form', {
    email: '',
    password: '',
    confirm: '',
    fullName: '',
    workspaceName: '',
    orgName: '',
    phone: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    locale: navigator.language || 'en-US',
  });
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!supabase) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh', padding: 24 }}>
        <div style={{ maxWidth: 560 }}>
          <h1>Authentication not configured</h1>
          <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable accounts.</p>
        </div>
      </div>
    );
  }

  async function submit() {
    setStatus(null);
    setLoading(true);
    try {
      if (!supabase) throw new Error('Authentication disabled.');
      // Validate
      if (!form.email) throw new Error('Email is required.');
      if (!form.password) throw new Error('Password is required.');
      if (form.password !== form.confirm) throw new Error('Passwords do not match.');
      if (!form.fullName) throw new Error('Full name is required.');
      // Persist profile for post-confirmation finalization
      try { localStorage.setItem(`owner-profile:pending:${form.email.toLowerCase()}`, JSON.stringify({
        fullName: form.fullName,
        workspaceName: form.workspaceName || `${form.fullName.split(' ')[0] || 'My'} Workspace`,
        orgName: form.orgName || '',
        phone: form.phone || '',
        timezone: form.timezone || '',
        locale: form.locale || '',
      })); } catch {}
      // Send sign-up confirmation email
      const origin = window.location.origin;
      const ghBase = window.location.pathname.startsWith('/waiting-list-dashboard') ? '/waiting-list-dashboard' : '';
      const emailRedirectTo = origin + ghBase;
      const { error, data } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      // If email confirmations are enabled (recommended), data.session will be null
      setStatus('Almost there! Please check your email to confirm your account. Once confirmed, return here and Sign in.');
      // Optionally route to sign-in with prefilled email
      setTimeout(() => {
        try {
          const u = new URL(window.location.href);
          u.searchParams.set('signin', '1');
          u.searchParams.set('email', form.email);
          u.searchParams.delete('create');
          window.location.href = u.toString();
        } catch {}
      }, 800);
    } catch (err: any) {
      setStatus(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 560, padding: 24, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)' }}>
        <h1 style={{ marginTop: 0 }}>Create your workspace</h1>
        <p style={{ opacity: 0.8, marginTop: 4 }}>Tell us a bit about you and your workspace. You can change these later.</p>
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Email</span>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Password</span>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Confirm password</span>
              <input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="Repeat password" />
            </label>
          </div>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Full name</span>
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Dr. Jane Doe" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Workspace name</span>
            <input value={form.workspaceName} onChange={(e) => setForm({ ...form, workspaceName: e.target.value })} placeholder="OMFS Waiting List" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Organization (optional)</span>
            <input value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} placeholder="Hospital / Clinic" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Phone (optional)</span>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555 123 4567" />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Time zone</span>
              <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Locale</span>
              <input value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })} />
            </label>
          </div>
        </div>
        {status && <div role="status" style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>{status}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={submit} disabled={loading || !form.email || !form.password || !form.confirm || !form.fullName}>Create account</button>
          <button type="button" onClick={() => { try { localStorage.removeItem('create-owner-form'); } catch {}; window.history.back(); }} style={{ background: 'transparent', border: '1px solid var(--border)' }}>Cancel</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
          We’ll send you a confirmation email. After confirming, please Sign in to complete setup.
        </div>
      </div>
    </div>
  );
}

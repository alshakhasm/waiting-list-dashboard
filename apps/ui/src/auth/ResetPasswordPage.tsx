import { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';

function getRedirectBase(): string {
  try {
    const origin = window.location.origin;
    const path = window.location.pathname || '/';
    const ghBase = '/waiting-list-dashboard';
    const base = path.startsWith(ghBase) ? ghBase : '';
    return origin + base;
  } catch {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
}

export function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [newConfirm, setNewConfirm] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setRecoveryLoading(false);
      setStatus('Supabase is not configured.');
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const fn = (supabase.auth as any).getSessionFromUrl;
        if (typeof fn === 'function') {
          const { error } = await fn();
          if (error) {
            setStatus(error.message || String(error));
            if (mounted) setRecoveryLoading(false);
            return;
          }
        } else {
          try {
            const rawHash = (typeof window !== 'undefined' ? (window.location.hash || '') : '').replace(/^#/, '');
            const params = new URLSearchParams(rawHash);
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            if (access_token && (supabase.auth as any).setSession) {
              const { error } = await (supabase.auth as any).setSession({ access_token, refresh_token });
              if (error) {
                setStatus(error.message || String(error));
                if (mounted) setRecoveryLoading(false);
                return;
              }
            }
          } catch (err: any) {
            setStatus(err?.message || String(err));
            if (mounted) setRecoveryLoading(false);
            return;
          }
        }
        if (mounted) setRecoveryLoading(false);
      } catch (err: any) {
        if (mounted) setStatus(err?.message || String(err));
        if (mounted) setRecoveryLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!supabase) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh', padding: 24 }}>
        <div style={{ maxWidth: 420 }}>
          <h1>Reset password</h1>
          <p style={{ opacity: 0.8 }}>Supabase is not configured, so the password reset flow cannot continue.</p>
        </div>
      </div>
    );
  }

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!newPassword || newPassword !== newConfirm) {
      setStatus('Passwords do not match or are empty.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword } as any);
      if (error) throw error;
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.warn('[ResetPasswordPage] signOut error', signOutError);
      }
      const base = getRedirectBase();
      const dest = new URL(base);
      dest.searchParams.set('signin', '1');
      dest.searchParams.set('reset', '1');
      dest.searchParams.delete('type');
      dest.searchParams.delete('access_token');
      setStatus('Password updated. Redirecting you to sign in…');
      window.location.replace(dest.toString());
    } catch (err: any) {
      setStatus(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh', padding: 24 }}>
      <form onSubmit={submitNewPassword} style={{ width: '100%', maxWidth: 420, padding: 24, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-1)', color: 'var(--text)' }}>
        <h1 style={{ marginTop: 0 }}>Reset password</h1>
        {recoveryLoading ? (
          <div>Preparing password reset…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>New password</span>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="••••••••" />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Confirm new password</span>
                <input type="password" value={newConfirm} onChange={(e) => setNewConfirm(e.target.value)} required placeholder="Repeat password" />
              </label>
            </div>
            {status && <div role="status" style={{ marginTop: 10, fontSize: 12, color: 'var(--text)', opacity: 0.8 }}>{status}</div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
              <button type="submit" disabled={loading}>{loading ? 'Please wait…' : 'Set new password'}</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

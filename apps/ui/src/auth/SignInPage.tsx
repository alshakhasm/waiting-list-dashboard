import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { supabase } from '../supabase/client';
import { enableGuest } from './guest';
import { hasAnyAppUsers, becomeOwner } from '../client/api';
import { IconLogIn } from '../ui/icons';
import { getRedirectBase, navigateWithParams } from '../ui/url';

export function SignInPage() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isMagic, setIsMagic] = useState(false);
  const [canSignUp, setCanSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const workspaceName = useMemo(() => {
    const envTitle = (import.meta as any)?.env?.VITE_APP_TITLE as string | undefined;
    try {
      return localStorage.getItem('ui-app-title') || envTitle || 'Workspace';
    } catch {
      return envTitle || 'Workspace';
    }
  }, []);

  // Centralized helpers now used from ../ui/url

  // Read URL hints and compute if sign-up is allowed (owner bootstrap or invite acceptance)
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const signup = url.searchParams.get('signup');
        const bootstrap = url.searchParams.get('bootstrap');
        const presetEmail = url.searchParams.get('email');
        const magic = url.searchParams.get('magic');
        const accept = url.searchParams.get('accept');
        // prefer last-used method if no explicit magic flag provided
        if (!magic) {
          try {
            const last = localStorage.getItem('auth:last-method');
            if (last === 'magic') url.searchParams.set('magic','1');
            if (last === 'options') {/* no-op: default */}
            if (last === 'reset') {/* handled by button later */}
            if (last === 'join') url.searchParams.set('accept','1');
          } catch {}
        }

        let allowed = false;
        if (supabase) {
          let anyUsers = true;
          try { anyUsers = await hasAnyAppUsers(); } catch {}
          const isInvite = accept === '1' || accept === 'true';
          const isBootstrap = bootstrap === '1' || bootstrap === 'true';
          allowed = isInvite || !anyUsers || isBootstrap;
        }
        setCanSignUp(allowed);
        if ((signup === '1' || signup === 'true') && allowed) setMode('sign-up');
        if (presetEmail) setEmail(presetEmail);
        if (magic === '1' || magic === 'true') setIsMagic(true);
      } catch {}
    })();
  }, []);

  if (!supabase) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh', padding: 24 }}>
        <div style={{ maxWidth: 420 }}>
          <h1>Authentication disabled</h1>
          <p style={{ opacity: 0.8 }}>
            Supabase isn't configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sign-in.
          </p>
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      if (!supabase) return;
      if (isMagic) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: getRedirectBase() },
        });
        if (error) throw error;
        setStatus('Check your email for the sign-in link.');
        return;
      }

      if (mode === 'sign-in') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const session = data.session;
        const user = session?.user;
        if (!session || !user?.email_confirmed_at) {
          await supabase.auth.signOut().catch(() => {});
          setStatus('Your email is not confirmed yet. Please check your inbox for the confirmation link before signing in.');
          setLoading(false);
          return;
        }
        setStatus(null);
        try {
          const url = new URL(window.location.href);
          const bootstrap = url.searchParams.get('bootstrap');
          if (bootstrap === '1' || bootstrap === 'true') {
            await becomeOwner();
            // Atomically clear bootstrap flag
            navigateWithParams({ delete: ['bootstrap'], mode: 'replace' });
          }
        } catch {}
      } else {
        if (!canSignUp) {
          setStatus('Sign-up is restricted to the list owner (first user) or invited users. Please ask the owner for an invite.');
          return;
        }
        if (password !== confirm) {
          setStatus('Passwords do not match.');
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getRedirectBase() },
        });
        if (error) throw error;
        await supabase.auth.signOut().catch(() => {});
        setStatus('Sign-up successful. Please check your email to confirm your account before signing in.');
        setLoading(false);
        return;
      }
    } catch (err: any) {
      setStatus(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function sendReset() {
    setStatus(null);
    try {
      const redirect = navigateWithParams({ set: { reset: 1 }, navigate: false });
      setStatus('Sending password reset…');
      const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timed out. Please try again.')), ms))
      ] as any);
      const { error } = await withTimeout(
        supabase!.auth.resetPasswordForEmail(email, { redirectTo: redirect }),
        8000
      );
      if (error) throw error;
      setStatus('Password reset email sent. Check your inbox.');
    } catch (err: any) {
      setStatus(err?.message || String(err));
    }
  }

  const pageStyle: CSSProperties = {
    minHeight: '100vh',
    display: 'grid',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 16px',
    background: 'radial-gradient(circle at top, rgba(148, 163, 184, 0.25), transparent 60%)',
  };
  const cardStyle: CSSProperties = {
    width: '100%',
    maxWidth: 440,
    padding: 32,
    borderRadius: 18,
    border: '1px solid rgba(148,163,184,0.35)',
    background: 'var(--surface-1)',
    boxShadow: '0 32px 80px rgba(15, 23, 42, 0.18)',
    display: 'grid',
    gap: 20,
    color: 'var(--text)',
  };
  const controlCluster: CSSProperties = { display: 'inline-flex', gap: 8, background: 'var(--surface-2)', padding: 4, borderRadius: 12 };
  const inputStyle: CSSProperties = {
    background: 'var(--surface-2)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 15,
  };
  const subtleText: CSSProperties = { fontSize: 13, opacity: 0.75 };

  return (
    <div style={pageStyle}>
      <form onSubmit={onSubmit} style={cardStyle}>
        <header style={{ display: 'grid', gap: 8 }}>
          <span style={{ letterSpacing: 1.8, textTransform: 'uppercase', fontSize: 12, opacity: 0.65 }}>Sign in to</span>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 30 }}>
            <IconLogIn size={22} style={{ opacity: 0.85 }} />
            <span>{workspaceName}</span>
          </h1>
          <p style={{ ...subtleText, margin: 0 }}>Access dashboards, scheduling, and invites from one secure place.</p>
        </header>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          {canSignUp ? (
            <div style={controlCluster}>
              <button
                type="button"
                onClick={() => setMode('sign-in')}
                aria-pressed={mode==='sign-in'}
                style={{
                  padding: '6px 14px',
                  background: mode==='sign-in' ? 'var(--surface-1)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  color: 'var(--text)',
                  fontWeight: 600,
                }}
              >Sign in</button>
              <button
                type="button"
                onClick={() => setMode('sign-up')}
                aria-pressed={mode==='sign-up'}
                style={{
                  padding: '6px 14px',
                  background: mode==='sign-up' ? 'var(--surface-1)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  color: 'var(--text)',
                  fontWeight: 600,
                }}
              >Sign up</button>
            </div>
          ) : (
            <strong style={{ fontSize: 14 }}>Sign in</strong>
          )}
          <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={isMagic} onChange={(e) => setIsMagic(e.target.checked)} /> Use magic link
          </label>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={inputStyle}
            />
          </label>

          {!isMagic && (
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={mode==='sign-in' || mode==='sign-up'}
                placeholder="••••••••"
                style={inputStyle}
              />
            </label>
          )}

          {!isMagic && mode === 'sign-up' && (
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Confirm password</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Repeat password"
                style={inputStyle}
              />
            </label>
          )}
        </div>

        {status && (
          <div role="status" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.12)', color: '#7f1d1d', fontSize: 13 }}>{status}</div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="submit"
            disabled={loading || !email || (!isMagic && !password)}
            style={{ background: 'var(--primary)', color: 'var(--on-primary)', border: '1px solid var(--primary)', borderRadius: 999, padding: '10px 18px', fontWeight: 600 }}
          >
            {loading ? 'Please wait…' : mode === 'sign-in' ? (isMagic ? 'Send magic link' : 'Sign in') : 'Create account'}
          </button>
          {!isMagic && mode === 'sign-in' && (
            <button
              type="button"
              onClick={sendReset}
              disabled={!email}
              style={{ marginLeft: 'auto', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 999, padding: '8px 14px', background: 'transparent' }}
            >
              Forgot password?
            </button>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => enableGuest()}
            title="Browse the app without signing in"
            style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '6px 14px', background: 'transparent', color: 'var(--text)' }}
          >
            Continue as guest
          </button>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Some actions may be limited in guest mode.</div>
        </div>
        <footer style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 16, fontSize: 12, opacity: 0.8 }}>
          <span>Need a dedicated workspace? Use the owner setup flow.</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                const base = getRedirectBase();
                window.location.href = base || '/';
              }}
              style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '6px 12px', background: 'transparent', color: 'var(--text)' }}
            >
              Go to Home
            </button>
            <button
              type="button"
              onClick={() => navigateWithParams({ set: { create: 1 }, delete: ['signin','signup'], mode: 'assign' })}
              style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '6px 12px', background: 'transparent', color: 'var(--text)' }}
            >
              Go to Create Account →
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { enableGuest } from './guest';
import { hasAnyAppUsers, becomeOwner } from '../client/api';
import { IconLogIn } from '../ui/icons';

export function SignInPage() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isMagic, setIsMagic] = useState(false);
  const [canSignUp, setCanSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  function getRedirectBase() {
    try {
      const origin = window.location.origin;
      const path = window.location.pathname || '/';
      const ghBase = '/waiting-list-dashboard';
      const base = path.startsWith(ghBase) ? ghBase : '';
      return origin + base;
    } catch {
      return window.location.origin;
    }
  }

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
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setStatus(null);
        try {
          const url = new URL(window.location.href);
          const bootstrap = url.searchParams.get('bootstrap');
          if (bootstrap === '1' || bootstrap === 'true') {
            await becomeOwner();
            // clean bootstrap flag to avoid re-running
            url.searchParams.delete('bootstrap');
            window.history.replaceState({}, '', url.toString());
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
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getRedirectBase() },
        });
        if (error) throw error;
        if (!data.session) {
          setStatus('Sign-up successful. Please check your email to confirm your account.');
        } else {
          setStatus(null);
          try {
            const url = new URL(window.location.href);
            const bootstrap = url.searchParams.get('bootstrap');
            if (bootstrap === '1' || bootstrap === 'true') {
              await becomeOwner();
              url.searchParams.delete('bootstrap');
              window.history.replaceState({}, '', url.toString());
            }
          } catch {}
        }
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
      const { error } = await supabase!.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectBase(),
      });
      if (error) throw error;
      setStatus('Password reset email sent. Check your inbox.');
    } catch (err: any) {
      setStatus(err?.message || String(err));
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh', padding: 24 }}>
      <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: 420, padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
        <h1 style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconLogIn size={21} style={{ opacity: 0.9, marginRight: -1 }} /> Welcome
        </h1>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button type="button" onClick={() => setMode('sign-in')} aria-pressed={mode==='sign-in'}
            style={{ padding: '6px 10px', background: mode==='sign-in' ? '#eee' : 'transparent', border: '1px solid #ccc', borderRadius: 6 }}>Sign in</button>
          {canSignUp && (
            <button type="button" onClick={() => setMode('sign-up')} aria-pressed={mode==='sign-up'}
              style={{ padding: '6px 10px', background: mode==='sign-up' ? '#eee' : 'transparent', border: '1px solid #ccc', borderRadius: 6 }}>Sign up</button>
          )}
          <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={isMagic} onChange={(e) => setIsMagic(e.target.checked)} /> Use magic link
          </label>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
          </label>

          {!isMagic && (
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={mode==='sign-in' || mode==='sign-up'} placeholder="••••••••" />
            </label>
          )}

          {!isMagic && mode === 'sign-up' && (
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Confirm password</span>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Repeat password" />
            </label>
          )}
        </div>

        {status && (
          <div role="status" style={{ marginTop: 10, fontSize: 12, color: '#555' }}>{status}</div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
          <button type="submit" disabled={loading || !email || (!isMagic && !password)}>
            {loading ? 'Please wait…' : mode === 'sign-in' ? (isMagic ? 'Send magic link' : 'Sign in') : 'Create account'}
          </button>
          {!isMagic && mode === 'sign-in' && (
            <button type="button" onClick={sendReset} disabled={!email} style={{ marginLeft: 'auto' }}>Forgot password?</button>
          )}
        </div>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button type="button" onClick={() => enableGuest()} title="Browse the app without signing in">Continue as guest</button>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Some actions may be limited in guest mode.</div>
        </div>
        <div style={{ marginTop: 16, fontSize: 12, opacity: 0.8 }}>
          Creating a new workspace? Use the Create Account flow instead.
          <button type="button" onClick={() => { const u = new URL(window.location.href); u.searchParams.set('create','1'); u.searchParams.delete('signin'); u.searchParams.delete('signup'); window.location.href = u.toString(); }} style={{ marginLeft: 8 }}>Go to Create Account →</button>
        </div>
      </form>
    </div>
  );
}

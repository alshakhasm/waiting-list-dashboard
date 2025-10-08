import { useEffect, useState } from 'react';
import { hasAnyAppUsers } from '../client/api';
import { supabase } from '../supabase/client';
import { IconShield, IconLogIn, IconUserPlus } from './icons';

export function AuthLandingPage() {
  const [allowOwnerCreate, setAllowOwnerCreate] = useState(true);
  const [inviteInput, setInviteInput] = useState('');

  useEffect(() => {
    // Keep previous check for informational purposes, but owner creation stays enabled regardless
    let mounted = true;
    (async () => {
      if (!supabase) return;
      try {
        await hasAnyAppUsers();
        if (!mounted) return;
        setAllowOwnerCreate(true);
      } catch {
        if (!mounted) return;
        setAllowOwnerCreate(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function goOwnerCreate() {
    const u = new URL(window.location.href);
    // clear conflicting flags
    u.searchParams.delete('accept');
    u.searchParams.delete('token');
      // route to create account flow
      u.searchParams.delete('signin');
      u.searchParams.delete('signup');
      u.searchParams.delete('bootstrap');
      u.searchParams.set('create', '1');
    window.location.href = u.toString();
  }

  function goSignIn() {
    const u = new URL(window.location.href);
    // ensure we’re not in accept mode
    u.searchParams.delete('accept');
    u.searchParams.delete('token');
    u.searchParams.delete('signup');
    u.searchParams.delete('bootstrap');
    u.searchParams.set('signin', '1');
    window.location.href = u.toString();
  }

  function goJoinTeam() {
    // accept either full link or raw token
    try {
      let token = inviteInput.trim();
      if (!token) return;
      if (token.includes('token=')) {
        const url = new URL(token);
        token = url.searchParams.get('token') || token;
      }
      const u = new URL(window.location.href);
      u.searchParams.set('accept', '1');
      u.searchParams.set('token', token);
      // Optionally open sign-up by default
      u.searchParams.set('signup', '1');
      window.location.href = u.toString();
    } catch {
      // fallback: try to set token as given
      const u = new URL(window.location.href);
      u.searchParams.set('accept', '1');
      u.searchParams.set('token', inviteInput.trim());
      u.searchParams.set('signup', '1');
      window.location.href = u.toString();
    }
  }

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

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh', padding: 24 }}>
      <div style={{ display: 'grid', gap: 16, width: '100%', maxWidth: 680 }}>
        <h1 style={{ margin: 0 }}>Welcome</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--surface-2)' }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconShield size={18} style={{ opacity: 0.9 }} /> Create account (Owner)
            </h3>
            <p style={{ fontSize: 13, opacity: 0.8 }}>Set up your own waiting list workspace as the owner.</p>
            <button onClick={goOwnerCreate} title={'Create owner account'}>
              Create owner account
            </button>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--surface-2)' }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconLogIn size={18} style={{ opacity: 0.9 }} /> Sign in
            </h3>
            <p style={{ fontSize: 13, opacity: 0.8 }}>Access your existing account (owner or member).</p>
            <button onClick={goSignIn} className="icon-button" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconLogIn size={14} aria-hidden="true" style={{ marginRight: -1, position: 'relative', top: 1 }} /> Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                const u = new URL(window.location.href);
                u.searchParams.delete('signup');
                u.searchParams.delete('bootstrap');
                u.searchParams.set('auth', '1');
                u.searchParams.set('authmenu', '1');
                window.location.href = u.toString();
              }}
              style={{ marginLeft: 8, background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}
            >
              More options ▾
            </button>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--surface-2)' }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconUserPlus size={18} style={{ opacity: 0.9 }} /> Join team
            </h3>
            <p style={{ fontSize: 13, opacity: 0.8 }}>Paste your invite link or token to join an existing workspace.</p>
            <input placeholder="Invite link or token" value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} />
            <div style={{ height: 8 }} />
            <button onClick={goJoinTeam} disabled={!inviteInput.trim()}>Continue</button>
          </div>
        </div>
      </div>
    </div>
  );
}

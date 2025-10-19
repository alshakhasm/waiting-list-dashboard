import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { hasAnyAppUsers } from '../client/api';
import { supabase } from '../supabase/client';
import { IconShield, IconLogIn, IconUserPlus } from './icons';

export function AuthLandingPage() {
  const [allowOwnerCreate, setAllowOwnerCreate] = useState(true);
  const [inviteInput, setInviteInput] = useState('');
  const workspaceName = useMemo(() => {
    const envTitle = (import.meta as any)?.env?.VITE_APP_TITLE as string | undefined;
    try {
      return localStorage.getItem('ui-app-title') || envTitle || 'Workspace';
    } catch {
      return envTitle || 'Workspace';
    }
  }, []);

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

  const pageStyle: CSSProperties = {
    minHeight: '100vh',
    display: 'grid',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '56px 16px',
    background: 'radial-gradient(ellipse at top, rgba(190,227,248,0.25), transparent 60%)',
  };
  const layoutStyle: CSSProperties = { display: 'grid', gap: 24, width: '100%', maxWidth: 880 };
  const cardGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 };
  const cardStyle: CSSProperties = {
    minHeight: 240,
    border: '1px solid rgba(148,163,184,0.35)',
    borderRadius: 20,
    padding: 28,
    background: 'var(--surface-1)',
    boxShadow: '0 20px 60px rgba(15, 23, 42, 0.18)',
    display: 'grid',
    gap: 12,
  };
  const subtleText: CSSProperties = { fontSize: 13, opacity: 0.75 };
  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontSize: 14,
  };

  return (
    <div style={pageStyle}>
      <div style={layoutStyle}>
        <header style={{ display: 'grid', gap: 12 }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: 3, fontSize: 12, opacity: 0.55 }}>Welcome to {workspaceName}</span>
          <h1
            style={{
              margin: 0,
              fontSize: 48,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: 0.5,
              background: 'linear-gradient(110deg, #60a5fa 0%, #c084fc 40%, #f97316 85%, #facc15 100%)',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              maxWidth: 720,
            }}
          >
            Hello, Surgeon!
          </h1>
          <p style={{ ...subtleText, fontSize: 15, maxWidth: 560 }}>
            Theatre-ready scheduling. Seamless team invites. Effortless ownership. Choose the path that fits your role and scrub in.
          </p>
        </header>
        <div style={cardGrid}>
          <div style={cardStyle}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconShield size={20} style={{ opacity: 0.9 }} /> Create owner workspace
            </h3>
            <p style={subtleText}>Establish a new waiting list workspace with full owner controls.</p>
            <button onClick={goOwnerCreate} title="Create owner account" style={{ alignSelf: 'start' }}>Create owner account</button>
          </div>
          <div style={cardStyle}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconLogIn size={20} style={{ opacity: 0.9 }} /> Sign in to existing team
            </h3>
            <p style={subtleText}>Already part of {workspaceName}? Sign in with your existing credentials.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={goSignIn} className="icon-button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconLogIn size={14} aria-hidden="true" /> Sign in
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
                style={{ border: 'none', background: 'transparent', color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}
              >
                More options
              </button>
            </div>
          </div>
          <div style={cardStyle}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconUserPlus size={20} style={{ opacity: 0.9 }} /> Join with invite
            </h3>
            <p style={subtleText}>Paste an invitation link or token shared by your team.</p>
            <input placeholder="Invite link or token" value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} style={inputStyle} />
            <button onClick={goJoinTeam} disabled={!inviteInput.trim()} style={{ alignSelf: 'start' }}>Continue</button>
          </div>
        </div>
      </div>
    </div>
  );
}

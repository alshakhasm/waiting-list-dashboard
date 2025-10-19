import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { hasAnyAppUsers } from '../client/api';
import { supabase } from '../supabase/client';
import { IconShield, IconLogIn } from './icons';

export function AuthLandingPage() {
  const [allowOwnerCreate, setAllowOwnerCreate] = useState(true);
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
    height: '100vh',
    display: 'grid',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 32px',
    boxSizing: 'border-box',
    overflowY: 'hidden',
    overflowX: 'auto',
    background: 'radial-gradient(ellipse at top, rgba(190,227,248,0.25), transparent 60%)',
  };
  const layoutStyle: CSSProperties = {
    display: 'grid',
    gap: 24,
    width: '100%',
    maxWidth: 720,
    maxHeight: '100%',
    alignContent: 'center',
    padding: '0 24px',
    boxSizing: 'border-box',
  };
  const actionRow: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 18,
    justifyContent: 'center',
    alignItems: 'center',
  };
  const primaryAction: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 28px',
    borderRadius: 999,
    border: 'none',
    background: 'linear-gradient(120deg, rgba(56,189,248,0.26), rgba(168,85,247,0.36))',
    color: '#f8fafc',
    fontWeight: 600,
    letterSpacing: 0.3,
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
  };
  const secondaryAction: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 28px',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.4)',
    background: 'transparent',
    color: '#e2e8f0',
    fontWeight: 600,
    letterSpacing: 0.3,
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
  };

  return (
    <div style={pageStyle}>
      <div style={layoutStyle}>
        <header style={{ display: 'grid', gap: 6, justifyItems: 'center', textAlign: 'center', marginTop: -12 }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: 4, fontSize: 14, opacity: 0.65 }}>Welcome to {workspaceName}</span>
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
        </header>
        <p style={{ margin: 0, opacity: 0.72, textAlign: 'center', fontSize: 15 }}>
          Pick the path that fits your role to get started quickly.
        </p>
        <div style={actionRow}>
          <button
            onClick={goOwnerCreate}
            title="Create owner account"
            style={primaryAction}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(120deg, rgba(56,189,248,0.36), rgba(168,85,247,0.46))'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(120deg, rgba(56,189,248,0.26), rgba(168,85,247,0.36))'; }}
          >
            <IconShield size={18} aria-hidden="true" /> Create owner account
          </button>
          <button
            onClick={goSignIn}
            className="icon-button"
            style={secondaryAction}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,23,42,0.6)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            }}
          >
            <IconLogIn size={18} aria-hidden="true" /> Sign in to team
          </button>
        </div>
      </div>
    </div>
  );
}

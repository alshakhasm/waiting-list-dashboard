import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { hasAnyAppUsers } from '../client/api';
import { supabase } from '../supabase/client';
import { IconShield, IconLogIn } from './icons';
import { navigateWithParams } from './url';

function getThemeClass(): 'theme-default' | 'theme-contrast' | 'theme-warm' | 'theme-dark' {
  if (typeof document === 'undefined') return 'theme-default';
  const cls = document.documentElement.classList;
  if (cls.contains('theme-dark')) return 'theme-dark';
  if (cls.contains('theme-warm')) return 'theme-warm';
  if (cls.contains('theme-contrast')) return 'theme-contrast';
  return 'theme-default';
}

export function AuthLandingPage() {
  const [allowOwnerCreate, setAllowOwnerCreate] = useState(true);
  const [themeClass, setThemeClass] = useState<'theme-default' | 'theme-contrast' | 'theme-warm' | 'theme-dark'>(() => getThemeClass());
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

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => setThemeClass(getThemeClass()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const isLightTheme = themeClass === 'theme-default' || themeClass === 'theme-warm' || themeClass === 'theme-contrast';
  function goOwnerCreate() {
    navigateWithParams({ set: { create: 1 }, delete: ['accept','token','signin','signup','bootstrap'] });
  }

  function goSignIn() {
    navigateWithParams({ set: { signin: 1 }, delete: ['accept','token','signup','bootstrap'] });
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
    background: isLightTheme
      ? 'radial-gradient(ellipse at top, color-mix(in srgb, var(--primary) 16%, transparent 84%), transparent 65%)'
      : 'radial-gradient(ellipse at top, rgba(190,227,248,0.25), transparent 60%)',
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
  const primaryBaseBackground = isLightTheme
    ? 'linear-gradient(120deg, color-mix(in srgb, var(--primary) 70%, #1f2937 30%), color-mix(in srgb, var(--primary) 88%, #1f2937 12%))'
    : 'linear-gradient(120deg, color-mix(in srgb, var(--primary) 85%, #38bdf8 15%), color-mix(in srgb, var(--primary) 78%, #a855f7 22%))';
  const primaryHoverBackground = isLightTheme
    ? 'linear-gradient(120deg, color-mix(in srgb, var(--primary) 82%, #0f172a 18%), color-mix(in srgb, var(--primary) 94%, #0f172a 6%))'
    : 'linear-gradient(120deg, color-mix(in srgb, var(--primary) 94%, #38bdf8 6%), color-mix(in srgb, var(--primary) 90%, #a855f7 10%))';
  const primaryTextColor = isLightTheme ? '#f8fafc' : '#0b1220';
  const primaryShadow = isLightTheme ? '0 16px 30px rgba(15,23,42,0.2)' : '0 16px 40px rgba(37,99,235,0.28)';
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
    background: primaryBaseBackground,
    color: primaryTextColor,
    fontWeight: 600,
    letterSpacing: 0.3,
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
    boxShadow: primaryShadow,
    transform: 'translateY(0)',
  };
  const primaryIconStyle: CSSProperties = { color: primaryTextColor, opacity: 0.95 };
  const secondaryBorder = isLightTheme
    ? '1px solid color-mix(in srgb, var(--text) 42%, transparent 58%)'
    : '1px solid rgba(226,232,240,0.32)';
  const secondaryBaseBackground = isLightTheme ? 'color-mix(in srgb, #ffffff 82%, var(--surface-3) 18%)' : 'rgba(15,23,42,0.65)';
  const secondaryHoverBackground = isLightTheme ? 'color-mix(in srgb, #ffffff 92%, var(--surface-3) 8%)' : 'rgba(148,163,184,0.24)';
  const secondaryTextColor = isLightTheme ? 'color-mix(in srgb, var(--text) 85%, #ffffff 15%)' : '#f8fafc';
  const secondaryHoverBorder = isLightTheme
    ? '1px solid color-mix(in srgb, var(--text) 55%, transparent 45%)'
    : '1px solid rgba(226,232,240,0.45)';
  const secondaryShadow = isLightTheme ? '0 10px 22px rgba(15,23,42,0.12)' : '0 14px 28px rgba(15,23,42,0.45)';
  const secondaryAction: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 28px',
    borderRadius: 999,
    border: secondaryBorder,
    background: secondaryBaseBackground,
    color: secondaryTextColor,
    fontWeight: 600,
    letterSpacing: 0.3,
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
    boxShadow: 'none',
    transform: 'translateY(0)',
  };
  const secondaryIconStyle: CSSProperties = { color: secondaryTextColor, opacity: isLightTheme ? 0.8 : 0.95 };

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
            disabled={!allowOwnerCreate}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              if (btn.disabled) return;
              btn.style.background = primaryHoverBackground;
              btn.style.boxShadow = isLightTheme ? '0 20px 36px rgba(15,23,42,0.24)' : '0 22px 48px rgba(37,99,235,0.38)';
              btn.style.transform = 'translateY(-1px)';
              btn.style.color = primaryTextColor;
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              if (btn.disabled) return;
              btn.style.background = primaryBaseBackground;
              btn.style.boxShadow = primaryShadow;
              btn.style.transform = 'translateY(0)';
              btn.style.color = primaryTextColor;
            }}
          >
            <IconShield size={18} aria-hidden="true" style={primaryIconStyle} /> Create owner account
          </button>
          <button
            onClick={goSignIn}
            className="icon-button"
            style={secondaryAction}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              if (btn.disabled) return;
              btn.style.background = secondaryHoverBackground;
              btn.style.border = secondaryHoverBorder;
              btn.style.transform = 'translateY(-1px)';
              btn.style.boxShadow = secondaryShadow;
              btn.style.color = secondaryTextColor;
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              if (btn.disabled) return;
              btn.style.background = secondaryBaseBackground;
              btn.style.border = secondaryBorder;
              btn.style.transform = 'translateY(0)';
              btn.style.boxShadow = 'none';
              btn.style.color = secondaryTextColor;
            }}
          >
            <IconLogIn size={18} aria-hidden="true" style={secondaryIconStyle} /> Sign in to team
          </button>
        </div>
      </div>
    </div>
  );
}

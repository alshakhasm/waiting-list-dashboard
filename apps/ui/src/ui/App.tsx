import { useEffect, useState } from 'react';
import { BacklogPage } from './BacklogPage';
import { SchedulePage } from './SchedulePage';
import { MappingProfilesPage } from './MappingProfilesPage';
import { OperatedTablePage } from './OperatedTablePage';
import { ThemeToggle } from './ThemeToggle';
import { AuthBox } from '../auth/AuthBox';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { CategorySidebar } from './CategorySidebar';
import { CategoryPref } from './categoryPrefs';
import { supabase } from '../supabase/client';
import { isGuest, disableGuest, GUEST_EVENT } from '../auth/guest';
import { useAppUserProfile } from '../auth/useAppUserProfile';
import { becomeOwner } from '../client/api';
import { AwaitingApprovalPage } from './AwaitingApprovalPage';
import { AccessDeniedPage } from './AccessDeniedPage';
import { AcceptInvitePage } from './AcceptInvitePage';
import { MembersPage } from './MembersPage';
import { AuthLandingPage } from './AuthLandingPage';
import { SignInPage } from '../auth/SignInPage';
import { EnvDebug } from './EnvDebug';
import { CreateAccountPage } from './CreateAccountPage';

const THEME_KEY = 'ui-theme';

type ThemeMode = 'auto' | 'default' | 'warm' | 'high-contrast' | 'dark';

export function App() {
  const [tab, setTab] = useState<'backlog' | 'schedule' | 'mappings' | 'operated' | 'members'>('backlog');
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'auto'; } catch { return 'auto'; }
  });
  const [nameQuery, setNameQuery] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const setCategoryPrefs = (() => {
    // Keep sidebar changes persisted without storing a local copy
    return (prefs: CategoryPref[]) => {
      try { localStorage.setItem('category-prefs', JSON.stringify(prefs)); } catch {}
    };
  })();
  const [scheduleFull, setScheduleFull] = useState(false);
  const { role, user } = useSupabaseAuth();
  const [guest, setGuest] = useState<boolean>(() => isGuest());
  const { loading: profileLoading, profile, error: profileError } = useAppUserProfile();
  const [ownerAction, setOwnerAction] = useState<{ pending: boolean; msg: string | null }>({ pending: false, msg: null });
  // React to external changes to guest mode (e.g., SignInPage action)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setGuest(isGuest());
    window.addEventListener(GUEST_EVENT, handler, { once: true } as any);
    return () => window.removeEventListener(GUEST_EVENT, handler as any);
  }, []);

  // URL shortcut: /?signout=1 — sign the user out, then reload without the flag
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const so = url.searchParams.get('signout');
      if (so === 'force') {
        setSigningOut(true);
        // Remove Supabase auth tokens locally and reload without the flag
        try {
          const ls = window.localStorage;
          const keys = Object.keys(ls);
          for (const k of keys) {
            if (k.startsWith('sb-') || k.startsWith('supabase') || k.includes('auth')) {
              try { ls.removeItem(k); } catch {}
            }
          }
        } catch {}
        url.searchParams.delete('signout');
        window.location.href = url.toString();
        return;
      }
      if (so === '1') {
        setSigningOut(true);
        (async () => {
          const redirect = () => {
            url.searchParams.delete('signout');
            window.location.href = url.toString();
          };
          try {
            // Clear locally without waiting on network
            await supabase?.auth.signOut({ scope: 'local' } as any);
          } catch {}
          // Try to also revoke on the server, but don't block UI >3s
          try {
            await Promise.race([
              supabase?.auth.signOut(),
              new Promise((resolve) => setTimeout(resolve, 3000))
            ] as any);
          } catch {}
          finally {
            redirect();
          }
        })();
      }
    } catch {}
  }, []);

  // Apply theme class on documentElement (must come before any early returns so hooks order is stable)
  useEffect(() => {
    // Persist selected mode
    try { localStorage.setItem(THEME_KEY, theme); } catch {}

    // Compute effective theme
    let effective: 'default' | 'warm' | 'high-contrast' | 'dark' = 'default';
    if (theme === 'auto') {
      const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effective = prefersDark ? 'dark' : 'default';
    } else if (theme === 'dark') {
      effective = 'dark';
    } else if (theme === 'warm') {
      effective = 'warm';
    } else if (theme === 'high-contrast') {
      effective = 'high-contrast';
    }
  // no-op: resolved state not needed outside this effect

    // Apply class to documentElement
    const cls = effective === 'high-contrast' ? 'theme-contrast' : effective === 'warm' ? 'theme-warm' : effective === 'dark' ? 'theme-dark' : 'theme-default';
    const de = document.documentElement;
    de.classList.remove('theme-default', 'theme-contrast', 'theme-warm', 'theme-dark');
    de.classList.add(cls);

    // Setup system theme listener in auto mode
    let mq: MediaQueryList | null = null;
    const handler = (e: MediaQueryListEvent) => {
      if (theme !== 'auto') return;
      const prefersDark = e.matches;
  // no-op: resolved state not needed outside this effect
      const klass = prefersDark ? 'theme-dark' : 'theme-default';
      de.classList.remove('theme-default', 'theme-contrast', 'theme-warm', 'theme-dark');
      de.classList.add(klass);
    };
    if (theme === 'auto' && typeof window !== 'undefined' && window.matchMedia) {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if ((mq as any).addListener) (mq as any).addListener(handler);
    }
    return () => {
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener('change', handler);
        else if ((mq as any).removeListener) (mq as any).removeListener(handler);
      }
    };
  }, [theme]);

  if (signingOut) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
        <div>
          <div style={{ fontSize: 18, marginBottom: 8 }}>Signing you out…</div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>Please wait a moment.</div>
        </div>
      </div>
    );
  }
  // If Supabase is configured and user is not signed in, show the sign-in page unless in guest mode.
  if (supabase && !user && !guest) {
    // Show landing first; it will route to sign-in, owner create, or accept invite
    const url = new URL(window.location.href);
    if (url.searchParams.get('create') === '1') return <CreateAccountPage />;
    if (url.searchParams.get('accept') === '1') return <AcceptInvitePage />;
    if (url.searchParams.get('signin') === '1') return <SignInPage />;
    return <AuthLandingPage />;
  }
  // Manual auth landing trigger (works even if Supabase is not configured)
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
      if (url.searchParams.get('auth') === '1' && (!supabase || !user)) {
      if (url.searchParams.get('create') === '1') return <CreateAccountPage />;
      return <AuthLandingPage />;
    }
  }
  // Accept invite route shortcut: /?accept=1&token=...
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (url.searchParams.get('accept') === '1') {
      return <AcceptInvitePage />;
    }
  }
  // If signed in, gate by app_users profile
  if (supabase && user) {
    if (profileLoading) {
      return (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
          <div>
            <div style={{ fontSize: 18, marginBottom: 8 }}>Loading your account…</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>Please wait while we set up your access.</div>
          </div>
        </div>
      );
    }
    if (profileError) {
      return (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Could not load your account</h2>
            <div style={{ fontSize: 13, opacity: 0.8, maxWidth: 520 }}>Error: {profileError}</div>
            <div style={{ marginTop: 10 }}>
              <EnvDebug />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <button onClick={() => window.location.reload()} disabled={ownerAction.pending}>Retry</button>
              <button
                onClick={async () => {
                  setOwnerAction({ pending: true, msg: null });
                  // Add a short timeout so we surface errors instead of appearing to hang
                  const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([
                    p,
                    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('becomeOwner timed out')), ms))
                  ]) as Promise<T>;
                  try {
                    await withTimeout(becomeOwner(), 15000);
                    window.location.reload();
                  } catch (e: any) {
                    setOwnerAction({ pending: false, msg: e?.message || String(e) });
                  }
                }}
                disabled={ownerAction.pending}
              >
                {ownerAction.pending ? 'Becoming owner…' : 'Become owner now'}
              </button>
              <button onClick={() => { const u = new URL(window.location.href); u.searchParams.set('signin','1'); window.location.href = u.toString(); }} disabled={ownerAction.pending}>Go to Sign in</button>
              <button
                onClick={async () => {
                  try { await supabase?.auth.signOut({ scope: 'local' } as any); } catch {}
                  try {
                    await Promise.race([
                      supabase?.auth.signOut(),
                      new Promise((resolve) => setTimeout(resolve, 3000))
                    ] as any);
                  } catch {}
                  finally { window.location.href = window.location.origin; }
                }}
                disabled={ownerAction.pending}
              >
                Sign out
              </button>
              <button
                onClick={() => { const u = new URL(window.location.href); u.searchParams.set('signout','force'); window.location.href = u.toString(); }}
                disabled={ownerAction.pending}
                title="Clear local session immediately"
              >
                Force sign out
              </button>
              {ownerAction.msg && (
                <span style={{ marginLeft: 8, fontSize: 12, color: '#a11' }}>Error: {ownerAction.msg}</span>
              )}
            </div>
          </div>
        </div>
      );
    }
    if (!profile) return <AccessDeniedPage />;
    if (profile.status === 'pending') return <AwaitingApprovalPage />;
    if (profile.status === 'revoked') return <AccessDeniedPage />;
  }
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', gap: 12, alignItems: 'center', padding: 16, background: 'var(--surface-3)', borderBottom: '1px solid var(--border)', boxShadow: `0 2px 6px var(--shadow)` }}>
        <strong>OR Waiting & Scheduling</strong>
        {typeof window !== 'undefined' && new URL(window.location.href).searchParams.get('debug') === '1' && (
          <div style={{ marginLeft: 8 }}>
            <EnvDebug />
          </div>
        )}
        <nav style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('backlog')}>Backlog</button>
          <button onClick={() => setTab('schedule')}>Schedule</button>
          {tab === 'schedule' && (
            <button
              title={scheduleFull ? 'Exit full screen calendar' : 'Full screen calendar'}
              aria-label={scheduleFull ? 'Exit full screen calendar' : 'Full screen calendar'}
              aria-pressed={scheduleFull}
              onClick={() => setScheduleFull(v => !v)}
              style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span aria-hidden="true" style={{ fontSize: 16, lineHeight: '1' }}>
                {scheduleFull ? '⤢' : '⛶'}
              </span>
            </button>
          )}
          <button onClick={() => setTab('mappings')}>Mapping Profiles</button>
          <button onClick={() => setTab('operated')}>Operated</button>
          {profile?.role === 'owner' && (
            <button onClick={() => setTab('members')}>Members</button>
          )}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {tab === 'backlog' && (
            <input placeholder="Search name/procedure" value={nameQuery} onChange={e => setNameQuery(e.target.value)} />
          )}
          <span style={{ fontSize: 12, opacity: 0.7 }}>{role ? `role: ${role}` : ''}</span>
          {guest && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 6px', border: '1px dashed var(--border)', borderRadius: 6, fontSize: 12 }}>
              Guest
              <button onClick={() => { disableGuest(); setGuest(false); }} title="Exit guest mode">Exit</button>
            </span>
          )}
          <ThemeToggle theme={theme} onChange={(t) => setTheme(t)} />
          <AuthBox />
        </div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: (tab === 'schedule' && scheduleFull) || tab === 'operated' ? '1fr' : 'auto 1fr', gap: 8, padding: 16 }}>
        {!(tab === 'schedule' && scheduleFull) && tab !== 'operated' && (
          <CategorySidebar onChange={setCategoryPrefs} />
        )}
        <div style={{ minWidth: 0, overflow: 'auto' }}>
          {/* Legend removed per request */}
          {tab === 'backlog' && <BacklogPage search={nameQuery} canConfirm={false} />}
          {tab === 'schedule' && <SchedulePage isFull={scheduleFull} />}
          {tab === 'mappings' && <MappingProfilesPage />}
          {tab === 'operated' && <OperatedTablePage />}
          {tab === 'members' && <MembersPage />}
        </div>
      </div>
    </div>
  );
}

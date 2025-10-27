import { useEffect, useState } from 'react';
import { BacklogPage } from './BacklogPage';
import { SchedulePage } from './SchedulePage';
import { MonthlySchedulePage } from './MonthlySchedulePage';
import { DummyCasePage } from './DummyCasePage';
import { OperatedTablePage } from './OperatedTablePage';
import { ThemeToggle } from './ThemeToggle';
import { AuthBox } from '../auth/AuthBox';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { CategorySidebar } from './CategorySidebar';
import { CategoryPref } from './categoryPrefs';
import { supabase } from '../supabase/client';
import { isGuest, disableGuest, GUEST_EVENT } from '../auth/guest';
import { useAppUserProfile } from '../auth/useAppUserProfile';
import { becomeOwner, getMyOwnerProfile, getWorkspaceOwnerProfile, getCurrentAppUser, broadcastWorkspaceSync } from '../client/api';
import { AwaitingApprovalPage } from './AwaitingApprovalPage';
import { AccessDeniedPage } from './AccessDeniedPage';
import { AcceptInvitePage } from './AcceptInvitePage';
import { MembersPage } from './MembersPage';
import { ArchivePage } from './ArchivePage';
import { ComprehensiveListPage } from './ComprehensiveListPage';
import { AuthLandingPage } from './AuthLandingPage';
import { SignInPage } from '../auth/SignInPage';
import { ResetPasswordPage } from '../auth/ResetPasswordPage';
import { EnvDebug } from './EnvDebug';
import { CreateAccountPage } from './CreateAccountPage';
import { IntakePage } from './IntakePage';
import { IntakeLinksPage } from './IntakeLinksPage';
import { MappingProfilesPage } from './MappingProfilesPage';
import { CardRollerPage } from './CardRollerPage';
import { OwnerSettingsPage } from './OwnerSettingsPage';
import { AccountSettingsPage } from './AccountSettingsPage';
import { TabButton } from './TabButton';
import { BUILD_INFO } from '../buildInfo';
import { triggerGlobalSync } from '../hooks/useSyncBroadcast';

const THEME_KEY = 'ui-theme';

type ThemeMode = 'auto' | 'default' | 'warm' | 'high-contrast' | 'dark';

export function App() {
  type Tab = 'backlog' | 'schedule' | 'monthly' | 'dummy' | 'mappings' | 'operated' | 'list' | 'archive' | 'members' | 'intake-links' | 'roller' | 'owner-settings' | 'account-settings';
  const TAB_KEY = 'ui-last-tab';
  const isTab = (v: any): v is Tab => (
    v === 'backlog' || v === 'schedule' || v === 'mappings' || v === 'operated' || v === 'list' || v === 'archive' || v === 'members' || v === 'intake-links' || v === 'roller' || v === 'owner-settings' || v === 'account-settings'
  );
  // Backlog label can be overridden via env (build-time) or localStorage (runtime)
  const ENV_BACKLOG_LABEL = (import.meta as any)?.env?.VITE_BACKLOG_TAB_LABEL as string | undefined;
  // App title can be overridden via env or localStorage
  const ENV_APP_TITLE = (import.meta as any)?.env?.VITE_APP_TITLE as string | undefined;
  const [appTitle, setAppTitle] = useState<string>(() => {
    try {
      return localStorage.getItem('ui-app-title') || ENV_APP_TITLE || 'Surgery Schedule';
    } catch {
      return ENV_APP_TITLE || 'Surgery Schedule';
    }
  });
  const [backlogLabel, setBacklogLabel] = useState<string>(() => {
    try {
      return (ENV_BACKLOG_LABEL || localStorage.getItem('ui-backlog-label') || 'Dashboard');
    } catch {
      return ENV_BACKLOG_LABEL || 'Dashboard';
    }
  });
  // If a build-time label is provided, prefer it on initial mount and persist it into localStorage
  useEffect(() => {
    if (ENV_BACKLOG_LABEL && backlogLabel !== ENV_BACKLOG_LABEL) {
      setBacklogLabel(ENV_BACKLOG_LABEL);
      try { localStorage.setItem('ui-backlog-label', ENV_BACKLOG_LABEL); } catch {}
    }
  }, []);
  // Prefer build-time app title on mount
  useEffect(() => {
    if (ENV_APP_TITLE && appTitle !== ENV_APP_TITLE) {
      setAppTitle(ENV_APP_TITLE);
      try { localStorage.setItem('ui-app-title', ENV_APP_TITLE); } catch {}
    }
  }, []);
  // Keep document.title in sync
  useEffect(() => {
    try { document.title = appTitle; } catch {}
  }, [appTitle]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ui-backlog-label') setBacklogLabel(e.newValue || ENV_BACKLOG_LABEL || 'Dashboard');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      return isTab(saved) ? saved : 'backlog';
    } catch {
      return 'backlog';
    }
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'auto'; } catch { return 'auto'; }
  });
  const [nameQuery, setNameQuery] = useState<string>(() => {
    try { return localStorage.getItem('backlog.search') || ''; } catch { return ''; }
  });
  useEffect(() => {
    try { localStorage.setItem('backlog.search', nameQuery); } catch {}
  }, [nameQuery]);
  const [signingOut, setSigningOut] = useState(false);
  const setCategoryPrefs = (() => {
    // Keep sidebar changes persisted without storing a local copy
    return (prefs: CategoryPref[]) => {
      try { localStorage.setItem('category-prefs', JSON.stringify(prefs)); } catch {}
    };
  })();
  const [scheduleFull, setScheduleFull] = useState<boolean>(() => {
    try { return (localStorage.getItem('schedule.full') === '1'); } catch { return false; }
  });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try { return (localStorage.getItem('sidebar.open') !== '0'); } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('schedule.full', scheduleFull ? '1' : '0'); } catch {}
  }, [scheduleFull]);
  useEffect(() => {
    try { localStorage.setItem('sidebar.open', sidebarOpen ? '1' : '0'); } catch {}
  }, [sidebarOpen]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onDataChanged = () => setBacklogReloadKey(k => k + 1);
    window.addEventListener('dashboard-data-changed', onDataChanged);
    return () => window.removeEventListener('dashboard-data-changed', onDataChanged);
  }, []);
  const [backlogReloadKey, setBacklogReloadKey] = useState(0);
  const [selectedBacklogId, setSelectedBacklogId] = useState<string | undefined>(() => {
    try { return localStorage.getItem('backlog.selectedId') || undefined; } catch { return undefined; }
  });
  useEffect(() => {
    try {
      if (selectedBacklogId) localStorage.setItem('backlog.selectedId', selectedBacklogId);
      else localStorage.removeItem('backlog.selectedId');
    } catch {}
  }, [selectedBacklogId]);
  const { role, user } = useSupabaseAuth();
  const [guest, setGuest] = useState<boolean>(() => isGuest());
  const { loading: profileLoading, profile, error: profileError } = useAppUserProfile();
  const [ownerAction, setOwnerAction] = useState<{ pending: boolean; msg: string | null }>({ pending: false, msg: null });
  const [ownerName, setOwnerName] = useState<string>('');
  const [memberName, setMemberName] = useState<string>('');
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

  // Persist last selected tab
  useEffect(() => {
    try { localStorage.setItem(TAB_KEY, tab); } catch {}
  }, [tab]);

  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger on Shift key combinations
      if (!e.shiftKey) return;
      
      // Prevent conflicts with text inputs
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      
      const key = e.key.toLowerCase();
      const shortcuts: Record<string, Tab> = {
        'd': 'backlog',        // Shift+D for Dashboard
        'r': 'roller',         // Shift+R for Roller
        's': 'schedule',       // Shift+S for Schedule
        'm': 'monthly',        // Shift+M for Monthly
        'c': 'dummy',          // Shift+C for Case (Dummy)
        'l': 'list',           // Shift+L for List
        'a': 'archive',        // Shift+A for Archive
        'o': 'operated',       // Shift+O for Operated
      };
      
      if (key in shortcuts) {
        e.preventDefault();
        setTab(shortcuts[key]);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load owner profile name for header indicator (for all users, not just owners)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Get workspace owner profile (works for both owners and members)
        const p = await getWorkspaceOwnerProfile();
        if (!cancelled) setOwnerName(p?.fullName || '');
      } catch {
        if (!cancelled) setOwnerName(user?.email || '');
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.role, user?.email]);

  // Load member/current user name for header display
  useEffect(() => {
    if (supabase && user?.id) {
      // Try to get full name from database first
      (async () => {
        try {
          const appUser = await getCurrentAppUser();
          if (appUser?.fullName) {
            setMemberName(appUser.fullName);
            return;
          }
        } catch {}
        
        // Fallback: try auth user's user_metadata
        try {
          const { data, error } = await supabase.auth.getUser();
          if (!error && data.user) {
            const fullName = (data.user.user_metadata as any)?.full_name || (data.user.user_metadata as any)?.name || '';
            if (fullName) {
              setMemberName(fullName);
              return;
            }
          }
        } catch {}
        
        // Final fallback: use email name (part before @)
        if (user.email) {
          const emailName = user.email.split('@')[0];
          setMemberName(emailName);
        }
      })();
    } else if (user?.email) {
      // Fallback: use email name (part before @)
      const emailName = user.email.split('@')[0];
      setMemberName(emailName);
    }
  }, [user?.email, user?.id]);

  // Do not auto-switch tabs; restricted tabs will render an AccessDenied page for non-owners

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

  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    const type = url.searchParams.get('type');
    const resetFlag = url.searchParams.get('reset');
    const hash = window.location.hash || '';
    if (type === 'recovery' || resetFlag === '1' || hash.includes('type=recovery') || hash.includes('access_token=')) {
      return <ResetPasswordPage />;
    }
  }
  // If Supabase is configured and user is not signed in, show the sign-in page unless in guest mode.
  if (supabase && !user && !guest) {
    // Show landing first; it will route to sign-in, owner create, or accept invite
    const url = new URL(window.location.href);
    // Dedicated reset password page (linked from email), flagged by ?reset=1
    if (url.searchParams.get('reset') === '1') return <ResetPasswordPage />;
    if (url.searchParams.get('intake') === '1') return <IntakePage />;
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
    if (url.searchParams.get('intake') === '1') {
      return <IntakePage />;
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
    // Show loading state while profile is loading (prevents flash of AccessDenied)
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
    if (!profile) return <AccessDeniedPage />;
    if (profile.status === 'pending') return <AwaitingApprovalPage />;
    if (profile.status === 'revoked') return <AccessDeniedPage />;
  }
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        /* Global reset to remove UA margins and ensure full-bleed layout */
        html, body, #root { margin: 0; padding: 0; height: 100%; }
        body { background: var(--surface-2, #ffffff); color: var(--text, #111111); }

        /* Global form control contrast adjustments (especially for dark mode) */
        select, input, textarea {
          background: var(--surface-1);
          color: var(--text);
          border: 1px solid var(--border);
        }
        select:disabled, input:disabled, textarea:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        option { color: var(--text); background: var(--surface-1); }
        ::placeholder { color: color-mix(in srgb, var(--text), transparent 45%); }
      `}</style>
    <header style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', gap: 16, alignItems: 'center', padding: '12px 20px', background: 'var(--surface-3)', borderBottom: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)' }}>
      {/* Logo/Title Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 'fit-content' }}>
        <strong style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--text)' }}>{appTitle}</strong>
      </div>

      {/* Navigation Section */}
      <nav style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
        {/* Sidebar Toggle - placed next to navigation */}
        {!(tab === 'schedule' && scheduleFull) && tab !== 'operated' && tab !== 'roller' && tab !== 'owner-settings' && tab !== 'monthly' && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            aria-label="Toggle sidebar"
            aria-pressed={sidebarOpen}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: sidebarOpen ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', fontSize: 14, lineHeight: 1, transition: 'all 0.2s', color: 'var(--text)', marginRight: 4 }}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
        )}
        <TabButton label={backlogLabel} isActive={tab === 'backlog'} onClick={() => setTab('backlog')} shortcut="Shift+D" />
        <TabButton label="Roller Viewer" isActive={tab === 'roller'} onClick={() => setTab('roller')} shortcut="Shift+R" />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <TabButton label="Schedule Viewer" isActive={tab === 'schedule'} onClick={() => setTab('schedule')} shortcut="Shift+S" />
          {tab === 'schedule' && (
            <button
              title={scheduleFull ? 'Exit full screen calendar' : 'Full screen calendar'}
              aria-label={scheduleFull ? 'Exit full screen calendar' : 'Full screen calendar'}
              aria-pressed={scheduleFull}
              onClick={() => setScheduleFull(v => !v)}
              style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid var(--border)', background: scheduleFull ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <span aria-hidden="true" style={{ fontSize: 16, lineHeight: '1' }}>
                {scheduleFull ? '⤢' : '⛶'}
              </span>
            </button>
          )}
        </span>
        <TabButton label="Monthly Viewer" isActive={tab === 'monthly'} onClick={() => setTab('monthly')} shortcut="Shift+M" />
        <TabButton label="Case Creator" isActive={tab === 'dummy'} onClick={() => setTab('dummy')} shortcut="Shift+C" />
        <TabButton label="List Viewer" isActive={tab === 'list'} onClick={() => setTab('list')} shortcut="Shift+L" />
        <details style={{ position: 'relative' }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'BUTTON') {
              const details = (target.closest('details')) as HTMLDetailsElement | null;
              details?.removeAttribute('open');
            }
          }}
        >
          <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text)', background: 'transparent', fontSize: 13, fontWeight: 500, transition: 'all 0.2s', userSelect: 'none' }}>More ▾</summary>
          <div style={{ position: 'absolute', marginTop: 6, minWidth: 220, background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', padding: 10, display: 'grid', gap: 6, zIndex: 1000 }}>
            {/* Data Views Section */}
            <div style={{ fontSize: 10, opacity: 0.65, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, paddingLeft: 4, marginTop: 4 }}>📊 Data Views</div>
            <button onClick={() => setTab('archive')} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 13, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', transition: 'background 0.15s' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>Archive</button>
            <button onClick={() => setTab('operated')} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 13, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', transition: 'background 0.15s' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>Operated</button>
            
            {/* Configuration Section */}
            <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '8px 0', opacity: 0.5 }} />
            <div style={{ fontSize: 10, opacity: 0.65, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, paddingLeft: 4 }}>⚙️ Configuration</div>
            <button onClick={() => setTab('mappings')} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 13, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', transition: 'background 0.15s' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>Mapping Profiles</button>
            
            {/* Admin Section */}
            {profile?.role === 'owner' && (
              <>
                <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '8px 0', opacity: 0.5 }} />
                <div style={{ fontSize: 10, opacity: 0.65, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, paddingLeft: 4 }}>🔐 Admin</div>
                <button onClick={() => setTab('members')} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 13, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', transition: 'background 0.15s' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>Members</button>
                <button onClick={() => setTab('intake-links')} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 13, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', transition: 'background 0.15s' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>Intake Links</button>
                
                {/* Customization Section */}
                <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '8px 0', opacity: 0.5 }} />
                <div style={{ fontSize: 10, opacity: 0.65, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, paddingLeft: 4 }}>✏️ Customize</div>
                <div style={{ display: 'grid', gap: 6, padding: '6px 0' }}>
                  <label style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>Rename "Backlog" tab</label>
                  <input
                    value={backlogLabel}
                    onChange={(e) => {
                      const v = e.target.value || 'Dashboard';
                      setBacklogLabel(v);
                      try { localStorage.setItem('ui-backlog-label', v); } catch {}
                    }}
                    placeholder={backlogLabel || 'Dashboard'}
                    style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, background: 'var(--surface-1)', color: 'var(--text)' }}
                  />
                </div>
                <div style={{ display: 'grid', gap: 6, padding: '6px 0' }}>
                  <label style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>App title</label>
                  <input
                    value={appTitle}
                    onChange={(e) => {
                      const v = e.target.value || 'Surgery Schedule';
                      setAppTitle(v);
                      try { localStorage.setItem('ui-app-title', v); } catch {}
                    }}
                    placeholder="Surgery Schedule"
                    style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, background: 'var(--surface-1)', color: 'var(--text)' }}
                  />
                </div>
              </>
            )}
          </div>
        </details>
      </nav>

      {/* Right Section - User Info & Controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 'fit-content', marginLeft: 'auto' }}>
        {/* Sync Button - Forces all pages and workspace members to refresh */}
        <button
          onClick={async () => {
            console.log('[UI] manual sync triggered by user');
            try {
              // Broadcast to this workspace's members
              await broadcastWorkspaceSync();
              // Sync local tabs/windows
              await triggerGlobalSync();
            } catch (err) {
              console.warn('[UI] broadcast sync failed, falling back to local sync:', err);
              // Fallback to just local sync
              await triggerGlobalSync();
            }
          }}
          title="Sync data across all open pages, windows, and workspace members"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 6,
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface-2)';
          }}
        >
          🔄 Sync
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: 24, background: 'var(--border)', opacity: 0.5 }} />

        {/* User Info */}
        {profile?.role === 'owner' && ownerName && (
          <button
            onClick={() => setTab('owner-settings')}
            title="Click to edit owner settings"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              padding: '8px 12px',
              borderRadius: 6,
              background: tab === 'owner-settings' ? 'var(--primary)' : 'var(--primary)',
              color: tab === 'owner-settings' ? 'var(--primary-contrast)' : 'var(--primary-contrast)',
              border: '1px solid var(--primary)',
              cursor: 'pointer',
              fontWeight: 700,
              minWidth: 'fit-content',
              letterSpacing: '0.3px',
              transition: 'all 0.2s',
              boxShadow: tab === 'owner-settings' ? 'inset 0 0 0 2px var(--border)' : 'none'
            }}
          >
            {ownerName}
            <span style={{ fontSize: 14, fontWeight: 700 }}>›</span>
          </button>
        )}
        {profile?.role !== 'owner' && ownerName && memberName && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span title="Workspace Owner" style={{ fontSize: 13, padding: '6px 10px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text)', fontWeight: 600, minWidth: 'fit-content', border: '1px solid var(--border)' }}>
              👤 {ownerName}
            </span>
            <div style={{ width: '1px', height: 20, background: 'var(--border)', opacity: 0.3 }} />
            <button
              onClick={() => setTab('account-settings')}
              title="Click to edit your account details"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                padding: '8px 12px',
                borderRadius: 6,
                background: tab === 'account-settings' ? 'var(--primary)' : 'var(--primary)',
                color: tab === 'account-settings' ? 'var(--primary-contrast)' : 'var(--primary-contrast)',
                border: '1px solid var(--primary)',
                cursor: 'pointer',
                fontWeight: 600,
                minWidth: 'fit-content',
                transition: 'all 0.2s',
                boxShadow: tab === 'account-settings' ? 'inset 0 0 0 2px var(--border)' : 'none'
              }}
            >
              {memberName}
              <span style={{ fontSize: 14, fontWeight: 700 }}>›</span>
            </button>
          </div>
        )}
        {profile?.role !== 'owner' && !ownerName && memberName && (
          <button
            onClick={() => setTab('account-settings')}
            title="Click to edit your account details"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'var(--primary)',
              color: 'var(--primary-contrast)',
              border: '1px solid var(--primary)',
              cursor: 'pointer',
              fontWeight: 600,
              minWidth: 'fit-content',
              transition: 'all 0.2s',
              boxShadow: tab === 'account-settings' ? 'inset 0 0 0 2px var(--border)' : 'none'
            }}
          >
            {memberName}
            <span style={{ fontSize: 14, fontWeight: 700 }}>›</span>
          </button>
        )}
        {role && (
          <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, background: 'var(--surface-1)', color: 'var(--text)', opacity: 0.75, minWidth: 'fit-content', fontWeight: 500 }}>
            {role}
          </span>
        )}
        {guest && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', border: '1px dashed var(--border)', borderRadius: 5, fontSize: 11, fontWeight: 500 }}>
            🔓 Guest
            <button onClick={() => { disableGuest(); setGuest(false); }} title="Exit guest mode" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)', fontWeight: 600 }}>✕</button>
          </span>
        )}

        {/* Theme & Auth */}
        <ThemeToggle theme={theme} onChange={(t) => setTheme(t)} />
        <AuthBox />
      </div>
    </header>
      <div style={{
        display: 'grid',
        gridTemplateColumns: (tab === 'schedule' && scheduleFull) || tab === 'operated' || tab === 'roller' || tab === 'owner-settings' || tab === 'account-settings' || tab === 'monthly' ? '1fr' : (sidebarOpen ? 'auto 1fr' : '1fr'),
        gap: 0,
  padding: 12,
        // Ensure the content area (including sidebar) fills the viewport below the header
        minHeight: 'calc(100vh - 64px)'
      }}>
        {!(tab === 'schedule' && scheduleFull) && tab !== 'operated' && tab !== 'roller' && tab !== 'owner-settings' && tab !== 'monthly' && sidebarOpen && (
          <CategorySidebar
            onChange={setCategoryPrefs}
            onAddedCase={() => setBacklogReloadKey(k => k + 1)}
            onSearchChange={(q) => setNameQuery(q)}
          />
        )}
  <div style={{ minWidth: 0, overflow: 'auto', paddingLeft: 0 }}>
          {/* Legend removed per request */}
          {tab === 'backlog' && (
            <BacklogPage
              search={nameQuery}
              canConfirm={false}
              reloadKey={backlogReloadKey}
              selectedId={selectedBacklogId}
              onSelect={(it) => setSelectedBacklogId(it?.id)}
            />
          )}
          {tab === 'roller' && <CardRollerPage />}
          {tab === 'schedule' && <SchedulePage isFull={scheduleFull} />}
          {tab === 'monthly' && <MonthlySchedulePage />}
          {tab === 'dummy' && <DummyCasePage />}
          {tab === 'mappings' && <MappingProfilesPage />}
          {tab === 'operated' && <OperatedTablePage />}
          {tab === 'members' && (profile?.role === 'owner' ? <MembersPage /> : <AccessDeniedPage />)}
          {tab === 'intake-links' && (profile?.role === 'owner' ? <IntakeLinksPage /> : <AccessDeniedPage />)}
          {tab === 'list' && <ComprehensiveListPage reloadKey={backlogReloadKey} />}
          {tab === 'archive' && <ArchivePage reloadKey={backlogReloadKey} />}
          {tab === 'owner-settings' && <OwnerSettingsPage />}
          {tab === 'account-settings' && <AccountSettingsPage />}
        </div>
      </div>
      {/* Build footer */}
      <footer style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text)', fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>
          Deployed
          {BUILD_INFO.time ? ` ${new Date(BUILD_INFO.time).toLocaleString()}` : ''}
        </span>
        {BUILD_INFO.hash && (
          <span title={BUILD_INFO.hash} style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
            {BUILD_INFO.hash.slice(0, 7)}
          </span>
        )}
      </footer>
    </div>
  );
}

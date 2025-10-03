import { useEffect, useState } from 'react';
import { BacklogPage } from './BacklogPage';
import { SchedulePage } from './SchedulePage';
import { MappingProfilesPage } from './MappingProfilesPage';
import { OperatedTablePage } from './OperatedTablePage';
import { ThemeToggle } from './ThemeToggle';
import { AuthBox } from '../auth/AuthBox';
import { SignInPage } from '../auth/SignInPage';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { CategorySidebar } from './CategorySidebar';
import { CategoryPref, defaultCategoryPrefs, loadCategoryPrefs } from './categoryPrefs';
import { supabase } from '../supabase/client';
import { isGuest, disableGuest, GUEST_EVENT } from '../auth/guest';

const THEME_KEY = 'ui-theme';

type ThemeMode = 'auto' | 'default' | 'warm' | 'high-contrast' | 'dark';

export function App() {
  const [tab, setTab] = useState<'backlog' | 'schedule' | 'mappings' | 'operated'>('backlog');
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'auto'; } catch { return 'auto'; }
  });
  const [resolved, setResolved] = useState<'default' | 'warm' | 'high-contrast' | 'dark'>(() => 'default');
  const [nameQuery, setNameQuery] = useState('');
  const [categoryPrefs, setCategoryPrefs] = useState<CategoryPref[]>(() => loadCategoryPrefs(defaultCategoryPrefs()));
  const [scheduleFull, setScheduleFull] = useState(false);
  const { role, user } = useSupabaseAuth();
  const [guest, setGuest] = useState<boolean>(() => isGuest());
  // React to external changes to guest mode (e.g., SignInPage action)
  if (typeof window !== 'undefined') {
    window.addEventListener(GUEST_EVENT, () => setGuest(isGuest()), { once: true });
  }
  // If Supabase is configured and user is not signed in, show the sign-in page unless in guest mode.
  if (supabase && !user && !guest) {
    return <SignInPage />;
  }
  // Apply theme class on documentElement
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
    setResolved(effective);

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
      const eff = prefersDark ? 'dark' : 'default';
      setResolved(eff);
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
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', gap: 12, alignItems: 'center', padding: 16, background: 'var(--surface-3)', borderBottom: '1px solid var(--border)', boxShadow: `0 2px 6px var(--shadow)` }}>
        <strong>OR Waiting & Scheduling</strong>
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
        </div>
      </div>
    </div>
  );
}

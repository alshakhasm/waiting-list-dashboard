import { useState } from 'react';
import { BacklogPage } from './BacklogPage';
import { SchedulePage } from './SchedulePage';
import { MappingProfilesPage } from './MappingProfilesPage';
import { ThemeToggle } from './ThemeToggle';
import { useEffect } from 'react';
import { getLegend, LegendEntry } from '../client/api';
import { AuthBox } from '../auth/AuthBox';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';

export function App() {
  const [tab, setTab] = useState<'backlog' | 'schedule' | 'mappings'>('backlog');
  const [theme, setTheme] = useState<'default' | 'high-contrast'>('default');
  const [legend, setLegend] = useState<LegendEntry[]>([]);
  const [nameQuery, setNameQuery] = useState('');
  const [scheduleFull, setScheduleFull] = useState(false);
  const { role } = useSupabaseAuth();
  useEffect(() => { (async () => setLegend(await getLegend(theme)))(); }, [theme]);
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 16 }}>
      <header style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
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
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {tab === 'backlog' && (
            <input placeholder="Search name/procedure" value={nameQuery} onChange={e => setNameQuery(e.target.value)} />
          )}
          <span style={{ fontSize: 12, opacity: 0.7 }}>{role ? `role: ${role}` : ''}</span>
          <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === 'default' ? 'high-contrast' : 'default')} />
          <AuthBox />
        </div>
      </header>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {legend.map(l => (
          <span key={l.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, background: l.color, display: 'inline-block', borderRadius: 2 }} />
            <small>{l.label}</small>
          </span>
        ))}
      </div>
  {tab === 'backlog' && <BacklogPage search={nameQuery} canConfirm={false} />}
      {tab === 'schedule' && <SchedulePage isFull={scheduleFull} />}
      {tab === 'mappings' && <MappingProfilesPage />}
    </div>
  );
}

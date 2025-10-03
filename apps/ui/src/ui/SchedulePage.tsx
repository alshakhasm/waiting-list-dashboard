import { useEffect, useMemo, useState } from 'react';
import { getSchedule, createSchedule, BacklogItem, ScheduleEntry, confirmSchedule, deleteSchedule, getBacklog, seedDemoData, updateSchedule } from '../client/api';
import { SplitPane } from './SplitPane';
import { WeekCalendar } from './WeekCalendar';
import { CompactCalendar } from './CompactCalendar';
import { BacklogPage } from './BacklogPage';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';

export function SchedulePage({ isFull = false }: { isFull?: boolean }) {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<BacklogItem | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [items, setItems] = useState<BacklogItem[]>([]);
  // full screen is controlled from App header; no internal toggle state
  const { role } = useSupabaseAuth();
  const canConfirm = role ? role === 'senior' : true; // allow by default when no role system

  useEffect(() => {
    (async () => {
      const s = await getSchedule({ date });
      setSchedule(s);
    })();
  }, [date]);

  useEffect(() => {
    (async () => {
      await seedDemoData();
      const data = await getBacklog();
      setItems(data);
    })();
  }, []);

  async function scheduleSelected() {
    if (!selectedItem) return;
    const start = '08:00';
    const end = '09:00';
    const roomId = 'or:1';
    const surgeonId = selectedItem.surgeonId || 's:1';
    await createSchedule({ waitingListItemId: selectedItem.id, roomId, surgeonId, date, startTime: start, endTime: end });
    const s = await getSchedule({ date });
    setSchedule(s);
    if (!pendingIds.includes(selectedItem.id)) setPendingIds((ids) => [...ids, selectedItem.id]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button disabled={!selectedItem} onClick={scheduleSelected}>Schedule selected</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div role="group" aria-label="Calendar view" style={{ display: 'inline-flex', gap: 4 }}>
            <button onClick={() => setView('day')} aria-pressed={view==='day'}>Day</button>
            <button onClick={() => setView('week')} aria-pressed={view==='week'}>Week</button>
            <button onClick={() => setView('month')} aria-pressed={view==='month'}>Month</button>
          </div>
        </div>
      </div>
      {isFull ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <h3 style={{ marginTop: 0 }}>Schedule {view} of {date}</h3>
          <div style={{ position: 'relative', height: '100%' }}>
            <CompactCalendar
              date={date}
              view={view}
              entries={schedule}
              itemById={useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items])}
              onToggleConfirm={async (id, confirmed) => {
                try {
                  if (confirmed) await confirmSchedule(id);
                  else await updateSchedule(id, { status: 'tentative' });
                  const s = await getSchedule({ date });
                  setSchedule(s);
                } catch (e) {
                  console.error('Failed to toggle confirmation', e);
                }
              }}
              onDrop={async ({ date: d, startTime, endTime, data }) => {
                try {
                  const roomId = 'or:1';
                  const surgeonId = data?.surgeonId || 's:1';
                  const itemId = data?.itemId;
                  if (!itemId) return;
                  await createSchedule({ waitingListItemId: itemId, roomId, surgeonId, date: d, startTime, endTime });
                  const s = await getSchedule({ date: d });
                  setSchedule(s);
                  if (!pendingIds.includes(itemId)) setPendingIds((ids) => [...ids, itemId]);
                } catch (e) {
                  console.error('Failed to create schedule from drop', e);
                  const msg = (e as any)?.message || 'Failed to create schedule (check availability)';
                  window.alert?.(msg);
                }
              }}
              onRemoveEntry={async (id) => {
                try {
                  await deleteSchedule(id);
                  const s = await getSchedule({ date });
                  setSchedule(s);
                } catch (e) {
                  console.error('Failed to remove entry', e);
                  window.alert?.('Failed to remove entry');
                }
              }}
              canEdit={true}
            />
          </div>
        </div>
      ) : (
        <SplitPane
          initialLeft={35}
          left={
            <div style={{ paddingRight: 8 }}>
              <h3 style={{ marginTop: 0 }}>Backlog</h3>
              <BacklogPage
                onSelect={(i) => { setSelectedId(i.id); setSelectedItem(i); }}
                selectedId={selectedId || undefined}
                pendingIds={pendingIds}
                hiddenIds={hiddenIds}
                canConfirm={canConfirm}
                onConfirm={async (i) => {
                  try {
                    // Confirm all tentative entries for this backlog item in the current view
                    const toConfirm = schedule.filter(e => e.waitingListItemId === i.id && e.status !== 'confirmed');
                    if (toConfirm.length === 0) {
                      // Nothing to confirm; just hide from dashboard
                      setHiddenIds((h) => (h.includes(i.id) ? h : [...h, i.id]));
                      setPendingIds((ids) => ids.filter(id => id !== i.id));
                      return;
                    }
                    for (const entry of toConfirm) {
                      await confirmSchedule(entry.id);
                    }
                    const s = await getSchedule({ date });
                    setSchedule(s);
                    setHiddenIds((h) => (h.includes(i.id) ? h : [...h, i.id]));
                    setPendingIds((ids) => ids.filter(id => id !== i.id));
                  } catch (e: any) {
                    console.error('Failed to confirm schedule', e);
                    window.alert?.(e?.message || 'Failed to confirm schedule');
                  }
                }}
              />
            </div>
          }
          right={
            <div style={{ height: '100%' }}>
              <h3 style={{ marginTop: 0 }}>Schedule {view} of {date}</h3>
              <div style={{ position: 'relative', height: '100%' }}>
                <CompactCalendar
                  date={date}
                  view={view}
                  entries={schedule}
                  itemById={useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items])}
                  onToggleConfirm={async (id, confirmed) => {
                    try {
                      if (confirmed) await confirmSchedule(id);
                      else await updateSchedule(id, { status: 'tentative' });
                      const s = await getSchedule({ date });
                      setSchedule(s);
                    } catch (e) {
                      console.error('Failed to toggle confirmation', e);
                    }
                  }}
                  onDrop={async ({ date: d, startTime, endTime, data }) => {
                    try {
                      const roomId = 'or:1';
                      const surgeonId = data?.surgeonId || 's:1';
                      const itemId = data?.itemId;
                      if (!itemId) return;
                      await createSchedule({ waitingListItemId: itemId, roomId, surgeonId, date: d, startTime, endTime });
                      const s = await getSchedule({ date: d });
                      setSchedule(s);
                      if (!pendingIds.includes(itemId)) setPendingIds((ids) => [...ids, itemId]);
                    } catch (e) {
                      console.error('Failed to create schedule from drop', e);
                      const msg = (e as any)?.message || 'Failed to create schedule (check availability)';
                      window.alert?.(msg);
                    }
                  }}
                  onRemoveEntry={async (id) => {
                    try {
                      await deleteSchedule(id);
                      const s = await getSchedule({ date });
                      setSchedule(s);
                    } catch (e) {
                      console.error('Failed to remove entry', e);
                      window.alert?.('Failed to remove entry');
                    }
                  }}
                  canEdit={true}
                />
              </div>
            </div>
          }
          style={{ flex: 1, minHeight: 0 }}
        />
      )}
    </div>
  );
}

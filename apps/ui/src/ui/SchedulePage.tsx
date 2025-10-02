import { useEffect, useState } from 'react';
import { getSchedule, createSchedule, BacklogItem, ScheduleEntry, confirmSchedule } from '../client/api';
import { SplitPane } from './SplitPane';
import { WeekCalendar } from './WeekCalendar';
import { BacklogPage } from './BacklogPage';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';

export function SchedulePage() {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<BacklogItem | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const { role } = useSupabaseAuth();
  const canConfirm = role ? role === 'senior' : true; // allow by default when no role system

  useEffect(() => {
    (async () => {
      const s = await getSchedule({ date });
      setSchedule(s);
    })();
  }, [date]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 8 }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button disabled={!selectedItem} onClick={scheduleSelected}>Schedule selected</button>
      </div>
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
            <h3 style={{ marginTop: 0 }}>Schedule week of {date}</h3>
            <WeekCalendar
              date={date}
              entries={schedule}
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
                }
              }}
            />
          </div>
        }
        style={{ flex: 1, minHeight: 0 }}
      />
    </div>
  );
}

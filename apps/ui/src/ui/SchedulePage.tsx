import { useEffect, useMemo, useState, useCallback } from 'react';
import { getSchedule, createSchedule, BacklogItem, ScheduleEntry, confirmSchedule, deleteSchedule, getBacklog, updateSchedule, markScheduleOperated } from '../client/api';
import { SplitPane } from './SplitPane';
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

  const syncBacklogVisibility = useCallback((entries: ScheduleEntry[]) => {
    const pending = new Set<string>();
    const hidden = new Set<string>();
    for (const entry of entries) {
      const id = entry.waitingListItemId;
      if (!id) continue;
      const status = entry.status || 'tentative';
      if (status === 'tentative' || status === 'scheduled') pending.add(id);
      if (status === 'operated') hidden.add(id);
    }
    setPendingIds(Array.from(pending));
    setHiddenIds(Array.from(hidden));
  }, []);

  const refreshSchedule = useCallback(async (targetDate?: string) => {
    const s = await getSchedule({ date: targetDate ?? date });
    const visible = s.filter(entry => entry.status !== 'cancelled');
    const dedup = new Map<string, ScheduleEntry>();
    for (const entry of visible) {
      const key = entry.waitingListItemId || entry.id;
      const existing = dedup.get(key);
      if (!existing) {
        dedup.set(key, entry);
        continue;
      }
      const existingStamp = existing.updatedAt ? Date.parse(existing.updatedAt) : NaN;
      const currentStamp = entry.updatedAt ? Date.parse(entry.updatedAt) : NaN;
      const existingScore = Number.isNaN(existingStamp) ? existing.version ?? 0 : existingStamp;
      const currentScore = Number.isNaN(currentStamp) ? entry.version ?? 0 : currentStamp;
      if (currentScore >= existingScore) dedup.set(key, entry);
    }
    const normalized = Array.from(dedup.values());
    setSchedule(normalized);
    syncBacklogVisibility(normalized);
    return normalized;
  }, [date, syncBacklogVisibility]);

  useEffect(() => {
    refreshSchedule(date);
  }, [date, refreshSchedule]);

  useEffect(() => {
    (async () => {
      const data = await getBacklog();
      setItems(data);
    })();
  }, []);

  const itemLookup = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);

  async function handleToggleConfirm(id: string, confirmed: boolean) {
    try {
      if (confirmed) await confirmSchedule(id);
      else await updateSchedule(id, { status: 'tentative' });
      await refreshSchedule();
    } catch (e) {
      console.error('Failed to toggle confirmation', e);
      window.alert?.((e as any)?.message || 'Failed to update confirmation');
    }
  }

  async function handleToggleOperated(id: string, operated: boolean) {
    try {
      await markScheduleOperated(id, operated);
      await refreshSchedule();
    } catch (e) {
      console.error('Failed to toggle operated', e);
      window.alert?.((e as any)?.message || 'Failed to update operated status');
    }
  }

  async function scheduleSelected() {
    if (!selectedItem) return;
    const start = '08:00';
    const end = '09:00';
    const roomId = 'or:1';
    const surgeonId = selectedItem.surgeonId || 's:1';
    await createSchedule({ waitingListItemId: selectedItem.id, roomId, surgeonId, date, startTime: start, endTime: end });
    await refreshSchedule(date);
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
              itemById={itemLookup}
              onToggleConfirm={handleToggleConfirm}
              onToggleOperated={handleToggleOperated}
              onDrop={async ({ date: d, startTime, endTime, data }) => {
                try {
                  const roomId = 'or:1';
                  const surgeonId = data?.surgeonId || 's:1';
                  const itemId = data?.itemId;
                  if (!itemId) return;
                  await createSchedule({ waitingListItemId: itemId, roomId, surgeonId, date: d, startTime, endTime });
                  await refreshSchedule(d);
                } catch (e) {
                  console.error('Failed to create schedule from drop', e);
                  const msg = (e as any)?.message || 'Failed to create schedule (check availability)';
                  window.alert?.(msg);
                }
              }}
              onRemoveEntry={async (id) => {
                try {
                  await deleteSchedule(id);
                  await refreshSchedule();
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
                    const toConfirm = schedule.filter(e => e.waitingListItemId === i.id && e.status !== 'confirmed' && e.status !== 'operated');
                    if (toConfirm.length === 0) {
                      // Nothing to confirm; refresh to ensure derived state updates
                      await refreshSchedule();
                      return;
                    }
                    for (const entry of toConfirm) {
                      await confirmSchedule(entry.id);
                    }
                    await refreshSchedule();
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
                  itemById={itemLookup}
                  onToggleConfirm={handleToggleConfirm}
                  onToggleOperated={handleToggleOperated}
                  onDrop={async ({ date: d, startTime, endTime, data }) => {
                    try {
                      const roomId = 'or:1';
                      const surgeonId = data?.surgeonId || 's:1';
                      const itemId = data?.itemId;
                      if (!itemId) return;
                      await createSchedule({ waitingListItemId: itemId, roomId, surgeonId, date: d, startTime, endTime });
                      await refreshSchedule(d);
                    } catch (e) {
                      console.error('Failed to create schedule from drop', e);
                      const msg = (e as any)?.message || 'Failed to create schedule (check availability)';
                      window.alert?.(msg);
                    }
                  }}
                  onRemoveEntry={async (id) => {
                    try {
                      await deleteSchedule(id);
                      await refreshSchedule();
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

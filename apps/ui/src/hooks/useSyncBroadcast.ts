/**
 * Broadcast-based sync mechanism for forcing all dashboard instances to refresh.
 * Uses BroadcastChannel API to communicate between tabs/windows.
 */

type SyncListener = () => void;

class SyncBroadcaster {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<SyncListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('dashboard-sync');
        this.channel.onmessage = (event) => {
          if (event.data?.type === 'sync-refresh') {
            console.log('[sync] received broadcast from another tab/window');
            this.notifyListeners();
          }
        };
        console.log('[sync] BroadcastChannel initialized');
      } catch (err) {
        console.warn('[sync] BroadcastChannel not available:', err);
      }
    }
  }

  /**
   * Broadcast a sync signal to all dashboard instances (including this one)
   */
  broadcastSync() {
    console.log('[sync] broadcasting refresh signal...');
    
    // Notify local listeners immediately
    this.notifyListeners();
    
    // Also send to other tabs/windows
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'sync-refresh', timestamp: Date.now() });
        console.log('[sync] broadcast sent to other instances');
      } catch (err) {
        console.warn('[sync] failed to broadcast:', err);
      }
    }
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    console.log(`[sync] notifying ${this.listeners.size} local listeners`);
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.warn('[sync] listener error:', err);
      }
    }
  }

  destroy() {
    if (this.channel) {
      this.channel.close();
    }
  }
}

const broadcaster = new SyncBroadcaster();

export function useSyncBroadcast(onSync: () => void) {
  const unsub = broadcaster.subscribe(onSync);
  return unsub;
}

export function triggerGlobalSync() {
  broadcaster.broadcastSync();
}

// Expose for manual triggering
if (typeof window !== 'undefined') {
  (window as any).triggerDashboardSync = () => {
    console.log('[sync] manual sync triggered');
    triggerGlobalSync();
  };
}

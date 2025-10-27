import { useEffect } from 'react';

/**
 * Broadcast-based sync mechanism for forcing all dashboard instances to refresh.
 * Uses BroadcastChannel API to communicate between tabs/windows.
 */

type SyncListener = () => Promise<void> | void;

class SyncBroadcaster {
  private channel: BroadcastChannel | null = null;
  private listeners: Map<symbol, SyncListener> = new Map();
  private listenerCounter = 0;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('dashboard-sync');
        this.channel.onmessage = (event) => {
          if (event.data?.type === 'sync-refresh') {
            console.log('[sync] 📡 received broadcast from another tab/window, notifying listeners...');
            this.notifyListeners();
          }
        };
        console.log('[sync] ✅ BroadcastChannel initialized');
      } catch (err) {
        console.warn('[sync] ❌ BroadcastChannel not available:', err);
      }
    }
  }

  /**
   * Broadcast a sync signal to all dashboard instances (including this one)
   */
  async broadcastSync() {
    console.log(`[sync] 🔄 broadcasting refresh signal to ${this.listeners.size} listeners...`);
    
    // Notify local listeners immediately
    await this.notifyListeners();
    
    // Also send to other tabs/windows
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'sync-refresh', timestamp: Date.now() });
        console.log('[sync] ✅ broadcast sent to other instances');
      } catch (err) {
        console.warn('[sync] ❌ failed to broadcast:', err);
      }
    }
  }

  subscribe(listener: SyncListener): () => void {
    const id = Symbol(`listener-${++this.listenerCounter}`);
    this.listeners.set(id, listener);
    console.log(`[sync] ✅ listener registered (total: ${this.listeners.size})`);
    
    return () => {
      this.listeners.delete(id);
      console.log(`[sync] ✅ listener unregistered (total: ${this.listeners.size})`);
    };
  }

  private async notifyListeners() {
    console.log(`[sync] 📢 notifying ${this.listeners.size} listeners...`);
    const listenersArray = Array.from(this.listeners.values());
    
    for (const listener of listenersArray) {
      try {
        await listener();
        console.log('[sync] ✅ listener executed successfully');
      } catch (err) {
        console.error('[sync] ❌ listener error:', err);
      }
    }
  }

  destroy() {
    if (this.channel) {
      this.channel.close();
      console.log('[sync] 🔌 BroadcastChannel closed');
    }
  }

  getStatus() {
    return {
      channelReady: this.channel !== null,
      listeners: this.listeners.size,
    };
  }
}

const broadcaster = new SyncBroadcaster();

export function useSyncBroadcast(onSync: () => Promise<void> | void) {
  // Create a stable reference that will be used as the listener
  const listener = onSync;
  
  useEffect(() => {
    console.log('[sync] 🎯 useSyncBroadcast hook mounted');
    const unsubscribe = broadcaster.subscribe(listener);
    
    return () => {
      console.log('[sync] 🎯 useSyncBroadcast hook unmounted');
      unsubscribe();
    };
  }, [listener]);
}

export async function triggerGlobalSync() {
  console.log('[sync] 🚀 triggerGlobalSync called from UI');
  await broadcaster.broadcastSync();
}

// Expose for manual triggering from console
if (typeof window !== 'undefined') {
  (window as any).triggerDashboardSync = async () => {
    console.log('[sync] 🎮 manual sync triggered from console');
    await triggerGlobalSync();
  };
  (window as any).getSyncStatus = () => {
    return broadcaster.getStatus();
  };
}

import { useEffect, useCallback } from 'react';
import { supabase } from '../supabase/client';

/**
 * Global realtime subscription manager for backlog and schedule tables.
 * When any change occurs, all subscribers are notified to reload data.
 */

type Listener = () => void;

class RealtimeManager {
  private listeners: Set<Listener> = new Set();
  private subscription: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isConnected = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    console.log(`[realtime] listener added (total: ${this.listeners.size})`);
    this.ensureSubscribed();
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
      console.log(`[realtime] listener removed (total: ${this.listeners.size})`);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  private ensureSubscribed() {
    if (this.subscription || !supabase) return;

    console.log('[realtime] establishing subscription...');
    try {
      this.subscription = supabase
        .channel('global-data-sync')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'backlog',
          },
          (payload: any) => {
            console.log('[realtime] backlog change detected:', payload.eventType);
            this.notifyListeners();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'schedule',
          },
          (payload: any) => {
            console.log('[realtime] schedule change detected:', payload.eventType);
            this.notifyListeners();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'workspace_sync_signals',
          },
          (payload: any) => {
            console.log('[realtime] 🔄 workspace sync signal received:', payload.new);
            this.notifyListeners();
          }
        )
        .subscribe((status: string) => {
          console.log('[realtime] subscription status:', status);
          if (status === 'SUBSCRIBED') {
            this.reconnectAttempts = 0;
            this.isConnected = true;
          } else if (status === 'CHANNEL_ERROR') {
            this.isConnected = false;
            this.attemptReconnect();
          }
        });
    } catch (err) {
      console.warn('[realtime] subscription failed:', err);
      this.isConnected = false;
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[realtime] max reconnect attempts reached');
      return;
    }
    this.reconnectAttempts++;
    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`[realtime] reconnecting in ${backoffMs}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    setTimeout(() => {
      this.disconnect();
      this.ensureSubscribed();
    }, backoffMs);
  }

  private notifyListeners() {
    console.log(`[realtime] notifying ${this.listeners.size} listeners...`);
    const listenersArray = Array.from(this.listeners);
    for (const listener of listenersArray) {
      try {
        listener();
      } catch (err) {
        console.warn('[realtime] listener error:', err);
      }
    }
  }

  private disconnect() {
    if (this.subscription && supabase) {
      try {
        supabase.removeChannel(this.subscription);
        console.log('[realtime] subscription disconnected');
      } catch {}
    }
    this.subscription = null;
    this.isConnected = false;
  }

  getStatus() {
    return {
      connected: this.isConnected,
      listeners: this.listeners.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

const manager = new RealtimeManager();

/**
 * Hook to enable realtime syncing of backlog/schedule data.
 * When data changes on server (any user), the provided callback is invoked.
 */
export function useRealtimeBacklog(onDataChange: () => void) {
  const memoizedCallback = useCallback(onDataChange, [onDataChange]);
  
  useEffect(() => {
    const unsubscribe = manager.subscribe(memoizedCallback);
    return unsubscribe;
  }, [memoizedCallback]);
}

// Expose debug info
if (typeof window !== 'undefined') {
  (window as any).realtimeDebug = () => manager.getStatus();
}

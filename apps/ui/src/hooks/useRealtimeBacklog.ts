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
  private maxReconnectAttempts = 5;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.ensureSubscribed();
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  private ensureSubscribed() {
    if (this.subscription) return;
    if (!supabase) return;

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
          () => this.notifyListeners()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'schedule',
          },
          () => this.notifyListeners()
        )
        .subscribe((status: string) => {
          console.log('[realtime] subscription status:', status);
          if (status === 'SUBSCRIBED') {
            this.reconnectAttempts = 0;
          } else if (status === 'CHANNEL_ERROR') {
            this.attemptReconnect();
          }
        });
    } catch (err) {
      console.warn('[realtime] subscription failed:', err);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[realtime] max reconnect attempts reached');
      return;
    }
    this.reconnectAttempts++;
    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[realtime] reconnecting in ${backoffMs}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => {
      this.disconnect();
      this.ensureSubscribed();
    }, backoffMs);
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
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
      } catch {}
    }
    this.subscription = null;
  }
}

const manager = new RealtimeManager();

/**
 * Hook to enable realtime syncing of backlog/schedule data.
 * When data changes on server (any user), the provided callback is invoked.
 */
export function useRealtimeBacklog(onDataChange: () => void) {
  useEffect(() => {
    const unsubscribe = manager.subscribe(onDataChange);
    return unsubscribe;
  }, [onDataChange]);
}

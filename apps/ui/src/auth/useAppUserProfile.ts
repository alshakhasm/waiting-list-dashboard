import { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { ensureBootstrapOwner, getCurrentAppUser, AppUser, becomeOwner } from '../client/api';

export type AppUserState = {
  loading: boolean;
  profile: AppUser | null;
  error: string | null;
};

export function useAppUserProfile(): AppUserState {
  const [state, setState] = useState<AppUserState>({ loading: !!supabase, profile: null, error: null });

  useEffect(() => {
    let cancelled = false;
    let running = false;
    let channel: any = null;
    // Simple promise timeout wrapper so any single call can't block the whole flow
    function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
      return Promise.race([
        p,
        new Promise<T>((_r, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms))
      ]) as Promise<T>;
    }
    // Timeout fallback to avoid indefinite loading in case of network hiccups
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setState((s) => s.loading ? { loading: false, profile: null, error: 'Timed out while contacting the database. Please refresh or try Sign in again.' } : s);
      }
    }, 20000);
    async function run() {
      if (running) { return; }
      running = true;
      try {
        console.log('[profile] start');
        if (!supabase) {
          setState({ loading: false, profile: { userId: 'guest', email: 'guest@example.com', role: 'owner', status: 'approved' }, error: null });
          return;
        }
        console.log('[profile] getSession…');
        let data: any;
        try {
          ({ data } = await withTimeout(supabase.auth.getSession(), 5000, 'getSession'));
        } catch (e: any) {
          console.warn('[profile] getSession failed/timed out -> treating as signed-out', e);
          setState((s) => ({ ...s, loading: false }));
          return;
        }
        const uid = data.session?.user?.id;
        console.log('[profile] uid:', uid);
        if (!uid) {
          setState((s) => ({ ...s, loading: false }));
          return;
        }
        // If this user just confirmed signup, finalize owner setup from pending profile
        try {
          const email = data.session?.user?.email?.toLowerCase() || '';
          if (email) {
            const key = `owner-profile:pending:${email}`;
            const raw = localStorage.getItem(key);
            if (raw) {
              console.log('[profile] finalize owner: found pending profile in localStorage');
              const profile = JSON.parse(raw);
              // Bound each step to avoid stalling the whole load
              console.log('[profile] becomeOwner RPC…');
              await withTimeout(becomeOwner(), 15000, 'becomeOwner');
              const payload: any = {
                user_id: uid,
                full_name: profile.fullName,
                workspace_name: profile.workspaceName,
                org_name: profile.orgName || null,
                phone: profile.phone || null,
                timezone: profile.timezone || null,
                locale: profile.locale || null,
              };
              console.log('[profile] upsert owner_profiles…');
              const upsertRes: any = await withTimeout((supabase as any).from('owner_profiles').upsert(payload), 15000, 'owner_profiles.upsert');
              const { error } = upsertRes as { error: any };
              if (!error) {
                try { localStorage.removeItem(key); } catch {}
                // Defensive: ensure supabase-js loads the current session after becoming owner
                try {
                  const sess = await (supabase as any).auth.getSession();
                  console.log('[profile] session refreshed after becomeOwner:', !!sess?.data?.session);
                } catch (e) {
                  console.warn('[profile] failed to refresh session after becomeOwner', e);
                }
              }
            }
          }
        } catch (e) {
          // Non-fatal: continue to bootstrap and profile fetch
          console.warn('[profile] finalize owner step failed or timed out', e);
        }
        console.log('[profile] bootstrap_owner RPC…');
        await withTimeout(ensureBootstrapOwner(), 15000, 'bootstrap_owner');
        console.log('[profile] getCurrentAppUser…');
        const profile = await withTimeout(getCurrentAppUser(), 15000, 'getCurrentAppUser');
        if (cancelled) return;
        console.log('[profile] loaded:', profile);
        setState({ loading: false, profile, error: null });

        // Subscribe to realtime changes for this user's app_users row to auto-refresh role/status
        try {
          channel?.unsubscribe?.();
          channel = supabase?.channel?.(`app-users:${uid}`);
          if (channel) {
            channel.on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'app_users', filter: `user_id=eq.${uid}` },
              async () => {
                if (cancelled) return;
                try {
                  const fresh = await getCurrentAppUser();
                  if (!cancelled) setState((s) => ({ ...s, profile: fresh }));
                } catch (e) {
                  // ignore transient errors
                }
              }
            ).subscribe();
          }
        } catch (e) {
          console.warn('[profile] realtime subscribe failed', e);
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error('[profile] error:', err);
        setState({ loading: false, profile: null, error: err?.message || String(err) });
      }
      finally {
        running = false;
      }
    }
    run();
    const { data: sub } = supabase?.auth.onAuthStateChange((_e) => run()) || { data: undefined } as any;
    function onFocus() {
      // Opportunistic refresh when tab is focused again
      run();
    }
    if (typeof window !== 'undefined') window.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      sub?.subscription?.unsubscribe();
      try { channel?.unsubscribe?.(); } catch {}
      if (typeof window !== 'undefined') window.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  return state;
}

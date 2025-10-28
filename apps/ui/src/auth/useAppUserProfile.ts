import { useEffect, useReducer, useRef } from 'react';
import { supabase } from '../supabase/client';
import { ensureBootstrapOwner, getCurrentAppUser, AppUser, becomeOwner } from '../client/api';

export type AppUserState = {
  loading: boolean;
  profile: AppUser | null;
  error: string | null;
};

type Action = 
  | { type: 'START_LOADING' }
  | { type: 'SUCCESS'; profile: AppUser | null }
  | { type: 'ERROR'; error: string }
  | { type: 'RETRY' };

function appUserReducer(state: AppUserState, action: Action): AppUserState {
  switch (action.type) {
    case 'START_LOADING':
      return { loading: true, profile: null, error: null };
    case 'SUCCESS':
      return { loading: false, profile: action.profile, error: null };
    case 'ERROR':
      return { loading: false, profile: null, error: action.error };
    case 'RETRY':
      return { loading: true, profile: null, error: null };
    default:
      return state;
  }
}

export function useAppUserProfile(): AppUserState {
  const [state, dispatch] = useReducer(appUserReducer, { loading: !!supabase, profile: null, error: null });
  const retryCountRef = useRef(0);
  const runningRef = useRef(false);
  const cancelledRef = useRef(false);
  const channelRef = useRef<any>(null);
  const timeoutRef = useRef<number>(0);
  
  const MAX_RETRIES = 2;
  const TIMEOUT_MS = 10000; // 10 seconds per attempt
  
  // Simple promise timeout wrapper
  const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> => {
    return Promise.race([
      p,
      new Promise<T>((_r, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms))
    ]) as Promise<T>;
  };
  
  useEffect(() => {
    const performLoad = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      
      try {
        const attempt = retryCountRef.current + 1;
        console.log('[profile] start (attempt', attempt, '/', MAX_RETRIES + 1, ')');
        
        if (!supabase) {
          dispatch({ 
            type: 'SUCCESS', 
            profile: { userId: 'guest', email: 'guest@example.com', role: 'owner', status: 'approved' } 
          });
          return;
        }
        
        // Get session
        console.log('[profile] getSession…');
        let data: any;
        try {
          ({ data } = await withTimeout(supabase.auth.getSession(), 5000, 'getSession'));
        } catch (err) {
          console.warn('[profile] getSession failed/timed out -> treating as signed-out', err);
          dispatch({ type: 'ERROR', error: 'Failed to get session' });
          return;
        }
        
        const uid = data.session?.user?.id;
        console.log('[profile] uid:', uid);
        
        if (!uid) {
          dispatch({ type: 'ERROR', error: 'Not signed in' });
          return;
        }
        
        // Finalize owner setup if pending
        try {
          const email = data.session?.user?.email?.toLowerCase() || '';
          if (email) {
            const key = `owner-profile:pending:${email}`;
            const raw = localStorage.getItem(key);
            if (raw) {
              console.log('[profile] finalize owner: found pending profile in localStorage');
              const profile = JSON.parse(raw);
              
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
                try {
                  const sess = await (supabase as any).auth.getSession();
                  console.log('[profile] session refreshed after becomeOwner:', !!sess?.data?.session);
                } catch (err) {
                  console.warn('[profile] failed to refresh session after becomeOwner', err);
                }
              }
            }
          }
        } catch (e) {
          console.warn('[profile] finalize owner step failed or timed out', e);
        }
        
        // Bootstrap owner
        console.log('[profile] bootstrap_owner RPC…');
        await withTimeout(ensureBootstrapOwner(), 15000, 'bootstrap_owner');
        
        // Get current user profile
        console.log('[profile] getCurrentAppUser…');
        const profile = await withTimeout(getCurrentAppUser(), 15000, 'getCurrentAppUser');
        
        if (cancelledRef.current) return;
        
        console.log('[profile] loaded:', profile);
        dispatch({ type: 'SUCCESS', profile });
        retryCountRef.current = 0; // Reset on success
        
        // Subscribe to realtime changes
        try {
          channelRef.current?.unsubscribe?.();
          channelRef.current = supabase?.channel?.(`app-users:${uid}`);
          if (channelRef.current) {
            channelRef.current.on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'app_users', filter: `user_id=eq.${uid}` },
              async () => {
                if (cancelledRef.current) return;
                try {
                  const fresh = await getCurrentAppUser();
                  if (!cancelledRef.current) dispatch({ type: 'SUCCESS', profile: fresh });
                } catch {
                  // ignore transient errors
                }
              }
            ).subscribe();
          }
        } catch (err) {
          console.warn('[profile] realtime subscribe failed', err);
        }
      } catch (err: any) {
        if (cancelledRef.current) return;
        
        const isTimeout = err?.message?.includes('timed out');
        const shouldRetry = isTimeout && retryCountRef.current < MAX_RETRIES;
        
        if (shouldRetry) {
          console.log('[profile] timeout detected, retrying…');
          retryCountRef.current++;
          runningRef.current = false;
          // Dispatch retry to update UI if needed
          dispatch({ type: 'RETRY' });
          // Retry with slight delay
          setTimeout(performLoad, 500);
          return;
        }
        
        console.error('[profile] error:', err);
        const errorMsg = err?.message || String(err) || 'Failed to load profile';
        dispatch({ type: 'ERROR', error: errorMsg });
      } finally {
        runningRef.current = false;
      }
    };
    
    performLoad();
    
    // Set up auth state change listener
    const { data: sub } = supabase?.auth.onAuthStateChange((_e) => {
      retryCountRef.current = 0; // Reset retries on auth state change
      performLoad();
    }) || { data: undefined } as any;
    
    // Handle visibility and focus changes for opportunistic refresh
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[profile] page visible, opportunistic refresh');
        performLoad();
      }
    };
    
    const handleFocus = () => {
      console.log('[profile] window focus, opportunistic refresh');
      performLoad();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
    }
    
    return () => {
      cancelledRef.current = true;
      clearTimeout(timeoutRef.current);
      sub?.subscription?.unsubscribe();
      try { channelRef.current?.unsubscribe?.(); } catch {}
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, []);

  return state;
}

import { useCallback } from 'react';
import { supabase } from '../supabase/client';
import { useSupabaseAuth } from './useSupabaseAuth';
import { IconLogIn } from '../ui/icons';

export function AuthBox() {
  const { user } = useSupabaseAuth();

  const goToAuthLanding = useCallback(() => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('auth', '1');
      u.searchParams.set('signin', '1');
      window.location.href = u.toString();
    } catch {}
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    try { await (supabase.auth as any).signOut({ scope: 'local' }); } catch {}
    try { await (supabase.auth as any).signOut(); } catch {}
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {user ? (
        <button onClick={signOut} style={{ padding: '6px 14px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8 }}>Sign out</button>
      ) : (
        <button onClick={goToAuthLanding} style={{ padding: '6px 14px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconLogIn size={14} aria-hidden="true" /> Sign in
        </button>
      )}
    </div>
  );
}

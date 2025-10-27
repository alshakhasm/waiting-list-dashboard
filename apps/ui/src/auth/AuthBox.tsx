import { useCallback } from 'react';
import { supabase } from '../supabase/client';
import { useSupabaseAuth } from './useSupabaseAuth';
import { IconLogIn, IconLogOut } from '../ui/icons';

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
    try {
      // Clear all auth-related localStorage/sessionStorage to ensure clean session
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('supabase') || key.includes('auth') || key.includes('sb-'))) {
            keys.push(key);
          }
        }
        keys.forEach(k => localStorage.removeItem(k));
      } catch {}
      
      // Sign out from Supabase
      try { await (supabase.auth as any).signOut({ scope: 'local' }); } catch {}
      try { await (supabase.auth as any).signOut(); } catch {}
      
      // Force refresh to clear any cached state
      setTimeout(() => window.location.href = window.location.pathname, 100);
    } catch (err) {
      console.error('[AuthBox] Sign out error:', err);
    }
  }, []);

  const baseStyle: React.CSSProperties = {
    width: 38,
    height: 34,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    cursor: 'pointer',
  };

  return user ? (
    <button
      onClick={signOut}
      title="Sign out"
      aria-label="Sign out"
      style={baseStyle}
    >
      <IconLogOut size={16} />
    </button>
  ) : (
    <button
      onClick={goToAuthLanding}
      title="Sign in"
      aria-label="Sign in"
      style={baseStyle}
    >
      <IconLogIn size={16} />
    </button>
  );
}

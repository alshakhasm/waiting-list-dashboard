import { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';

export type AuthInfo = {
  user: any | null;
  role: 'staff' | 'senior' | null;
};

export function useSupabaseAuth(): AuthInfo {
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<'staff' | 'senior' | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      const r = (data.session?.user?.app_metadata as any)?.role ?? null;
      setRole(r === 'staff' || r === 'senior' ? r : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      const r = (session?.user?.app_metadata as any)?.role ?? null;
      setRole(r === 'staff' || r === 'senior' ? r : null);
    });
    return () => { mounted = false; sub?.subscription?.unsubscribe(); };
  }, []);

  return { user, role };
}

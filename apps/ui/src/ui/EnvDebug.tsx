/// <reference types="vite/client" />
import React from 'react';
import { supabase } from '../supabase/client';

export function EnvDebug() {
  const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const rawAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  let urlHost: string | null = null;
  try { urlHost = rawUrl ? new URL(rawUrl).host : null; } catch { urlHost = null; }
  const hasUrl = !!rawUrl;
  const hasAnon = !!rawAnon && !/^\s*$/.test(rawAnon || '');
  const enabled = !!supabase;

  const bg = enabled ? '#065f46' : '#9a3412';
  const fg = 'white';
  const msg = enabled
    ? `Supabase: enabled (${urlHost || 'no-host'})`
    : `Supabase: disabled (${!hasUrl ? 'no URL' : !hasAnon ? 'no anon key' : 'unknown'})`;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 8px', borderRadius: 999,
      background: bg, color: fg, fontSize: 12
    }} title={`hasUrl=${hasUrl} hasAnon=${hasAnon} host=${urlHost || 'n/a'}`}>
      {msg}
    </span>
  );
}

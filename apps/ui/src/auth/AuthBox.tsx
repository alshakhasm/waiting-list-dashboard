import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabase/client';
import { useSupabaseAuth } from './useSupabaseAuth';
import { IconLogIn, IconMail, IconKey, IconUser, IconUserPlus, IconShield } from '../ui/icons';
import { enableGuest } from './guest';
import { hasAnyAppUsers } from '../client/api';

export function AuthBox() {
  const { user, role } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [allowOwnerCreate, setAllowOwnerCreate] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const MENU_KEYS = ['magic', 'options', 'reset', 'join', 'owner', 'guest'] as const;
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  // Compute a canonical redirect base for Supabase magic link / reset flows.
  // - Local dev: http://localhost:5173
  // - GitHub Pages: https://<user>.github.io/waiting-list-dashboard
  function getRedirectBase() {
    try {
      const origin = window.location.origin;
      const path = window.location.pathname || '/';
      const ghBase = '/waiting-list-dashboard';
      const base = path.startsWith(ghBase) ? ghBase : '';
      return origin + base;
    } catch {
      return window.location.origin;
    }
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node | null;
      const withinAnchor = !!(anchorRef.current && t && anchorRef.current.contains(t));
      const withinMenu = !!(menuRef.current && t && menuRef.current.contains(t));
      if (!withinAnchor && !withinMenu) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    const el = menuRef.current?.querySelector('[role="menuitem"]') as HTMLElement | null;
    el?.focus();
  }, [open]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) { setAllowOwnerCreate(false); return; }
      try {
        const any = await hasAnyAppUsers();
        if (!mounted) return;
        setAllowOwnerCreate(!any);
      } catch {
        if (!mounted) return;
        setAllowOwnerCreate(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Persist/restore email for convenience
  useEffect(() => {
    try { const last = localStorage.getItem('auth:last-email'); if (last) setEmail(last); } catch {}
  }, []);
  useEffect(() => {
    try { if (email) localStorage.setItem('auth:last-email', email); } catch {}
  }, [email]);

  // Open menu via URL trigger from landing page (authmenu=1)
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get('authmenu') === '1') {
        setOpen(true);
        // optional: clean the flag to prevent reopening on next render
        u.searchParams.delete('authmenu');
        window.history.replaceState({}, '', u.toString());
      }
    } catch {}
  }, []);

  // Position menu on open and keep in sync with viewport changes
  useLayoutEffect(() => {
    function position() {
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      setMenuPos({ top: Math.round(r.bottom + 6), right: Math.round(window.innerWidth - r.right) });
    }
    if (open) {
      position();
      const onScroll = () => position();
      const onResize = () => position();
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onResize);
      return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize); };
    }
  }, [open]);

  function goToAuthLanding() {
    try {
      const u = new URL(window.location.href);
      // prioritize invite if present; otherwise flag auth landing
      if (!u.searchParams.get('accept')) u.searchParams.set('auth', '1');
      window.location.href = u.toString();
    } catch {
      // no-op
    }
  }

  async function signIn() {
    setStatus(null);
    if (!supabase) {
      goToAuthLanding();
      return;
    }
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: getRedirectBase() } });
    if (error) setStatus(error.message);
    else setStatus('Check your email for the sign-in link.');
  }

  async function resetPassword() {
    setStatus(null);
    if (!supabase) { goToAuthLanding(); return; }
    if (!email) { setStatus('Enter your email first.'); return; }
    try {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: getRedirectBase() });
      if (error) throw error;
      setStatus('Password reset email sent.');
    } catch (e: any) {
      setStatus(e?.message || String(e));
    }
  }

  function persistMethod(method: 'magic' | 'options' | 'reset' | 'join' | 'owner' | 'guest') {
    try { localStorage.setItem('auth:last-method', method); } catch {}
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!open) return;
    const idx = activeIndex;
    const items = MENU_KEYS.filter(k => k !== 'owner' || allowOwnerCreate);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((idx + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((idx - 1 + items.length) % items.length);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter') {
      const key = items[idx];
      if (key === 'magic') { persistMethod('magic'); signIn(); }
      if (key === 'options') { persistMethod('options'); goToAuthLanding(); }
      if (key === 'reset') { persistMethod('reset'); resetPassword(); }
      if (key === 'join') { persistMethod('join'); goToAuthLanding(); }
  if (key === 'owner') { persistMethod('owner'); try { const u = new URL(window.location.href); u.searchParams.set('auth','1'); u.searchParams.set('signin','1'); u.searchParams.set('signup','1'); u.searchParams.set('bootstrap','1'); window.location.href = u.toString(); } catch {} }
      if (key === 'guest') { persistMethod('guest'); enableGuest(); setOpen(false); }
    }
  }

  async function signOut() {
    if (!supabase) return;
    try { await (supabase.auth as any).signOut({ scope: 'local' }); } catch {}
    try { await (supabase.auth as any).signOut(); } catch {}
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
      {user ? (
        <>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Signed in{role ? ` (${role})` : ''}</span>
          <button onClick={signOut}>Sign out</button>
        </>
      ) : (
        <>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button ref={anchorRef} onClick={() => setOpen(v => !v)} className="icon-button" aria-expanded={open} aria-haspopup="menu" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconLogIn size={14} aria-hidden="true" style={{ marginRight: -1, position: 'relative', top: 1 }} /> Sign in ▾
          </button>
          {open && createPortal(
            <div
              role="menu"
              ref={menuRef}
              onKeyDown={onKeyDown}
              tabIndex={0}
              aria-activedescendant={(function(){
                const list = MENU_KEYS.filter(k => k !== 'owner' || allowOwnerCreate);
                const key = list[activeIndex] || list[0];
                return `auth-item-${key}`;
              })()}
              style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 20px var(--shadow)', minWidth: 260, zIndex: 1000, overflow: 'hidden' }}
            >
              <button id="auth-item-magic" role="menuitem" aria-selected={activeIndex===0} tabIndex={-1} onMouseEnter={() => setActiveIndex(0)} onClick={() => { persistMethod('magic'); signIn(); }} disabled={!email} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', cursor: email ? 'pointer' : 'not-allowed', opacity: email ? 1 : 0.6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconMail size={14} aria-hidden="true" /> Send magic link to {email || '…'}
              </button>
              <button id="auth-item-options" role="menuitem" aria-selected={activeIndex===1} tabIndex={-1} onMouseEnter={() => setActiveIndex(1)} onClick={() => { persistMethod('options'); goToAuthLanding(); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconKey size={14} aria-hidden="true" /> Open sign-in options…
              </button>
              <button id="auth-item-reset" role="menuitem" aria-selected={activeIndex===2} tabIndex={-1} onMouseEnter={() => setActiveIndex(2)} onClick={() => { persistMethod('reset'); resetPassword(); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', cursor: (!supabase || !email) ? 'not-allowed' : 'pointer', opacity: (!supabase || !email) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 8 }} disabled={!supabase || !email}>
                <IconKey size={14} aria-hidden="true" /> Forgot password…
              </button>
              <hr style={{ margin: '6px 0', border: 0, borderTop: '1px solid var(--border)' }} />
              <button id="auth-item-join" role="menuitem" aria-selected={activeIndex===3} tabIndex={-1} onMouseEnter={() => setActiveIndex(3)} onClick={() => { persistMethod('join'); goToAuthLanding(); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconUserPlus size={14} aria-hidden="true" /> Join team…
              </button>
              {allowOwnerCreate && (
                <button id="auth-item-owner" role="menuitem" aria-selected={activeIndex===4} tabIndex={-1} onMouseEnter={() => setActiveIndex(4)} onClick={() => { persistMethod('owner'); try { const u = new URL(window.location.href); u.searchParams.set('auth','1'); u.searchParams.set('signin','1'); u.searchParams.set('signup','1'); u.searchParams.set('bootstrap','1'); window.location.href = u.toString(); } catch {} }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconShield size={14} aria-hidden="true" /> Create owner account…
                </button>
              )}
              <button id="auth-item-guest" role="menuitem" aria-selected={activeIndex=== (allowOwnerCreate ? 5 : 4)} tabIndex={-1} onMouseEnter={() => setActiveIndex(allowOwnerCreate ? 5 : 4)} onClick={() => { persistMethod('guest'); enableGuest(); setOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconUser size={14} aria-hidden="true" /> Continue as guest
              </button>
            </div>,
            document.body
          )}
          {status && <small style={{ opacity: 0.8 }}>{status}</small>}
        </>
      )}
    </div>
  );
}

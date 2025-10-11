import { IconSun, IconMoon, IconAuto, IconWarm, IconContrast } from './icons';
import React from 'react';

export type ThemeChoice = 'auto' | 'default' | 'warm' | 'high-contrast' | 'dark';

const themeOptions: { value: ThemeChoice; label: string; Icon: (p: { size?: number }) => JSX.Element }[] = [
  { value: 'auto', label: 'Auto', Icon: (p) => <IconAuto {...p} /> },
  { value: 'default', label: 'Light', Icon: (p) => <IconSun {...p} /> },
  { value: 'dark', label: 'Dark', Icon: (p) => <IconMoon {...p} /> },
  { value: 'warm', label: 'Warm', Icon: (p) => <IconWarm {...p} /> },
  { value: 'high-contrast', label: 'High Contrast', Icon: (p) => <IconContrast {...p} /> },
];

export function ThemeToggle({ theme, onChange, compact = false }: { theme: ThemeChoice; onChange: (_t: ThemeChoice) => void; compact?: boolean }) {
  if (compact) {
    // Inline icon row variant (no text labels)
    return (
      <div style={{ display: 'inline-flex', gap: 6 }} aria-label="Theme selection" role="radiogroup">
        {themeOptions.map(opt => {
          const IconComp = opt.Icon;
          const selected = opt.value === theme;
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={selected}
              aria-label={opt.label}
              title={opt.label}
              onClick={() => onChange(opt.value)}
              style={{
                width: 30,
                height: 30,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: selected ? 'var(--surface-3)' : 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                cursor: 'pointer',
                color: 'var(--text)',
                outline: selected ? '2px solid var(--primary)' : 'none'
              }}
            >
              <IconComp size={16} />
            </button>
          );
        })}
      </div>
    );
  }
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const current = themeOptions.find(o => o.value === theme) || themeOptions[0];

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggleOpen() {
    setOpen(o => !o);
  }

  function openAndFocusFirst() {
    setOpen(true);
    requestAnimationFrame(() => {
      itemRefs.current[0]?.focus();
    });
  }

  function onTriggerKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openAndFocusFirst();
    }
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const idx = itemRefs.current.findIndex(r => r === document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1) % themeOptions.length;
      itemRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (idx - 1 + themeOptions.length) % themeOptions.length;
      itemRefs.current[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      itemRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      itemRefs.current[themeOptions.length - 1]?.focus();
    }
  }

  const TriggerIcon = current.Icon;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}. ${open ? 'Close menu' : 'Open menu'}`}
        onClick={toggleOpen}
        onKeyDown={onTriggerKey}
        style={{
          width: 38,
          height: 38,
            display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          cursor: 'pointer',
          color: 'var(--text)',
        }}
        title="Change theme"
      >
        <TriggerIcon size={20} />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Select theme"
          onKeyDown={onMenuKey}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 170,
            zIndex: 50,
            boxShadow: '0 4px 16px -4px rgba(0,0,0,0.4)'
          }}
        >
          {themeOptions.map((opt, i) => {
            const SelectedIcon = opt.Icon;
            const selected = opt.value === theme;
            return (
              <button
                key={opt.value}
                ref={el => (itemRefs.current[i] = el)}
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  background: selected ? 'var(--surface-3)' : 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: 13,
                  textAlign: 'left'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChange(opt.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }
                }}
              >
                <SelectedIcon size={16} />
                <span style={{ flex: 1 }}>{opt.label}</span>
                {selected && <span style={{ fontSize: 10, opacity: 0.7 }}>●</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

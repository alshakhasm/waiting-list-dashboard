import { ReactNode } from 'react';

export const TAB_BUTTON_STYLE = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontWeight: 500,
  color: 'var(--text)',
  cursor: 'pointer',
  background: 'transparent',
  transition: 'all 0.2s ease',
} as const;

export const TAB_BUTTON_ACTIVE_STYLE = {
  ...TAB_BUTTON_STYLE,
  background: 'var(--surface-2)',
  fontWeight: 600,
} as const;

interface TabButtonProps {
  label: ReactNode;
  isActive: boolean;
  onClick: () => void;
  title?: string;
  shortcut?: string; // e.g., "Shift+S"
}

export function TabButton({ label, isActive, onClick, title, shortcut }: TabButtonProps) {
  const fullTitle = shortcut ? `${title || label} (${shortcut})` : title;
  
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      title={fullTitle}
      style={isActive ? TAB_BUTTON_ACTIVE_STYLE : TAB_BUTTON_STYLE}
    >
      {label}
    </button>
  );
}

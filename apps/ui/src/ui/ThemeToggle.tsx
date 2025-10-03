export function ThemeToggle({ theme, onToggle }: { theme: 'default' | 'high-contrast'; onToggle: () => void }) {
  return <button onClick={onToggle}>Theme: {theme}</button>;
}

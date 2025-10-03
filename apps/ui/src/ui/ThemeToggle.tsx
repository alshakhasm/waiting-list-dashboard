export function ThemeToggle({ theme, onChange }: { theme: 'auto' | 'default' | 'warm' | 'high-contrast' | 'dark'; onChange: (t: 'auto' | 'default' | 'warm' | 'high-contrast' | 'dark') => void }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.7 }}>Theme</span>
      <select value={theme} onChange={(e) => onChange(e.target.value as any)}>
        <option value="auto">Auto</option>
        <option value="default">Default</option>
        <option value="dark">Dark</option>
        <option value="warm">Warm</option>
        <option value="high-contrast">High Contrast</option>
      </select>
    </label>
  );
}

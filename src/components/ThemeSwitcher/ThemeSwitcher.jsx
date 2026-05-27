import { useEffect, useState } from 'react';
import { THEMES, applyTheme, getStoredTheme } from '../../themes/themes';
import './ThemeSwitcher.css';

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleChange = (e) => {
    const next = applyTheme(e.target.value);
    setTheme(next);
  };

  const groupedThemes = THEMES.reduce((groups, theme) => {
    const category = theme.category || 'Other';
    if (!groups[category]) groups[category] = [];
    groups[category].push(theme);
    return groups;
  }, {});

  const categoryOrder = ['Dark', 'Light', 'Other'];

  return (
    <div className="theme-switcher">
      <label htmlFor="theme-select" className="theme-switcher-label">
        Theme
      </label>
      <select
        id="theme-select"
        className="theme-select"
        value={theme}
        onChange={handleChange}
        aria-label="Color theme"
      >
        {categoryOrder.map((category) => (
          groupedThemes[category] ? (
            <optgroup key={category} label={category}>
              {groupedThemes[category].map((t) => (
                <option key={t.id} value={t.id}>
                  {t.emoji} {t.label}
                </option>
              ))}
            </optgroup>
          ) : null
        ))}
      </select>
    </div>
  );
}

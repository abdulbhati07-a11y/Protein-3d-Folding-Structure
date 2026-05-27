export const THEMES = [
  { id: 'midnight', label: 'Midnight', emoji: '🌙', category: 'Dark' },
  { id: 'ocean', label: 'Ocean', emoji: '🌊', category: 'Dark' },
  { id: 'forest', label: 'Forest', emoji: '🌲', category: 'Dark' },
  { id: 'sunset', label: 'Sunset', emoji: '🌅', category: 'Dark' },
  { id: 'lavender', label: 'Lavender', emoji: '💜', category: 'Dark' },
  { id: 'rose', label: 'Rose', emoji: '🌸', category: 'Dark' },
  { id: 'amber', label: 'Amber', emoji: '✨', category: 'Dark' },
  { id: 'arctic', label: 'Arctic', emoji: '❄️', category: 'Light' },
  { id: 'dawn', label: 'Dawn', emoji: '🌤️', category: 'Light' },
  { id: 'sage', label: 'Sage', emoji: '🌿', category: 'Light' },
  { id: 'coral', label: 'Coral', emoji: '🧡', category: 'Light' },
  { id: 'cloud', label: 'Cloud', emoji: '☁️', category: 'Light' },
];

const STORAGE_KEY = 'protein-explorer-theme';

export function getStoredTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return THEMES.some((t) => t.id === stored) ? stored : 'midnight';
}

export function applyTheme(themeId) {
  const valid = THEMES.some((t) => t.id === themeId) ? themeId : 'midnight';
  document.documentElement.setAttribute('data-theme', valid);
  localStorage.setItem(STORAGE_KEY, valid);
  return valid;
}

export function initTheme() {
  return applyTheme(getStoredTheme());
}

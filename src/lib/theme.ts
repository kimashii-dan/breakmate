export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'bm-theme';

export function getStoredTheme(): Theme {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function applyTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// Call once before React renders to avoid flash of wrong theme.
export function initTheme(): void {
  applyTheme(getStoredTheme());
}

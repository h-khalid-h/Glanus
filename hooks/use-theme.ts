/**
 * useTheme Hook
 *
 * Convenience hook that provides theme state and actions.
 * Wraps the Zustand store with a clean public API.
 */

import { useThemeStore } from '@/stores/themeStore';
import type { ThemeMode, BrandingConfig } from '@/theme/config';

export interface UseThemeReturn {
  /** User-selected mode: 'light' | 'dark' | 'system' */
  mode: ThemeMode;
  /** Resolved effective mode after system preference resolution */
  resolvedMode: 'light' | 'dark';
  /** Whether the effective mode is dark */
  isDark: boolean;
  /** Current branding config */
  branding: BrandingConfig;
  /** Set theme mode */
  setTheme: (mode: ThemeMode) => void;
  /** Toggle between light and dark */
  toggleTheme: () => void;
  /** Update branding config (partial merge) */
  setBranding: (config: Partial<BrandingConfig>) => void;
}

export function useTheme(): UseThemeReturn {
  const mode = useThemeStore((s) => s.mode);
  const resolvedMode = useThemeStore((s) => s.resolvedMode);
  const branding = useThemeStore((s) => s.branding);
  const setMode = useThemeStore((s) => s.setMode);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const setBranding = useThemeStore((s) => s.setBranding);

  return {
    mode,
    resolvedMode,
    isDark: resolvedMode === 'dark',
    branding,
    setTheme: setMode,
    toggleTheme,
    setBranding,
  };
}

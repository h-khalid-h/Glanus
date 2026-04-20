/**
 * Zustand Theme Store
 *
 * Manages theme mode (light/dark/system), branding overrides,
 * and persists user preference to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode, BrandingConfig } from '@/theme/config';
import { defaultBranding } from '@/theme/config';

interface ThemeState {
  /** User's chosen mode: 'light' | 'dark' | 'system' */
  mode: ThemeMode;
  /** Resolved effective mode after system preference resolution */
  resolvedMode: 'light' | 'dark';
  /** Branding overrides (logo, app name, primary color) */
  branding: BrandingConfig;

  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setBranding: (config: Partial<BrandingConfig>) => void;
  /** Called internally to update resolved mode when system preference changes */
  _setResolvedMode: (mode: 'light' | 'dark') => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return getSystemTheme();
  return mode;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      resolvedMode: resolveMode('system'),
      branding: defaultBranding,

      setMode: (mode) =>
        set({
          mode,
          resolvedMode: resolveMode(mode),
        }),

      toggleTheme: () => {
        const current = get().resolvedMode;
        const next = current === 'dark' ? 'light' : 'dark';
        set({ mode: next, resolvedMode: next });
      },

      setBranding: (config) =>
        set((state) => ({
          branding: { ...state.branding, ...config },
        })),

      _setResolvedMode: (resolved) => set({ resolvedMode: resolved }),
    }),
    {
      name: 'glanus-theme',
      partialize: (state) => ({
        mode: state.mode,
        branding: state.branding,
      }),
    },
  ),
);

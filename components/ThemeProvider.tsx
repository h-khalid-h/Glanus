/**
 * ThemeProvider
 *
 * Applies the theme class ("dark" / "") to <html>, applies branding
 * CSS variable overrides, and listens for system theme changes.
 *
 * Must be rendered inside a client component. Should wrap the app
 * as high as possible in the component tree.
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { lightTheme, darkTheme, hexToHSL } from '@/theme/config';
import type { ThemeTokens } from '@/theme/config';

function applyThemeTokens(tokens: ThemeTokens) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(`--${key}`, value);
  }
}

function applyBrandingOverrides(primary?: string, primaryForeground?: string) {
  const root = document.documentElement;
  if (primary) {
    // If it looks like a hex color, convert it
    const hsl = primary.startsWith('#') ? hexToHSL(primary) : primary;
    root.style.setProperty('--primary', hsl);
    root.style.setProperty('--ring', hsl);
    root.style.setProperty('--sidebar-primary', hsl);
    root.style.setProperty('--sidebar-ring', hsl);
    root.style.setProperty('--nerve', hsl);
  }
  if (primaryForeground) {
    const hsl = primaryForeground.startsWith('#')
      ? hexToHSL(primaryForeground)
      : primaryForeground;
    root.style.setProperty('--primary-foreground', hsl);
    root.style.setProperty('--sidebar-primary-foreground', hsl);
  }
}

function clearInlineOverrides() {
  const root = document.documentElement;
  root.removeAttribute('style');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const resolvedMode = useThemeStore((s) => s.resolvedMode);
  const branding = useThemeStore((s) => s.branding);
  const _setResolvedMode = useThemeStore((s) => s._setResolvedMode);

  // Apply dark/light class and CSS variables
  const applyTheme = useCallback(
    (resolved: 'light' | 'dark') => {
      const root = document.documentElement;

      // Enable smooth transition (class removed after animation completes)
      root.classList.add('theme-transition');

      // Clear previous inline overrides so base CSS kicks in cleanly
      clearInlineOverrides();

      // Toggle class for Tailwind's dark: variants
      if (resolved === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      // Apply full token set as inline vars (overrides :root / .dark in CSS)
      const tokens = resolved === 'dark' ? darkTheme : lightTheme;
      applyThemeTokens(tokens);

      // Layer branding overrides on top
      applyBrandingOverrides(branding.primary, branding.primaryForeground);

      // Update meta theme-color
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute(
          'content',
          resolved === 'dark' ? '#0a0e1a' : '#fafbfc',
        );
      }

      // Remove transition class after animation completes
      setTimeout(() => root.classList.remove('theme-transition'), 350);
    },
    [branding],
  );

  // Apply theme on mount and whenever resolvedMode or branding changes
  useEffect(() => {
    applyTheme(resolvedMode);
  }, [resolvedMode, applyTheme]);

  // Listen for system preference changes when mode is 'system'
  useEffect(() => {
    if (mode !== 'system') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      _setResolvedMode(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mode, _setResolvedMode]);

  return <>{children}</>;
}

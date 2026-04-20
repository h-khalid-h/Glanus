/**
 * Theme Configuration
 *
 * Defines light, dark, and branding theme tokens.
 * All values are HSL components (without the hsl() wrapper)
 * to align with the existing Tailwind + CSS variable system.
 */

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeTokens {
  background: string;
  foreground: string;
  card: string;
  'card-foreground': string;
  popover: string;
  'popover-foreground': string;
  primary: string;
  'primary-foreground': string;
  secondary: string;
  'secondary-foreground': string;
  muted: string;
  'muted-foreground': string;
  accent: string;
  'accent-foreground': string;
  destructive: string;
  'destructive-foreground': string;
  success: string;
  'success-foreground': string;
  warning: string;
  'warning-foreground': string;
  border: string;
  input: string;
  ring: string;
  nerve: string;
  cortex: string;
  oracle: string;
  reflex: string;
  'surface-0': string;
  'surface-1': string;
  'surface-2': string;
  'surface-3': string;
  'sidebar-background': string;
  'sidebar-foreground': string;
  'sidebar-primary': string;
  'sidebar-primary-foreground': string;
  'sidebar-accent': string;
  'sidebar-accent-foreground': string;
  'sidebar-border': string;
  'sidebar-ring': string;
}

export interface BrandingConfig {
  appName: string;
  logo: string;
  /** HSL components for primary override, e.g. "262 70% 55%" */
  primary?: string;
  /** HSL components for primary foreground override */
  primaryForeground?: string;
  /** Optional favicon URL */
  favicon?: string;
}

export const lightTheme: ThemeTokens = {
  background: '220 20% 99%',
  foreground: '224 50% 10%',
  card: '0 0% 100%',
  'card-foreground': '224 50% 10%',
  popover: '0 0% 100%',
  'popover-foreground': '224 50% 10%',
  primary: '166 84% 39%',
  'primary-foreground': '0 0% 100%',
  secondary: '218 22% 95%',
  'secondary-foreground': '224 40% 18%',
  muted: '220 18% 95%',
  'muted-foreground': '220 12% 34%',
  accent: '166 50% 95%',
  'accent-foreground': '166 84% 28%',
  destructive: '4 76% 58%',
  'destructive-foreground': '0 0% 100%',
  success: '152 60% 42%',
  'success-foreground': '0 0% 100%',
  warning: '38 92% 55%',
  'warning-foreground': '38 90% 15%',
  border: '220 16% 84%',
  input: '220 16% 84%',
  ring: '166 84% 39%',
  nerve: '166 84% 39%',
  cortex: '262 70% 55%',
  oracle: '38 92% 55%',
  reflex: '152 60% 42%',
  'surface-0': '220 20% 99%',
  'surface-1': '220 18% 97%',
  'surface-2': '220 16% 95%',
  'surface-3': '220 14% 92%',
  'sidebar-background': '224 30% 98%',
  'sidebar-foreground': '224 30% 30%',
  'sidebar-primary': '166 84% 39%',
  'sidebar-primary-foreground': '0 0% 100%',
  'sidebar-accent': '220 18% 95%',
  'sidebar-accent-foreground': '224 30% 20%',
  'sidebar-border': '220 16% 86%',
  'sidebar-ring': '166 84% 39%',
};

export const darkTheme: ThemeTokens = {
  background: '228 35% 6%',
  foreground: '214 32% 95%',
  card: '228 30% 9%',
  'card-foreground': '214 32% 95%',
  popover: '228 30% 9%',
  'popover-foreground': '214 32% 95%',
  primary: '166 84% 44%',
  'primary-foreground': '228 35% 6%',
  secondary: '228 22% 15%',
  'secondary-foreground': '214 32% 90%',
  muted: '228 20% 15%',
  'muted-foreground': '218 14% 55%',
  accent: '228 22% 15%',
  'accent-foreground': '166 84% 55%',
  destructive: '4 76% 46%',
  'destructive-foreground': '0 0% 100%',
  success: '152 60% 46%',
  'success-foreground': '0 0% 100%',
  warning: '38 92% 55%',
  'warning-foreground': '38 90% 15%',
  border: '228 20% 15%',
  input: '228 20% 15%',
  ring: '166 84% 44%',
  nerve: '166 84% 48%',
  cortex: '262 74% 62%',
  oracle: '38 92% 58%',
  reflex: '152 60% 50%',
  'surface-0': '228 35% 6%',
  'surface-1': '228 30% 8%',
  'surface-2': '228 26% 11%',
  'surface-3': '228 22% 15%',
  'sidebar-background': '228 30% 7%',
  'sidebar-foreground': '214 32% 85%',
  'sidebar-primary': '166 84% 44%',
  'sidebar-primary-foreground': '0 0% 100%',
  'sidebar-accent': '228 20% 12%',
  'sidebar-accent-foreground': '214 32% 90%',
  'sidebar-border': '228 20% 13%',
  'sidebar-ring': '166 84% 44%',
};

export const defaultBranding: BrandingConfig = {
  appName: 'Glanus',
  logo: '/logo.svg',
};

/**
 * Convert a hex color to HSL components string.
 * Useful for tenant branding where colors come as hex from API.
 */
export function hexToHSL(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '166 84% 39%'; // fallback to default primary

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

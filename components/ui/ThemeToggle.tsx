/**
 * ThemeToggle — Icon button that cycles through light / dark / system.
 * ThemeDropdown — Dropdown with explicit Light / Dark / System options.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import type { ThemeMode } from '@/theme/config';

/* ────────────────────────────────────────────
   Simple icon toggle (cycles: light → dark → system)
   ──────────────────────────────────────────── */
export function ThemeToggle() {
  const { mode, resolvedMode, setTheme } = useTheme();

  const cycle = () => {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setTheme(next);
  };

  const label =
    mode === 'system'
      ? `System (${resolvedMode})`
      : mode === 'dark'
        ? 'Dark'
        : 'Light';

  return (
    <button
      onClick={cycle}
      aria-label={`Current theme: ${label}. Click to switch.`}
      title={label}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg
        text-muted-foreground transition-colors duration-200
        hover:bg-accent hover:text-accent-foreground
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {mode === 'system' ? (
        <Monitor className="h-[1.125rem] w-[1.125rem]" />
      ) : resolvedMode === 'dark' ? (
        <Moon className="h-[1.125rem] w-[1.125rem]" />
      ) : (
        <Sun className="h-[1.125rem] w-[1.125rem]" />
      )}
    </button>
  );
}

/* ────────────────────────────────────────────
   Dropdown with explicit options
   ──────────────────────────────────────────── */
const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeDropdown() {
  const { mode, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const current = options.find((o) => o.value === mode) ?? options[2];
  const CurrentIcon = current.icon;

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm
          text-muted-foreground transition-colors duration-200
          hover:bg-accent hover:text-accent-foreground
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CurrentIcon className="h-4 w-4" />
        <span>{current.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-1 w-36 origin-top-right rounded-lg border
            border-border bg-popover p-1 shadow-lg animate-fade-in"
        >
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = mode === opt.value;
            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={active}
                onClick={() => {
                  setTheme(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm
                  transition-colors duration-150
                  ${active ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/60'}`}
              >
                <Icon className="h-4 w-4" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

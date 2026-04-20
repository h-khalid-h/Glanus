'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { ChevronRight, Settings, LogOut } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const SECTION_LABELS: Record<string, string> = {
  'super-admin': 'Overview',
  workspaces: 'Workspaces',
  users: 'Users & Roles',
  billing: 'Billing',
  analytics: 'Analytics',
  audit: 'Audit Log',
  roles: 'Roles & Permissions',
};

function getActiveLabel(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const leaf = parts[parts.length - 1] || 'super-admin';
  return SECTION_LABELS[leaf] ?? 'System Management';
}

export function SuperAdminTopbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const activeLabel = getActiveLabel(pathname);

  const userInitial = (
    session?.user?.name?.[0] ||
    session?.user?.email?.[0] ||
    'A'
  ).toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
      <nav className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        <span className="hidden shrink-0 text-xs font-medium text-muted-foreground/50 sm:block">
          System Management
        </span>
        <ChevronRight className="hidden h-3 w-3 shrink-0 text-muted-foreground/30 sm:block" />
        <span className="truncate text-sm font-semibold text-foreground">{activeLabel}</span>
      </nav>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <div className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            onBlur={() => setTimeout(() => setUserMenuOpen(false), 150)}
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-xs font-bold text-primary transition-all hover:bg-primary/20 hover:shadow-sm"
            aria-expanded={userMenuOpen}
            aria-label="User menu"
          >
            {userInitial}
          </button>

          {userMenuOpen && (
            <div
              className="absolute right-0 z-50 mt-2 w-56 origin-top-right animate-slide-up rounded-2xl border border-border bg-card"
              style={{ boxShadow: 'var(--shadow-xl)' }}
            >
              <div className="border-b border-border px-4 py-3 text-left">
                <p className="truncate text-sm font-semibold text-foreground">
                  {session?.user?.name || 'Admin'}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {session?.user?.email || ''}
                </p>
              </div>
              <div className="p-1.5">
                <Link
                  href="/account"
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Account Settings
                </Link>
              </div>
              <div className="border-t border-border p-1.5">
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/8"
                >
                  <LogOut className="h-4 w-4 text-destructive/70" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

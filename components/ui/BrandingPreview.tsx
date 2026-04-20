/**
 * BrandingPreview — Admin-facing live preview for branding changes.
 *
 * Allows changing app name, logo URL, and primary color
 * with instant visual feedback (no page reload).
 */

'use client';

import { useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { hexToHSL } from '@/theme/config';

export function BrandingPreview() {
  const { branding, setBranding } = useTheme();
  const [nameInput, setNameInput] = useState(branding.appName);
  const [logoInput, setLogoInput] = useState(branding.logo);
  const [colorInput, setColorInput] = useState('#00BFA5');

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-foreground">Branding Preview</h3>

      <div className="space-y-3">
        {/* App Name */}
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">App Name</span>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={() => setBranding({ appName: nameInput })}
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm
              text-foreground placeholder:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="My SaaS App"
          />
        </label>

        {/* Logo URL */}
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Logo URL</span>
          <input
            type="text"
            value={logoInput}
            onChange={(e) => setLogoInput(e.target.value)}
            onBlur={() => setBranding({ logo: logoInput })}
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm
              text-foreground placeholder:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="/logos/my-logo.svg"
          />
        </label>

        {/* Primary Color */}
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Primary Color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorInput}
              onChange={(e) => {
                setColorInput(e.target.value);
                setBranding({ primary: hexToHSL(e.target.value) });
              }}
              className="h-9 w-9 cursor-pointer rounded-md border border-input"
            />
            <input
              type="text"
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value)}
              onBlur={() => setBranding({ primary: hexToHSL(colorInput) })}
              className="block flex-1 rounded-md border border-input bg-background px-3 py-2
                text-sm font-mono text-foreground
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="#4f46e5"
            />
          </div>
        </label>
      </div>

      {/* Live Preview Card */}
      <div className="mt-4 rounded-lg border border-border bg-background p-4">
        <p className="text-xs text-muted-foreground">Live Preview</p>
        <div className="mt-2 flex items-center gap-3">
          {branding.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logo}
              alt={branding.appName}
              className="h-8 w-8 rounded object-contain"
            />
          )}
          <span className="text-base font-semibold text-foreground">
            {branding.appName}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="inline-block rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            Primary Button
          </span>
          <span className="inline-block rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary">
            Outline Button
          </span>
        </div>
      </div>
    </div>
  );
}

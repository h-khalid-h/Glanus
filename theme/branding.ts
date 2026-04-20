/**
 * Branding Loader
 *
 * Detects tenant from subdomain or API and applies branding config.
 * Used at app bootstrap to load dynamic branding per tenant.
 */

import type { BrandingConfig } from '@/theme/config';

/**
 * Extract tenant slug from the current hostname.
 * e.g. "acme.glanus.io" => "acme"
 * Returns null for bare domain or localhost.
 */
export function getTenantFromSubdomain(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;

  // Skip localhost / IP addresses
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  const parts = hostname.split('.');
  // "tenant.domain.tld" => 3+ parts, first is tenant
  if (parts.length >= 3) {
    const tenant = parts[0];
    // Exclude common non-tenant subdomains
    if (['www', 'app', 'api', 'staging', 'dev'].includes(tenant)) {
      return null;
    }
    return tenant;
  }

  return null;
}

/**
 * Fetch branding config for a tenant from the API.
 * Falls back to null if the endpoint doesn't exist or tenant is unknown.
 */
export async function fetchTenantBranding(
  tenant: string,
): Promise<Partial<BrandingConfig> | null> {
  try {
    const res = await fetch(`/api/branding/${encodeURIComponent(tenant)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Load tenant branding on app bootstrap.
 * Returns the branding config to apply, or null if no tenant detected.
 */
export async function loadTenantBranding(): Promise<Partial<BrandingConfig> | null> {
  const tenant = getTenantFromSubdomain();
  if (!tenant) return null;
  return fetchTenantBranding(tenant);
}

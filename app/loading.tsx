import { GlobalLoader } from '@/components/ui/GlobalLoader';

/**
 * Global Loading Page
 *
 * Single unified loader for site bootstrap and page transitions.
 * Matches `AuthGuard` and `WorkspaceLayout` loading states so the
 * user sees one consistent loader on reload instead of a cascade of
 * skeletons / spinners.
 */
export default function Loading() {
    return <GlobalLoader />;
}

import { SkeletonDashboard } from '@/components/ui/Skeleton';

/**
 * Global Loading Page
 *
 * Displayed during page transitions as a loading state.
 * Uses the existing SkeletonDashboard component for consistency.
 */

export default function Loading() {
    return (
        <div className="min-h-screen bg-gradient-midnight p-6 lg:p-8">
            <SkeletonDashboard />
        </div>
    );
}

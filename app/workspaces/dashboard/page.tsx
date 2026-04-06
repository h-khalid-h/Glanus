import { redirect } from 'next/navigation';

/**
 * Workspace dashboard redirect — workspaces don't have a dedicated dashboard page,
 * they redirect to the analytics view which serves as the workspace dashboard.
 */
export default async function WorkspaceDashboardPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/workspaces/${id}/analytics`);
}

import { redirect } from 'next/navigation';

export default function AdminManagementPage() {
    redirect('/workspaces/manage/members');
}

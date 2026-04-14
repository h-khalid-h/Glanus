'use client';

import { Suspense, lazy } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

const WorkspaceWizard = lazy(() => import('@/components/WorkspaceWizard'));

export default function NewWorkspacePage() {
    return (
        <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
            <div className="mb-10 text-center">
                <h1 className="text-4xl font-extrabold text-gradient">
                    Glanus
                </h1>
                <p className="mt-2 text-lg text-muted-foreground">
                    Create your workspace to get started
                </p>
            </div>

            <Suspense fallback={
                <div className="flex items-center justify-center h-[400px] w-full max-w-4xl rounded-2xl border border-border bg-card backdrop-blur-sm shadow-xl">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            }>
                <WorkspaceWizard />
            </Suspense>

            <div className="mt-8 text-center text-sm text-muted-foreground flex flex-col gap-2">
                <p>
                    Already have a workspace?{' '}
                    <Link href="/login" className="font-medium text-primary hover:text-primary hover:underline transition-all">
                        Sign in
                    </Link>
                </p>
                <p className="text-xs text-muted-foreground">
                    By creating a workspace, you agree to our{' '}
                    <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link> and{' '}
                    <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
                </p>
            </div>
        </div>
    );
}

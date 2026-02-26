'use client';

import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

const WorkspaceWizard = lazy(() => import('@/components/WorkspaceWizard'));

export default function NewWorkspacePage() {
    return (
        <div className="min-h-screen bg-gradient-midnight py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
            <div className="mb-10 text-center">
                <h1 className="text-4xl font-extrabold text-gradient">
                    Glanus
                </h1>
                <p className="mt-2 text-lg text-slate-400">
                    Create your workspace to get started
                </p>
            </div>

            <Suspense fallback={
                <div className="flex items-center justify-center h-[400px] w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm shadow-xl">
                    <Loader2 className="w-8 h-8 animate-spin text-nerve" />
                </div>
            }>
                <WorkspaceWizard />
            </Suspense>

            <div className="mt-8 text-center text-sm text-slate-500 flex flex-col gap-2">
                <p>
                    Already have a workspace?{' '}
                    <a href="/login" className="font-medium text-nerve hover:text-nerve hover:underline transition-all">
                        Sign in
                    </a>
                </p>
                <p className="text-xs text-slate-400">
                    By creating a workspace, you agree to our{' '}
                    <a href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</a> and{' '}
                    <a href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
                </p>
            </div>
        </div>
    );
}

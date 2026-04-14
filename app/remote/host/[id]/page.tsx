'use client';

import { useParams } from 'next/navigation';
import { RemoteDesktopViewer } from '@/components/remote/RemoteDesktopViewer';

export default function RemoteHostPage() {
    const params = useParams();
    const sessionId = params.id as string;

    if (!sessionId) {
        return <div className="p-4 text-destructive">Missing session ID</div>;
    }

    return (
        <div className="w-screen h-screen overflow-hidden bg-black flex flex-col items-center justify-center">
            {/* The Host Viewer initiates the stream and pipes DataChannel events to enigo */}
            <div className="text-foreground text-xs mb-4 opacity-50">
                Glanus Agent Host Server Active
            </div>
            <div className="w-64 h-48 border border-white/20 rounded-lg">
                <RemoteDesktopViewer
                    sessionId={sessionId}
                    isHost={true}
                    onError={(err) => console.error('[Host Page]', err)}
                />
            </div>
        </div>
    );
}

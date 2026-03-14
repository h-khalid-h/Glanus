'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { RemoteDesktopViewer } from '@/components/remote/RemoteDesktopViewer';
import { SessionControls } from '@/components/remote/SessionControls';

interface RemoteSession {
    id: string;
    status: string;
    startedAt: string;
    quality?: string;
    asset: {
        id: string;
        name: string;
        category: string;
    };
    user: {
        id: string;
        name: string;
        email: string;
    };
}

export default function ActiveSessionPage() {
    const { error: showError } = useToast();
    const params = useParams();
    const router = useRouter();
    const [session, setSession] = useState<RemoteSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const viewerContainerRef = useRef<HTMLDivElement>(null);
    const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        if (params.id) {
            fetchSession();
            startDurationTimer();
        }

        return () => {
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
        };
    }, [params.id]);

    const fetchSession = async () => {
        try {
            const response = await csrfFetch(`/api/remote/sessions/${params.id}`);
            if (!response.ok) {
                if (response.status === 404) {
                    router.push('/remote');
                }
                throw new Error('Failed to fetch session');
            }
            const data = await response.json();
            setSession(data);
        } catch (error: unknown) {
            showError('Error fetching session:', error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const startDurationTimer = () => {
        durationIntervalRef.current = setInterval(() => {
            setDuration((prev) => prev + 1);
        }, 1000);
    };

    const handleStartRecording = async () => {
        try {
            // Get the video element from the RemoteDesktopViewer
            const videoEl = viewerContainerRef.current?.querySelector('video');
            if (!videoEl || !videoEl.srcObject) {
                showError('No active video stream to record');
                return;
            }

            const stream = videoEl.srcObject as MediaStream;
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                    ? 'video/webm;codecs=vp9'
                    : 'video/webm',
            });

            recordedChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start(1000); // Collect data every second
            mediaRecorderRef.current = mediaRecorder;
            setIsRecording(true);
        } catch (_err: unknown) {
            showError('Failed to start recording');
        }
    };

    const handleStopRecording = async () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();

            // Wait briefly for final data
            await new Promise((resolve) => setTimeout(resolve, 200));

            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `session-${session?.id}-${new Date().toISOString().slice(0, 19)}.webm`;
            a.click();
            URL.revokeObjectURL(url);
        }

        mediaRecorderRef.current = null;
        recordedChunksRef.current = [];
        setIsRecording(false);
    };

    const handleQualityChange = async (quality: string) => {
        try {
            await csrfFetch(`/api/remote/sessions/${params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quality }),
            });
        } catch (error: unknown) {
            showError('Error updating quality:', error instanceof Error ? error.message : 'An unexpected error occurred');
        }
    };

    const handleScreenshot = () => {
        const videoEl = viewerContainerRef.current?.querySelector('video');
        if (!videoEl || !videoEl.srcObject) {
            showError('No active video stream to capture');
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth || 1920;
        canvas.height = videoEl.videoHeight || 1080;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');

        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `screenshot-${session?.id}-${new Date().toISOString().slice(0, 19)}.png`;
        a.click();
    };

    const handleFullscreen = () => {
        if (!viewerContainerRef.current) return;

        if (!isFullscreen) {
            viewerContainerRef.current.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const handleDisconnect = async () => {
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
        }

        try {
            await csrfFetch(`/api/remote/sessions/${params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'ENDED',
                    metadata: {
                        disconnectReason: 'User disconnected',
                    },
                }),
            });
        } catch (error: unknown) {
            showError('Error ending session:', error instanceof Error ? error.message : 'An unexpected error occurred');
        }

        router.push('/remote');
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-nerve mx-auto mb-4" />
                    <p className="text-white text-lg">Loading session...</p>
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-white text-lg mb-4">Session not found</p>
                    <button type="button" onClick={() => router.push('/remote')} className="btn-primary">
                        Back to Sessions
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Header (only show when not fullscreen) */}
            {!isFullscreen && (
                <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-foreground">{session.asset.name}</h1>
                            <p className="text-sm text-slate-400">{session.asset.category}</p>
                        </div>
                        <div className="text-sm text-slate-400">
                            Connected as: <span className="text-white">{session.user.name}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Viewer Container */}
            <div
                ref={viewerContainerRef}
                className={`${isFullscreen ? 'h-screen' : 'h-[calc(100vh-200px)]'} bg-slate-950 relative`}
            >
                <div className="max-w-7xl mx-auto h-full p-4">
                    <RemoteDesktopViewer
                        sessionId={session.id}
                        isHost={false} // For now, assume viewer role
                        onError={(error) => console.error('[Page] Error:', error)}
                    />
                </div>

                {/* Floating Controls (bottom) */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
                    <SessionControls
                        sessionId={session.id}
                        isRecording={isRecording}
                        onStartRecording={handleStartRecording}
                        onStopRecording={handleStopRecording}
                        onQualityChange={handleQualityChange}
                        onScreenshot={handleScreenshot}
                        onFullscreen={handleFullscreen}
                        onDisconnect={handleDisconnect}
                        duration={duration}
                    />
                </div>
            </div>
        </div>
    );
}

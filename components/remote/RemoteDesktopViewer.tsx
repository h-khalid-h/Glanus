'use client';

import { useEffect, useRef, useState } from 'react';
import { WebRTCClient, ConnectionMetrics } from '@/lib/webrtc/client';
import SimplePeer from 'simple-peer';
import { csrfFetch } from '@/lib/api/csrfFetch';

interface RemoteDesktopViewerProps {
    sessionId: string;
    isHost: boolean; // Host shares screen, client views
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
}

export function RemoteDesktopViewer({
    sessionId,
    isHost,
    onConnect,
    onDisconnect,
    onError,
}: RemoteDesktopViewerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [client, setClient] = useState<WebRTCClient | null>(null);
    const [connected, setConnected] = useState(false);
    const [metrics, setMetrics] = useState<ConnectionMetrics | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Initialize WebRTC client
        const webrtcClient = new WebRTCClient({
            sessionId,
            isInitiator: isHost,
        });

        // Polling state
        let lastSeenIceCandidates = 0;
        let hasProcessedOffer = false;
        let hasProcessedAnswer = false;

        webrtcClient.onSignal = async (signal) => {
            console.debug('[Viewer] Sending signal to backend:', signal.type || 'candidate');
            try {
                const payload: Record<string, unknown> = {};
                if (signal.type === 'offer') payload.offer = signal;
                else if (signal.type === 'answer') payload.answer = signal;
                else if ('candidate' in signal) payload.iceCandidates = [signal];

                if (Object.keys(payload).length > 0) {
                    await csrfFetch(`/api/remote/sessions/${sessionId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                }
            } catch (err: unknown) {
                console.error('[Viewer] Failed to send WebRTC signal', err);
            }
        };

        webrtcClient.onConnect = () => {
            setConnected(true);
            onConnect?.();
        };

        webrtcClient.onDisconnect = () => {
            setConnected(false);
            onDisconnect?.();
        };

        webrtcClient.onStream = (stream) => {
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        };

        webrtcClient.onError = (err) => {
            console.error('[Viewer] Error:', err);
            setError(err.message);
            onError?.(err);
        };

        webrtcClient.onMetrics = (m) => {
            setMetrics(m);
        };

        // If host, start screen sharing
        if (isHost) {
            webrtcClient
                .getDisplayMedia()
                .catch((err) => {
                    console.error('[Viewer] Failed to start screen sharing:', err);
                    setError('Failed to start screen sharing. Please grant permission.');
                });
        }

        setClient(webrtcClient);

        // SDP Database Polling Loop
        const pollInterval = setInterval(async () => {
            if (webrtcClient.isConnected()) return; // Stop polling once connected

            try {
                const res = await csrfFetch(`/api/remote/sessions/${sessionId}`);
                if (!res.ok) return;
                const session = await res.json();

                // Non-host (viewer) receives offer
                if (!isHost && session.data?.offer && !hasProcessedOffer) {
                    console.debug('[Viewer] Received offer from host');
                    webrtcClient.signal(session.data.offer);
                    hasProcessedOffer = true;
                }

                // Host receives answer
                if (isHost && session.data?.answer && !hasProcessedAnswer) {
                    console.debug('[Viewer] Received answer from client');
                    webrtcClient.signal(session.data.answer);
                    hasProcessedAnswer = true;
                }

                // Both sides process new ICE candidates
                const remoteCandidates = session.data?.iceCandidates || [];
                if (remoteCandidates.length > lastSeenIceCandidates) {
                    const newCandidates = remoteCandidates.slice(lastSeenIceCandidates);
                    newCandidates.forEach((candidate: SimplePeer.SignalData) => {
                        console.debug('[Viewer] Applying remote ICE candidate');
                        webrtcClient.signal(candidate);
                    });
                    lastSeenIceCandidates = remoteCandidates.length;
                }

            } catch (error: unknown) {
                console.error('[Viewer] Polling error:', error);
            }
        }, 2000);

        // Cleanup on unmount
        return () => {
            clearInterval(pollInterval);
            webrtcClient.destroy();
        };
    }, [sessionId, isHost]);

    return (
        <div className="relative w-full h-full bg-slate-950 rounded-lg overflow-hidden">
            {/* Video element for remote stream */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-contain ${connected && !isHost ? 'block' : 'hidden'}`}
            />

            {/* Canvas for drawing (future feature) */}
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none hidden"
            />

            {/* Connection Status Overlay */}
            {!connected && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90">
                    <div className="text-center">
                        {error ? (
                            <>
                                <div className="text-health-critical mb-4">
                                    <svg
                                        className="w-16 h-16 mx-auto"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                </div>
                                <p className="text-white text-lg font-medium">{error}</p>
                            </>
                        ) : (
                            <>
                                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-nerve mx-auto mb-4" />
                                <p className="text-white text-lg font-medium">
                                    {isHost ? 'Starting screen share...' : 'Connecting to remote desktop...'}
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Metrics Overlay */}
            {connected && metrics && (
                <div className="absolute top-4 right-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500">Latency:</span>
                        <span className={metrics.latency > 200 ? 'text-health-warn' : 'text-health-good'}>
                            {metrics.latency}ms
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500">FPS:</span>
                        <span className={metrics.fps < 20 ? 'text-health-warn' : 'text-health-good'}>
                            {metrics.fps}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500">Quality:</span>
                        <div
                            className={`w-2 h-2 rounded-full ${metrics.latency < 100 && metrics.fps > 25
                                ? 'bg-health-good'
                                : metrics.latency < 200 && metrics.fps > 15
                                    ? 'bg-health-warn'
                                    : 'bg-health-critical'
                                }`}
                        />
                    </div>
                </div>
            )}

            {/* Connection Indicator */}
            <div className="absolute top-4 left-4">
                <div className="flex items-center gap-2 bg-black/70 text-white px-3 py-2 rounded-lg text-sm">
                    <div
                        className={`w-2 h-2 rounded-full ${connected ? 'bg-health-good animate-pulse' : 'bg-slate-500'
                            }`}
                    />
                    <span>{connected ? 'Connected' : 'Disconnected'}</span>
                </div>
            </div>
        </div>
    );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { WebRTCClient, ConnectionMetrics } from '@/lib/webrtc/client';
import { csrfFetch } from '@/lib/api/csrfFetch';

interface RemoteDesktopViewerProps {
    sessionId: string;
    isHost: boolean; // Host shares screen, client views
    /**
     * Read-only viewing — input events are not captured or transmitted.
     * Set from the session payload (server side authoritative). Defaults
     * to false for backwards compatibility with sessions created before
     * the flag existed.
     */
    viewOnly?: boolean;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
}

export function RemoteDesktopViewer({
    sessionId,
    isHost,
    viewOnly = false,
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
    // User-facing kill-switch. When false, no input is transmitted even if
    // we're connected and the session is not view-only. Re-arms with the
    // toolbar toggle / Ctrl+Alt+Pause. View-only sessions force this off.
    const [controlEnabled, setControlEnabled] = useState<boolean>(!viewOnly);
    // Latest pending mousemove, flushed once per animation frame. The raw
    // `mousemove` DOM event fires per pixel of motion (often >500 Hz on
    // high-DPI mice), which floods the SCTP data channel and starves the
    // RTP video pipe — coalescing to ~60 Hz keeps latency low.
    const pendingMouseMove = useRef<{ x: number; y: number } | null>(null);
    const mouseMoveRaf = useRef<number | null>(null);

    useEffect(() => {
        // The peer is constructed AFTER we resolve ICE servers from the
        // backend (STUN + TURN). Hardcoding STUN-only made any peer behind
        // symmetric NAT (most corporate / mobile networks) fail forever.
        // simple-peer generates the SDP offer in the next microtask after
        // construction, so we MUST fetch the server list first — applying
        // it after the offer is on the wire has no effect.
        let webrtcClient: WebRTCClient | null = null;
        let pollInterval: ReturnType<typeof setInterval> | null = null;
        let connectTimeout: ReturnType<typeof setTimeout> | null = null;
        let cancelled = false;

        const lastSeenIceCandidates = { current: 0 };
        const hasProcessedAnswer = { current: false };
        // ── ICE-failure recovery state ─────────────────────────────────
        // Most "session works on LAN, dies on real internet" reports trace
        // back to ICE failing to keep a path open through hostile NAT/
        // firewall. The browser's `iceconnectionstatechange` is the only
        // signal we get for that — simple-peer's `error`/`close` events
        // fire only after the peer connection has already been torn down.
        // We attach a state watchdog below: on the first `failed` we do
        // an in-place ICE restart; if the connection has not recovered
        // within RECOVERY_TIMEOUT_MS we surface an actionable error.
        const ICE_RESTART_BUDGET = 1; // single in-place restart, then give up
        const RECOVERY_TIMEOUT_MS = 10_000;
        const DISCONNECTED_GRACE_MS = 15_000;
        const iceRestartAttempts = { current: 0 };
        const iceRecoveryTimer = { current: null as ReturnType<typeof setTimeout> | null };
        const disconnectedGraceTimer = { current: null as ReturnType<typeof setTimeout> | null };

        const wireClient = (peer: WebRTCClient) => {
            webrtcClient = peer;

        peer.onSignal = async (signal) => {
            console.debug('[Viewer] Sending signal to backend:', signal.type || 'candidate');
            try {
                const payload: Record<string, unknown> = {};
                if (signal.type === 'offer') payload.offer = signal;
                else if (signal.type === 'answer') payload.answer = signal;
                else if ('candidate' in signal) {
                    // simple-peer emits ICE as `{type:'candidate', candidate: RTCIceCandidateInit}`.
                    // The backend's signaling validator expects a FLAT
                    // `{candidate: string, sdpMid?, sdpMLineIndex?}` shape and
                    // rejects nested objects with HTTP 400 — which is why ICE
                    // exchange silently failed in the previous build. Unwrap.
                    const init = (signal as { candidate: RTCIceCandidateInit | null }).candidate;
                    if (init && typeof init.candidate === 'string') {
                        payload.iceCandidate = {
                            candidate: init.candidate,
                            ...(typeof init.sdpMid === 'string' ? { sdpMid: init.sdpMid } : {}),
                            ...(typeof init.sdpMLineIndex === 'number' ? { sdpMLineIndex: init.sdpMLineIndex } : {}),
                        };
                    }
                }

                if (Object.keys(payload).length > 0) {
                    await csrfFetch(`/api/remote/sessions/${sessionId}/signaling`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                }
            } catch (err: unknown) {
                console.error('[Viewer] Failed to send WebRTC signal', err);
            }
        };

        peer.onConnect = () => {
            setConnected(true);
            // A successful connect clears any prior ICE-failure recovery
            // state — if the connection later drops we get a fresh budget.
            iceRestartAttempts.current = 0;
            if (iceRecoveryTimer.current) {
                clearTimeout(iceRecoveryTimer.current);
                iceRecoveryTimer.current = null;
            }
            onConnect?.();
        };

        peer.onDisconnect = () => {
            setConnected(false);
            onDisconnect?.();
        };

        peer.onStream = (stream) => {
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        };

        if (isHost) {
            import('@tauri-apps/api/core').then(({ invoke }) => {
                peer.onData = (data: any) => {
                    if (data && data.type) {
                        try {
                            invoke('simulate_input', {
                                eventType: data.type,
                                key: data.key,
                                x: data.x,
                                y: data.y,
                                button: data.button
                            });
                        } catch (err) {
                            console.error('[WebRTC Host] Invoke Error:', err);
                        }
                    }
                };
            }).catch(e => console.error('[Host] Failed to import Tauri core', e));
        }

        peer.onError = (err) => {
            console.error('[Viewer] Error:', err);
            setError(err.message);
            onError?.(err);
        };

        peer.onMetrics = (m) => {
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

        setClient(peer);

        // ── ICE state watchdog ─────────────────────────────────────────
        // simple-peer creates the underlying RTCPeerConnection synchronously
        // in its constructor, so `getPeerConnection()` is safe to call here.
        // We attach `oniceconnectionstatechange` directly because simple-peer
        // does not bubble that event up. Behaviour:
        //   - `disconnected`: transient, often recovers on its own → start a
        //     grace timer; if still not back to `connected`/`completed` by
        //     DISCONNECTED_GRACE_MS, escalate to `failed` handling.
        //   - `failed`: try one in-place ICE restart (fresh ufrag/pwd → new
        //     candidate-pair search). If the connection has not returned to
        //     a healthy state within RECOVERY_TIMEOUT_MS, abort with an
        //     actionable error so the operator can retry the session.
        const pc = peer.getPeerConnection();
        if (pc) {
            pc.oniceconnectionstatechange = () => {
                const state = pc.iceConnectionState;
                console.debug('[Viewer] iceConnectionState ->', state);

                if (state === 'connected' || state === 'completed') {
                    // Recovered. Cancel any pending grace/recovery timers.
                    if (disconnectedGraceTimer.current) {
                        clearTimeout(disconnectedGraceTimer.current);
                        disconnectedGraceTimer.current = null;
                    }
                    if (iceRecoveryTimer.current) {
                        clearTimeout(iceRecoveryTimer.current);
                        iceRecoveryTimer.current = null;
                    }
                    return;
                }

                if (state === 'disconnected') {
                    if (disconnectedGraceTimer.current) return;
                    disconnectedGraceTimer.current = setTimeout(() => {
                        disconnectedGraceTimer.current = null;
                        // If still disconnected after the grace window,
                        // treat as failed and trigger recovery.
                        if (pc.iceConnectionState === 'disconnected') {
                            console.warn('[Viewer] disconnected past grace, escalating to failed');
                            triggerIceRecovery();
                        }
                    }, DISCONNECTED_GRACE_MS);
                    return;
                }

                if (state === 'failed') {
                    triggerIceRecovery();
                }
            };

            const triggerIceRecovery = () => {
                if (iceRecoveryTimer.current) return; // already recovering

                if (iceRestartAttempts.current >= ICE_RESTART_BUDGET) {
                    setError(
                        'The connection to the remote agent failed and could not recover. ' +
                        'This usually means a firewall or NAT is blocking the WebRTC media path. ' +
                        'Verify the TURN server is reachable from both ends and retry.',
                    );
                    onDisconnect?.();
                    return;
                }

                iceRestartAttempts.current += 1;
                console.warn(
                    `[Viewer] ICE failed — attempting in-place restart (${iceRestartAttempts.current}/${ICE_RESTART_BUDGET})`,
                );
                const ok = peer.restartIce();
                if (!ok) {
                    setError('ICE restart unavailable in this browser. Please retry the session.');
                    onDisconnect?.();
                    return;
                }
                // Reset answer-processed flag so the polling loop re-applies
                // the new answer the agent will send back for the renegotiated
                // offer. (The agent must clear its old answer when it sees a
                // new offer; that's enforced server-side via signaling PATCH.)
                hasProcessedAnswer.current = false;

                iceRecoveryTimer.current = setTimeout(() => {
                    iceRecoveryTimer.current = null;
                    const s = pc.iceConnectionState;
                    if (s !== 'connected' && s !== 'completed') {
                        setError(
                            'The connection could not be re-established after an ICE restart. ' +
                            'Please end this session and start a new one.',
                        );
                        onDisconnect?.();
                    }
                }, RECOVERY_TIMEOUT_MS);
            };
        }

        // ── Connect-timeout watchdog ──────────────────────────────
        // Fail fast if the agent never produces an answer — gives the
        // user clear feedback rather than an indefinite spinner.
        const CONNECT_TIMEOUT_MS = 30_000;
        connectTimeout = setTimeout(() => {
            if (!peer.isConnected() && !hasProcessedAnswer.current) {
                console.warn('[Viewer] Connect timeout — no answer from agent');
                setError('Agent did not respond within 30 seconds. Ensure remote desktop is enabled on this device and the agent is online.');
            }
        }, CONNECT_TIMEOUT_MS);

        // SDP Database Polling Loop
        pollInterval = setInterval(async () => {
            if (peer.isConnected()) return; // Stop polling once connected

            try {
                const res = await csrfFetch(`/api/remote/sessions/${sessionId}/signaling`);
                if (!res.ok) return;
                const sessionResponse = await res.json();
                const sessionData = sessionResponse.data || sessionResponse;

                // Admin receives answer from Agent
                if (sessionData.answer && !hasProcessedAnswer.current) {
                    console.debug('[Viewer] Received answer from agent');
                    peer.signal(sessionData.answer);
                    hasProcessedAnswer.current = true;
                }

                // Process new ICE candidates from the agent
                const remoteCandidates = sessionData.iceCandidates || [];
                if (remoteCandidates.length > lastSeenIceCandidates.current) {
                    const newCandidates = remoteCandidates.slice(lastSeenIceCandidates.current);
                    newCandidates.forEach((candidate: any) => {
                        if (candidate.source !== 'agent') return;
                        // Strip backend annotation; build a clean ICE init.
                        const init: RTCIceCandidateInit = { candidate: candidate.candidate };
                        if (typeof candidate.sdpMid === 'string') init.sdpMid = candidate.sdpMid;
                        if (typeof candidate.sdpMLineIndex === 'number') init.sdpMLineIndex = candidate.sdpMLineIndex;
                        console.debug('[Viewer] Applying remote ICE candidate');
                        // simple-peer's signal() expects ICE wrapped: `{ candidate: init }`.
                        // simple-peer's TS types declare `candidate` as RTCIceCandidate but
                        // its runtime accepts an init object — cast through unknown.
                        peer.signal({ candidate: init } as unknown as Parameters<typeof peer.signal>[0]);
                    });
                    lastSeenIceCandidates.current = remoteCandidates.length;
                }

            } catch (error: unknown) {
                console.error('[Viewer] Polling error:', error);
            }
        }, 2000);
        }; // end wireClient

        // Bootstrap — fetch ICE servers, then construct + wire the peer.
        (async () => {
            let iceServers: RTCIceServer[] | undefined;
            try {
                const res = await csrfFetch('/api/remote/ice-servers');
                if (res.ok) {
                    const body = await res.json();
                    iceServers = (body?.data ?? body)?.iceServers;
                }
            } catch (err) {
                console.warn('[Viewer] Failed to fetch ICE servers, using default STUN', err);
            }
            if (cancelled) return;
            const peer = new WebRTCClient({
                sessionId,
                isInitiator: true,
                iceServers,
            });
            wireClient(peer);
        })();

        // Cleanup on unmount — handles both pre- and post-bootstrap states.
        return () => {
            cancelled = true;
            if (pollInterval) clearInterval(pollInterval);
            if (connectTimeout) clearTimeout(connectTimeout);
            if (iceRecoveryTimer.current) clearTimeout(iceRecoveryTimer.current);
            if (disconnectedGraceTimer.current) clearTimeout(disconnectedGraceTimer.current);
            webrtcClient?.destroy();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, isHost]);

    // Force-disable control if the session becomes view-only after mount
    // (e.g. server flips the flag mid-session). Cannot re-enable from the
    // client; the prop is authoritative.
    useEffect(() => {
        if (viewOnly && controlEnabled) setControlEnabled(false);
    }, [viewOnly, controlEnabled]);

    // Input handlers for the CLIENT
    const inputAllowed = client !== null && connected && !isHost && !viewOnly && controlEnabled;

    const sendMouseAt = (clientX: number, clientY: number, type: string, button: string) => {
        if (!videoRef.current || !client) return;
        const rect = videoRef.current.getBoundingClientRect();
        // The video's intrinsic size matches the agent's capture resolution
        // (set by the encoder). Scaling clientX/Y by videoWidth/rect.width
        // produces absolute pixel coordinates in the remote display's frame
        // — which is exactly what libxdo / enigo `move_mouse(x, y, Abs)`
        // expect. No additional DPR / monitor-offset math is needed for
        // the single-monitor case.
        const scaleX = videoRef.current.videoWidth / rect.width;
        const scaleY = videoRef.current.videoHeight / rect.height;
        const x = Math.round((clientX - rect.left) * scaleX);
        const y = Math.round((clientY - rect.top) * scaleY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        client.sendData({ type, x, y, button });
    };

    const handleMouseEvent = (e: React.MouseEvent, type: string) => {
        if (!inputAllowed || !videoRef.current) return;

        let button = 'left';
        if (e.button === 1) button = 'middle';
        if (e.button === 2) button = 'right';

        if (type === 'mousemove') {
            // Coalesce per animation frame. The latest position wins;
            // intermediate motion is dropped on purpose — the agent
            // tracks the cursor at ~60 Hz, no human notices missing
            // sub-frame samples.
            pendingMouseMove.current = { x: e.clientX, y: e.clientY };
            if (mouseMoveRaf.current !== null) return;
            mouseMoveRaf.current = requestAnimationFrame(() => {
                mouseMoveRaf.current = null;
                const p = pendingMouseMove.current;
                pendingMouseMove.current = null;
                if (!p || !inputAllowed) return;
                sendMouseAt(p.x, p.y, 'mousemove', 'left');
            });
            return;
        }

        sendMouseAt(e.clientX, e.clientY, type, button);
    };

    const handleKeyEvent = (e: React.KeyboardEvent, type: string) => {
        if (!inputAllowed) return;

        // Ctrl+Alt+Pause = local kill-switch (does not reach the remote).
        // Picked because no real keyboard sends Pause naturally and it
        // can't trigger inside a typing flow accidentally.
        if (type === 'keydown' && e.ctrlKey && e.altKey && e.key === 'Pause') {
            e.preventDefault();
            setControlEnabled(false);
            console.warn('[Viewer] Local kill-switch engaged (Ctrl+Alt+Pause)');
            return;
        }

        e.preventDefault(); // Stop scrolling when hitting spacebar, etc
        if (client) {
            client.sendData({ type, key: e.key });
        }
    };

    // `wheel` events have to be captured with a non-passive native listener
    // — React's synthetic onWheel registers as passive in modern React, so
    // `preventDefault()` inside the synthetic handler is a no-op and the
    // browser still scrolls the surrounding page. Attach directly.
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const handler = (e: WheelEvent) => {
            if (!inputAllowed) return;
            e.preventDefault();
            if (!client || !videoRef.current) return;
            const rect = videoRef.current.getBoundingClientRect();
            const scaleX = videoRef.current.videoWidth / rect.width;
            const scaleY = videoRef.current.videoHeight / rect.height;
            // Normalise deltaMode → pixels. DOM_DELTA_LINE/PAGE happen on
            // some Linux/Wayland drivers; treat one line as 16px (browser
            // default) and one page as the video's height.
            let dx = e.deltaX;
            let dy = e.deltaY;
            if (e.deltaMode === 1) { dx *= 16; dy *= 16; }
            else if (e.deltaMode === 2) { dx *= rect.width; dy *= rect.height; }
            client.sendData({
                type: 'scroll',
                x: Math.round((e.clientX - rect.left) * scaleX),
                y: Math.round((e.clientY - rect.top) * scaleY),
                deltaX: Math.round(dx),
                deltaY: Math.round(dy),
            });
        };
        video.addEventListener('wheel', handler, { passive: false });
        return () => video.removeEventListener('wheel', handler);
    }, [client, inputAllowed]);

    // Cancel pending coalesced mousemove on unmount/disable.
    useEffect(() => {
        if (inputAllowed) return;
        if (mouseMoveRaf.current !== null) {
            cancelAnimationFrame(mouseMoveRaf.current);
            mouseMoveRaf.current = null;
        }
        pendingMouseMove.current = null;
    }, [inputAllowed]);

    return (
        <div
            className="relative w-full h-full bg-background rounded-lg overflow-hidden focus:outline-none"
            tabIndex={0}
            onKeyDown={(e) => handleKeyEvent(e, 'keydown')}
            onKeyUp={(e) => handleKeyEvent(e, 'keyup')}
        >
            {/* Video element for remote stream */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-contain ${connected && !isHost ? 'block' : 'hidden'}`}
                onMouseMove={(e) => handleMouseEvent(e, 'mousemove')}
                onMouseDown={(e) => handleMouseEvent(e, 'mousedown')}
                onMouseUp={(e) => handleMouseEvent(e, 'mouseup')}
                onClick={(e) => handleMouseEvent(e, 'click')}
                onContextMenu={(e) => {
                    e.preventDefault();
                    handleMouseEvent(e, 'mousedown');
                    setTimeout(() => handleMouseEvent(e, 'mouseup'), 50);
                }}
            />

            {/* Canvas for drawing (future feature) */}
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none hidden"
            />

            {/* Connection Status Overlay */}
            {!connected && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/90">
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
                                <p className="text-foreground text-lg font-medium">{error}</p>
                            </>
                        ) : (
                            <>
                                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-nerve mx-auto mb-4" />
                                <p className="text-foreground text-lg font-medium">
                                    {isHost ? 'Starting screen share...' : 'Connecting to remote desktop...'}
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* View-only / kill-switch banner */}
            {connected && !isHost && (viewOnly || !controlEnabled) && (
                <div
                    className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/95 text-amber-950 px-3 py-1.5 rounded-md text-sm font-medium shadow-lg flex items-center gap-2"
                    role="status"
                >
                    <span aria-hidden>👁</span>
                    <span>
                        {viewOnly
                            ? 'View-only — input is disabled for this session'
                            : 'Control released (Ctrl+Alt+Pause)'}
                    </span>
                    {!viewOnly && (
                        <button
                            type="button"
                            className="ml-2 px-2 py-0.5 rounded bg-amber-950 text-amber-50 text-xs hover:bg-amber-900"
                            onClick={() => setControlEnabled(true)}
                        >
                            Take control
                        </button>
                    )}
                </div>
            )}

            {/* Metrics Overlay */}
            {connected && metrics && (
                <div className="absolute top-4 right-4 bg-black/70 text-foreground px-4 py-2 rounded-lg text-sm space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Latency:</span>
                        <span className={metrics.latency > 200 ? 'text-health-warn' : 'text-health-good'}>
                            {metrics.latency}ms
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">FPS:</span>
                        <span className={metrics.fps < 20 ? 'text-health-warn' : 'text-health-good'}>
                            {metrics.fps}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Quality:</span>
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
                <div className="flex items-center gap-2 bg-black/70 text-foreground px-3 py-2 rounded-lg text-sm">
                    <div
                        className={`w-2 h-2 rounded-full ${connected ? 'bg-health-good animate-pulse' : 'bg-muted'
                            }`}
                    />
                    <span>{connected ? 'Connected' : 'Disconnected'}</span>
                </div>
            </div>
        </div>
    );
}

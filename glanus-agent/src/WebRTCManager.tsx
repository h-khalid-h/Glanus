import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Camera } from 'lucide-react';

interface WebRTCManagerProps {
    apiUrl: string;
}

export function WebRTCManager({ apiUrl }: WebRTCManagerProps) {
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'CONNECTED'>('IDLE');

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const dcRef = useRef<RTCDataChannel | null>(null);
    const pollIntervalRef = useRef<number | null>(null);
    const icePollIntervalRef = useRef<number | null>(null);

    const getAuthHeader = useCallback(async (): Promise<Record<string, string>> => {
        try {
            const token = await invoke<string>('get_auth_token');
            return { Authorization: `Bearer ${token}` };
        } catch {
            return {};
        }
    }, []);

    const stopSession = useCallback(async () => {
        if (icePollIntervalRef.current) {
            clearInterval(icePollIntervalRef.current);
            icePollIntervalRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }

        if (activeSessionId) {
            try {
                const headers = await getAuthHeader();
                const baseApi = apiUrl.replace(/\/$/, "");
                await fetch(`${baseApi}/api/remote/sessions/${activeSessionId}/signaling`, {
                    method: 'PATCH',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'ENDED' })
                });
            } catch { /* ignore */ }
        }

        setActiveSessionId(null);
        setStatus('IDLE');
    }, [activeSessionId, apiUrl, getAuthHeader]);

    const pollIceCandidates = useCallback((sessionId: string, pc: RTCPeerConnection, baseApi: string) => {
        let lastCandidateCount = 0;

        icePollIntervalRef.current = window.setInterval(async () => {
            if (pc.connectionState === 'closed') {
                if (icePollIntervalRef.current) clearInterval(icePollIntervalRef.current);
                return;
            }

            try {
                const headers = await getAuthHeader();
                const res = await fetch(`${baseApi}/api/remote/sessions/${sessionId}/signaling`, { headers });
                if (!res.ok) return;

                const data = await res.json();
                const session = data.data || data;

                if (session.status === 'ENDED' || session.status === 'FAILED') {
                    stopSession();
                    return;
                }

                const candidates: RTCIceCandidateInit[] = session.iceCandidates || [];
                if (candidates.length > lastCandidateCount) {
                    for (let i = lastCandidateCount; i < candidates.length; i++) {
                        const c = candidates[i] as RTCIceCandidateInit & { source?: string };
                        if (c.source === 'admin') {
                            await pc.addIceCandidate(new RTCIceCandidate(c));
                        }
                    }
                    lastCandidateCount = candidates.length;
                }
            } catch {
                // Ignore poll errors
            }
        }, 2000);
    }, [getAuthHeader, stopSession]);

    const startSession = useCallback(async (sessionId: string, offer: RTCSessionDescriptionInit, baseApi: string) => {
        setStatus('CONNECTING');
        setActiveSessionId(sessionId);

        try {
            // 1. Get Screen Stream
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 }
                },
                audio: false,
            });
            streamRef.current = stream;

            stream.getVideoTracks()[0].onended = () => {
                stopSession();
            };

            // 2. Create Peer Connection
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });
            pcRef.current = pc;

            // Add local stream tracks to PC
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            // 3. Handle ICE Candidates (Send to server)
            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    const headers = await getAuthHeader();
                    await fetch(`${baseApi}/api/remote/sessions/${sessionId}/signaling`, {
                        method: 'PATCH',
                        headers: { ...headers, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ iceCandidate: event.candidate })
                    });
                }
            };

            // 4. Handle incoming DataChannel (Admin inputs)
            pc.ondatachannel = (event) => {
                const dc = event.channel;
                dcRef.current = dc;

                dc.onmessage = async (e) => {
                    try {
                        const msg = JSON.parse(e.data);
                        if (msg.eventType) {
                            await invoke('simulate_input', {
                                eventType: msg.eventType,
                                key: msg.key,
                                x: msg.x,
                                y: msg.y,
                                button: msg.button
                            });
                        }
                    } catch (err) {
                        console.error('DataChannel parse error:', err);
                    }
                };
            };

            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'connected') {
                    setStatus('CONNECTED');
                } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                    stopSession();
                }
            };

            // 5. Set Remote Offer & Create Answer
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // 6. Send Answer to Server
            const headers = await getAuthHeader();
            await fetch(`${baseApi}/api/remote/sessions/${sessionId}/signaling`, {
                method: 'PATCH',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ answer })
            });

            // 7. Start polling for Admin's ICE Candidates
            pollIceCandidates(sessionId, pc, baseApi);

        } catch (err) {
            console.error('Failed to start WebRTC session:', err);
            stopSession();
        }
    }, [getAuthHeader, stopSession, pollIceCandidates]);

    const pollActiveSession = useCallback(async () => {
        if (status !== 'IDLE') return;

        try {
            const headers = await getAuthHeader();
            const baseApi = apiUrl.replace(/\/$/, "");
            const res = await fetch(`${baseApi}/api/agent/remote/active`, { headers });

            if (!res.ok) return;

            const data = await res.json();
            const session = data.data?.session || data.session;

            if (session && session.offer && !session.answer) {
                startSession(session.id, session.offer, baseApi);
            }
        } catch (err) {
            console.error('Failed to poll active sessions:', err);
        }
    }, [status, apiUrl, getAuthHeader, startSession]);

    // Poll for new sessions
    useEffect(() => {
        pollIntervalRef.current = window.setInterval(pollActiveSession, 3000);
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            stopSession();
        };
    }, [pollActiveSession, stopSession]);

    if (status === 'IDLE') return null;

    return (
        <div className="fixed bottom-6 right-6 bg-slate-900 border border-nerve/50 shadow-2xl p-4 rounded-xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
            <div className="relative flex h-4 w-4 shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === 'CONNECTED' ? 'bg-green-400' : 'bg-amber-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-4 w-4 ${status === 'CONNECTED' ? 'bg-green-500' : 'bg-amber-500'}`}></span>
            </div>
            <div>
                <h3 className="text-sm font-semibold text-white">
                    {status === 'CONNECTING' ? 'Negotiating Remote Desktop...' : 'Remote Control Active'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 max-w-[200px] truncate">
                    Session ID: {activeSessionId}
                </p>
            </div>
            <button
                onClick={stopSession}
                className="ml-2 p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Terminate Session"
            >
                <Camera size={18} />
            </button>
        </div>
    );
}

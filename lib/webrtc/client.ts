
import SimplePeer from 'simple-peer';

export interface WebRTCClientConfig {
    sessionId: string;
    isInitiator: boolean;
    stream?: MediaStream;
    iceServers?: RTCIceServer[];
}

export interface ConnectionMetrics {
    latency: number;
    fps: number;
    bandwidth: number;
    packetLoss: number;
}

export class WebRTCClient {
    private peer: SimplePeer.Instance | null = null;
    private sessionId: string;
    private isInitiator: boolean;
    private stream: MediaStream | null = null;
    private metricsInterval: NodeJS.Timeout | null = null;

    // Event callbacks
    public onSignal?: (signal: SimplePeer.SignalData) => void;
    public onConnect?: () => void;
    public onDisconnect?: () => void;
    public onStream?: (stream: MediaStream) => void;
    public onData?: (data: unknown) => void;
    public onError?: (error: Error) => void;
    public onMetrics?: (metrics: ConnectionMetrics) => void;

    constructor(config: WebRTCClientConfig) {
        this.sessionId = config.sessionId;
        this.isInitiator = config.isInitiator;
        this.stream = config.stream || null;

        this.initializePeer(config.iceServers);
    }

    private initializePeer(iceServers?: RTCIceServer[]) {
        // When the browser is the viewer (no local stream) we must still
        // advertise that we want to RECEIVE video, otherwise simple-peer
        // emits an offer with no video m-line and the agent's outbound
        // video track has nothing to attach to — the peer connects (the
        // data channel works) but the `<video>` element stays black and
        // `inbound-rtp` FPS reports 0.
        const wantsRecvOnlyVideo = this.isInitiator && !this.stream;

        const config: SimplePeer.Options = {
            initiator: this.isInitiator,
            trickle: true,
            stream: this.stream || undefined,
            // Pin the data-channel label so the Rust agent's
            // `on_data_channel` handler matches it. The agent filters by
            // `dc.label() == "input"` and silently ignores anything else;
            // simple-peer's default is a random hex string, which the agent
            // would discard, leaving the viewer stuck in "Connecting…" even
            // after ICE+DTLS came up.
            channelName: 'input',
            ...(wantsRecvOnlyVideo
                ? {
                    offerOptions: {
                        offerToReceiveVideo: true,
                        offerToReceiveAudio: false,
                    },
                }
                : {}),
            config: {
                iceServers: iceServers || [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ],
            },
        };

        this.peer = new SimplePeer(config);

        // Set up event listeners
        this.peer.on('signal', (signal) => {
            console.debug('[WebRTC] Signal generated');
            this.onSignal?.(signal);
        });

        this.peer.on('connect', () => {
            console.debug('[WebRTC] Connection established');
            this.onConnect?.();
            this.startMetricsMonitoring();
        });

        this.peer.on('stream', (stream) => {
            console.debug('[WebRTC] Remote stream received (stream event)', stream.id, 'tracks:', stream.getTracks().length);
            this.onStream?.(stream);
        });

        // Fallback — some negotiations (Rust webrtc-rs is one) yield a
        // `track` event without an accompanying `stream` event. Accumulate
        // tracks into a single stream so we don't accidentally replace the
        // video track with an audio track if they arrive separately.
        let fallbackStream: MediaStream | null = null;
        this.peer.on('track', (track: MediaStreamTrack, stream: MediaStream) => {
            console.debug('[WebRTC] Remote track received', track.kind, track.id, 'via stream:', stream?.id ?? '(none)');
            if (stream && stream.getTracks().length > 0) {
                this.onStream?.(stream);
            } else {
                if (!fallbackStream) fallbackStream = new MediaStream();
                // Ensure we don't add the same track twice
                if (!fallbackStream.getTracks().find(t => t.id === track.id)) {
                    fallbackStream.addTrack(track);
                }
                this.onStream?.(fallbackStream);
            }
        });

        this.peer.on('data', (data) => {
            try {
                const parsedData = JSON.parse(data.toString());
                this.onData?.(parsedData);
            } catch (error: unknown) {
                console.error('[WebRTC] Error parsing data:', error);
            }
        });

        this.peer.on('error', (error) => {
            console.error('[WebRTC] Peer error:', error);
            this.onError?.(error);
        });

        this.peer.on('close', () => {
            console.debug('[WebRTC] Connection closed');
            this.onDisconnect?.();
            this.stopMetricsMonitoring();
        });
    }

    public signal(signalData: SimplePeer.SignalData) {
        if (this.peer) {
            this.peer.signal(signalData);
        }
    }

    public sendData(data: unknown) {
        if (this.peer && this.peer.connected) {
            this.peer.send(JSON.stringify(data));
        }
    }

    public async getDisplayMedia(constraints?: DisplayMediaStreamOptions): Promise<MediaStream> {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia(
                constraints || {
                    video: {
                        width: { ideal: 1920, max: 1920 },
                        height: { ideal: 1080, max: 1080 },
                        frameRate: { ideal: 30, max: 60 },
                    },
                    audio: false,
                } as DisplayMediaStreamOptions
            );

            this.stream = stream;

            if (this.peer) {
                this.peer.addStream(stream);
            }

            return stream;
        } catch (error: unknown) {
            console.error('[WebRTC] Error getting display media:', error);
            throw error;
        }
    }

    private startMetricsMonitoring() {
        this.metricsInterval = setInterval(async () => {
            const metrics = await this.getConnectionMetrics();
            if (metrics) {
                this.onMetrics?.(metrics);
            }
        }, 2000); // Update metrics every 2 seconds
    }

    private stopMetricsMonitoring() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
        }
    }

    private async getConnectionMetrics(): Promise<ConnectionMetrics | null> {
        // SimplePeer does not expose `_pc` in its type definitions,
        // but it is the only way to access the underlying RTCPeerConnection.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!this.peer || !(this.peer as any)._pc) {
            return null;
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pc = (this.peer as any)._pc as RTCPeerConnection;
            const stats = await pc.getStats();

            let latency = 0;
            let fps = 0;
            let bandwidth = 0;
            let packetLoss = 0;

            stats.forEach((report) => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    latency = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
                }

                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                    fps = report.framesPerSecond || 0;
                    packetLoss = report.packetsLost || 0;
                }

                if (report.type === 'candidate-pair') {
                    bandwidth = report.availableOutgoingBitrate || 0;
                }
            });

            return {
                latency: Math.round(latency),
                fps: Math.round(fps),
                bandwidth: Math.round(bandwidth / 1000), // Convert to Kbps
                packetLoss: Math.round(packetLoss),
            };
        } catch (error: unknown) {
            console.error('[WebRTC] Error getting connection metrics:', error);
            return null;
        }
    }

    public destroy() {
        this.stopMetricsMonitoring();

        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
        }

        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
    }

    public isConnected(): boolean {
        return this.peer ? this.peer.connected : false;
    }

    /**
     * Returns the underlying RTCPeerConnection, or null if the peer is
     * destroyed. simple-peer keeps it on the private `_pc` field; we surface
     * it so callers can attach `oniceconnectionstatechange` and trigger
     * `restartIce()` without poking at internals from outside the class.
     */
    public getPeerConnection(): RTCPeerConnection | null {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return this.peer ? ((this.peer as any)._pc as RTCPeerConnection | undefined) ?? null : null;
    }

    /**
     * Trigger an ICE restart on the underlying RTCPeerConnection. This is
     * the standard recovery path when `iceConnectionState` transitions to
     * `failed`: the browser allocates fresh ICE credentials, simple-peer
     * emits a new offer via the `signal` event, and the existing signaling
     * pipeline forwards it to the agent. Returns true if a restart was
     * actually issued.
     *
     * Only safe to call on the initiator side — the answerer cannot
     * spontaneously generate a new offer.
     */
    public restartIce(): boolean {
        const pc = this.getPeerConnection();
        if (!pc || !this.isInitiator) return false;
        try {
            // restartIce() is widely supported (Chrome 77+, FF 70+, Safari 14.1+).
            // It sets the next createOffer() to use fresh ufrag/pwd. simple-peer
            // listens for `negotiationneeded` and re-runs createOffer/setLocal,
            // emitting the new offer through the existing `signal` callback.
            pc.restartIce();
            return true;
        } catch (err) {
            console.warn('[WebRTC] restartIce failed', err);
            return false;
        }
    }
}

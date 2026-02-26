
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
        const config: SimplePeer.Options = {
            initiator: this.isInitiator,
            trickle: true,
            stream: this.stream || undefined,
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
            console.debug('[WebRTC] Remote stream received');
            this.onStream?.(stream);
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

    public async getDisplayMedia(constraints?: MediaStreamConstraints): Promise<MediaStream> {
        try {
            const stream = await (navigator.mediaDevices as any).getDisplayMedia(
                constraints || {
                    video: {
                        cursor: 'always',
                        width: { ideal: 1920, max: 1920 },
                        height: { ideal: 1080, max: 1080 },
                        frameRate: { ideal: 30, max: 60 },
                    },
                    audio: false,
                }
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
        if (!this.peer || !(this.peer as any)._pc) {
            return null;
        }

        try {
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
}

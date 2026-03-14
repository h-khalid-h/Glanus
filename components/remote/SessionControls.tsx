'use client';

import { useState } from 'react';

interface SessionControlsProps {
    sessionId: string;
    isRecording: boolean;
    onStartRecording?: () => void;
    onStopRecording?: () => void;
    onQualityChange?: (quality: string) => void;
    onScreenshot?: () => void;
    onFullscreen?: () => void;
    onDisconnect?: () => void;
    duration?: number; // Session duration in seconds
}

export function SessionControls({
    sessionId: _sessionId,
    isRecording,
    onStartRecording,
    onStopRecording,
    onQualityChange,
    onScreenshot,
    onFullscreen,
    onDisconnect,
    duration = 0,
}: SessionControlsProps) {
    const [quality, setQuality] = useState('AUTO');
    const [showQualityMenu, setShowQualityMenu] = useState(false);

    const handleQualityChange = (newQuality: string) => {
        setQuality(newQuality);
        setShowQualityMenu(false);
        onQualityChange?.(newQuality);
    };

    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-lg">
            <div className="flex items-center justify-between gap-4">
                {/* Session Duration */}
                <div className="flex items-center gap-2 text-white">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <span className="font-mono text-sm">{formatDuration(duration)}</span>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center gap-2">
                    {/* Recording Toggle */}
                    <button type="button"
                        onClick={isRecording ? onStopRecording : onStartRecording}
                        className={`btn px-3 py-2 text-sm ${isRecording
                            ? 'bg-destructive hover:bg-destructive/80 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-white'
                            }`}
                        title={isRecording ? 'Stop Recording' : 'Start Recording'}
                    >
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-white animate-pulse' : 'bg-health-critical'}`} />
                            <span>{isRecording ? 'Recording' : 'Record'}</span>
                        </div>
                    </button>

                    {/* Quality Selector */}
                    <div className="relative">
                        <button type="button"
                            onClick={() => setShowQualityMenu(!showQualityMenu)}
                            className="btn bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 text-sm"
                            title="Quality Settings"
                        >
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                                <span>{quality}</span>
                            </div>
                        </button>

                        {showQualityMenu && (
                            <div className="absolute right-0 mt-2 w-32 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden z-10">
                                {['AUTO', 'HIGH', 'MEDIUM', 'LOW'].map((q) => (
                                    <button type="button"
                                        key={q}
                                        onClick={() => handleQualityChange(q)}
                                        className={`w-full px-4 py-2 text-sm text-left hover:bg-slate-700 ${quality === q ? 'bg-slate-700 text-nerve' : 'text-white'
                                            }`}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Screenshot */}
                    <button type="button"
                        onClick={onScreenshot}
                        className="btn bg-slate-800 hover:bg-slate-700 text-white p-2"
                        title="Capture Screenshot"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                        </svg>
                    </button>

                    {/* Fullscreen */}
                    <button type="button"
                        onClick={onFullscreen}
                        className="btn bg-slate-800 hover:bg-slate-700 text-white p-2"
                        title="Toggle Fullscreen"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                            />
                        </svg>
                    </button>

                    {/* Disconnect */}
                    <button type="button"
                        onClick={onDisconnect}
                        className="btn bg-destructive hover:bg-destructive/80 text-white px-3 py-2 text-sm"
                        title="End Session"
                    >
                        Disconnect
                    </button>
                </div>
            </div>
        </div>
    );
}

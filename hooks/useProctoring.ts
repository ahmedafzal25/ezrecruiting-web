/**
 * useProctoring — AI Proctoring Hook for the Procruit Interview Room
 * ===================================================================
 * Encapsulates all client-side proctoring logic:
 *
 * 1. TAB-SWITCH DETECTION — Uses the Page Visibility API (`visibilitychange`)
 *    to detect when the candidate switches away and back.
 *
 * 2. COPY / PASTE DETECTION — Listens for `copy` and `paste` events on
 *    the specified editor container DOM element.
 *
 * 3. WEBCAM FRAME CAPTURE — Grabs JPEG frames from the local <video>
 *    element at ~2 FPS using an OffscreenCanvas, converts to Base64,
 *    and sends over a dedicated WebSocket to the Python proctoring service.
 *
 * 4. GAZE RESULT AGGREGATION — Receives gaze labels from the Python
 *    service and stores them alongside browser events in a timestamped log.
 *
 * 5. LOG FLUSHING — Provides `flushLogs()` to POST the accumulated log
 *    to the Node.js backend for persistence in MongoDB.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { apiRequest } from '../utils/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single proctoring event recorded during an interview. */
export interface ProctoringEvent {
    type: 'tab_switch' | 'copy' | 'paste' | 'gaze' | 'face_lost' | 'screenshot';
    detail: string;
    timestamp: string; // ISO 8601
}

/** Result payload from the Python gaze detection service. */
interface GazeResult {
    type: 'gaze_result';
    gaze: 'center' | 'left' | 'right' | 'up' | 'down' | 'away' | 'unknown';
    face_detected: boolean;
    h_ratio: number | null;
    v_ratio: number | null;
    timestamp: number;
}

/** Configuration options for the proctoring hook. */
interface ProctoringConfig {
    /** The interview/meeting ID (used when flushing logs). */
    interviewId: string;
    /** Ref to the local <video> element for frame capture. */
    videoRef: React.RefObject<HTMLVideoElement | null>;
    /** Ref to the editor container div for copy/paste interception. */
    editorContainerRef: React.RefObject<HTMLDivElement | null>;
    /** Whether proctoring is enabled (should be true only for candidates). */
    enabled: boolean;
    /** Frame capture interval in ms (default: 500 → ~2 FPS). */
    captureIntervalMs?: number;
    /** Socket.IO ref for emitting real-time proctor-event to the server. */
    socketRef?: React.RefObject<Socket | null>;
    /** The interview room / meeting room ID for Socket.IO broadcast scope. */
    roomId?: string;
}

interface UseProctoringProps {
    interviewId: string;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    editorContainerRef: React.RefObject<HTMLDivElement | null>;
    enabled: boolean;
    isVideoOff?: boolean; // If true, pauses frame capture
    captureIntervalMs?: number;
    socketRef: React.RefObject<Socket | null>;
    roomId: string;
}

/** Return value from the useProctoring hook. */
interface ProctoringReturn {
    /** Accumulated proctoring events. */
    events: ProctoringEvent[];
    /** Whether the WebSocket to the Python service is connected. */
    isConnected: boolean;
    /** Flush all accumulated events to the Node.js backend. */
    flushLogs: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * WebSocket URL for the Python proctoring service.
 * In DEV mode we connect directly to port 8001 to avoid noisy Vite proxy
 * ECONNREFUSED errors when the Python service isn't running yet.
 * In production the connection goes through the reverse proxy on the same host.
 */
const PROCTOR_WS_URL =
    import.meta.env.DEV
        ? 'ws://localhost:8001/ws/proctor'
        : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/proctor`;

/** JPEG quality for frame capture (0-1). Lower = smaller payload = faster. */
const JPEG_QUALITY = 0.5;

/** Maximum reconnection attempts before giving up. */
const MAX_RECONNECT_ATTEMPTS = 3;

/** Delay between reconnection attempts (ms). */
const RECONNECT_DELAY_MS = 5000;

/** Grace period before firing face_lost (ms) — face must be continuously absent. */
const FACE_LOST_GRACE_MS = 5000;

/** Cooldown after face_lost fires (ms) — hard lock that ignores ALL face-lost processing. */
const FACE_LOST_COOLDOWN_MS = 20000;

/** Sustained off-center gaze duration (ms) before logging a gaze event. */
const GAZE_SUSTAINED_MS = 3000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProctoring(config: UseProctoringProps): ProctoringReturn {
    const {
        interviewId,
        videoRef,
        editorContainerRef,
        enabled,
        isVideoOff = false,
        captureIntervalMs = 1000,
        socketRef: ioSocketRef,
        roomId,
    } = config;

    // State
    const [isConnected, setIsConnected] = useState(false);

    // Refs (avoid stale closures in event handlers)
    const eventsRef = useRef<ProctoringEvent[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const captureTimerRef = useRef<number | null>(null);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimerRef = useRef<number | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Debounce / cooldown refs for gaze and face_lost events
    const lastGazeDirection = useRef<string>('center');
    const gazeOffCenterSince = useRef<number | null>(null);
    const gazeEventFired = useRef(false); // true if we already logged the sustained gaze
    const lastFaceLostTime = useRef<number>(0);
    const faceLostGraceStart = useRef<number | null>(null); // when face was first lost (grace timer)
    const faceLostCooldownActive = useRef(false); // hard lock — true = ignore all face_lost

    // ── Helper: add an event to the log ──────────────────────────────
    const addEvent = useCallback((type: ProctoringEvent['type'], detail: string) => {
        const event: ProctoringEvent = {
            type,
            detail,
            timestamp: new Date().toISOString(),
        };
        eventsRef.current.push(event);
        console.log(`[Proctor] ✅ EVENT CAPTURED → ${type}: "${detail}" | total events: ${eventsRef.current.length}`);

        // Emit via Socket.IO for real-time relay to the recruiter/interviewer
        const ioSocket = ioSocketRef?.current;
        if (ioSocket && ioSocket.connected && roomId) {
            console.log(`[Proctor] 📡 Emitting proctor-event via Socket.IO → room: ${roomId}, type: ${type}`);
            ioSocket.emit('proctor-event', { type, detail, timestamp: event.timestamp, roomId });
        } else {
            console.log(`[Proctor] ⚠️ Socket.IO not available (connected=${ioSocket?.connected}, roomId=${roomId}) — event stored locally only`);
        }
    }, [ioSocketRef, roomId]);

    // ── WebSocket connection to Python proctoring service ────────────
    const connectWs = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            const ws = new WebSocket(PROCTOR_WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[Proctor] 🟢 WebSocket CONNECTED to Python proctoring service at', PROCTOR_WS_URL);
                setIsConnected(true);
                reconnectAttemptRef.current = 0;
            };

            ws.onmessage = (event) => {
                try {
                    const data: GazeResult = JSON.parse(event.data);
                    if (data.type === 'gaze_result') {
                        const now = Date.now();

                        if (!data.face_detected) {
                            // ── FACE LOST — 5s grace + 20s hard cooldown lock ──

                            // If cooldown is active, check if it has expired
                            if (faceLostCooldownActive.current) {
                                if (now - lastFaceLostTime.current >= FACE_LOST_COOLDOWN_MS) {
                                    faceLostCooldownActive.current = false;
                                    console.log('[Proctor] 🔓 Face-lost cooldown expired — monitoring resumed');
                                } else {
                                    // Still in cooldown — completely ignore this frame
                                    // (do NOT start a grace timer, do NOT fire)
                                }
                            }

                            // Only process if NOT in cooldown
                            if (!faceLostCooldownActive.current) {
                                if (faceLostGraceStart.current === null) {
                                    // First frame with no face — start grace timer
                                    faceLostGraceStart.current = now;
                                    console.log('[Proctor] 👤 Face lost — grace period started (5s)');
                                } else {
                                    const graceElapsed = now - faceLostGraceStart.current;
                                    if (graceElapsed >= FACE_LOST_GRACE_MS) {
                                        // Grace period expired — FIRE the event and LOCK
                                        lastFaceLostTime.current = now;
                                        faceLostCooldownActive.current = true;
                                        faceLostGraceStart.current = null;
                                        addEvent('face_lost', `No face detected for ${(graceElapsed / 1000).toFixed(1)}s`);
                                        console.log(`[Proctor] 🚨 Face lost event fired — 20s hard cooldown lock activated`);
                                    }
                                }
                            }

                            // Reset gaze tracking when face is lost
                            lastGazeDirection.current = 'center';
                            gazeOffCenterSince.current = null;
                            gazeEventFired.current = false;
                        } else if (data.gaze === 'center') {
                            // ── CENTER — reset off-center tracking + face grace ──
                            faceLostGraceStart.current = null; // Face is back — cancel grace
                            if (lastGazeDirection.current !== 'center') {
                                console.log('[Proctor] 👁️ Gaze returned to center');
                            }
                            lastGazeDirection.current = 'center';
                            gazeOffCenterSince.current = null;
                            gazeEventFired.current = false;
                        } else {
                            // ── OFF-CENTER GAZE — sustained detection ──
                            faceLostGraceStart.current = null; // Face detected — cancel grace
                            if (data.gaze !== lastGazeDirection.current) {
                                // Direction changed — reset the sustained timer
                                lastGazeDirection.current = data.gaze;
                                gazeOffCenterSince.current = now;
                                gazeEventFired.current = false;
                                console.log(`[Proctor] 👁️ Gaze direction changed to "${data.gaze}" — starting sustained timer`);
                            } else if (gazeOffCenterSince.current && !gazeEventFired.current) {
                                // Same off-center direction — check if sustained long enough
                                const elapsed = now - gazeOffCenterSince.current;
                                if (elapsed >= GAZE_SUSTAINED_MS) {
                                    gazeEventFired.current = true;
                                    addEvent('gaze', `Sustained gaze: looking ${data.gaze} for ${(elapsed / 1000).toFixed(1)}s (h=${data.h_ratio}, v=${data.v_ratio})`);
                                    console.log(`[Proctor] 🚨 Sustained off-center gaze detected: ${data.gaze} for ${elapsed}ms`);
                                }
                            }
                        }
                    }
                } catch {
                    // Ignore malformed messages
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                console.log('[Proctor] 🔴 WebSocket to Python proctoring service DISCONNECTED');
                // Auto-reconnect
                if (reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttemptRef.current += 1;
                    console.log(`[Proctor] Reconnecting to proctoring service (attempt ${reconnectAttemptRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
                    reconnectTimerRef.current = window.setTimeout(connectWs, RECONNECT_DELAY_MS);
                } else {
                    console.warn('[Proctor] Max reconnect attempts reached. Python proctoring service may not be running on port 8001. Tab-switch and copy/paste detection will still work, but gaze detection is unavailable.');
                }
            };

            ws.onerror = () => {
                console.warn('[Proctor] WebSocket connection error — is the Python proctoring service running on port 8001?');
            };
        } catch (err) {
            console.warn('[Proctor] Failed to create WebSocket:', err);
        }
    }, [addEvent]);

    // ── Frame capture: grab JPEG from <video> and send to Python ─────
    const captureAndSend = useCallback(() => {
        // Pause capture if video is intentionally muted
        if (isVideoOff) return;

        const video = videoRef.current;
        const ws = wsRef.current;

        if (!video || !ws || ws.readyState !== WebSocket.OPEN) return;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        // Create / reuse an offscreen canvas
        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
        }
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        // Strip the "data:image/jpeg;base64," prefix
        const base64 = dataUrl.split(',')[1];

        if (base64) {
            ws.send(JSON.stringify({ type: 'frame', data: base64 }));
        }
    }, [videoRef, isVideoOff]);

    // ── Start / stop frame capture interval ──────────────────────────
    const startCapture = useCallback(() => {
        if (captureTimerRef.current) return;
        captureTimerRef.current = window.setInterval(captureAndSend, captureIntervalMs);
        console.log(`[Proctor] Frame capture started (${captureIntervalMs}ms interval)`);
    }, [captureAndSend, captureIntervalMs]);

    const stopCapture = useCallback(() => {
        if (captureTimerRef.current) {
            clearInterval(captureTimerRef.current);
            captureTimerRef.current = null;
            console.log('[Proctor] Frame capture stopped');
        }
    }, []);

    // ── Main effect: setup all listeners & WebSocket ─────────────────
    useEffect(() => {
        if (!enabled) return;

        console.log('[Proctor] 🔧 Initializing proctoring listeners (enabled=true)');

        // 1. TAB-SWITCH DETECTION (Page Visibility API)
        const handleVisibilityChange = () => {
            if (document.hidden) {
                addEvent('tab_switch', 'Candidate switched away from the interview tab');
            } else {
                addEvent('tab_switch', 'Candidate returned to the interview tab');
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 2. COPY / PASTE DETECTION on the editor container
        const editor = editorContainerRef.current;
        let lastPasteEventTime = 0; // dedup window for paste (native event + keyboard fallback)

        const handleCopy = (e: Event) => {
            addEvent('copy', 'Copy action detected in the coding sandbox');
        };
        const handlePaste = (e: Event) => {
            const now = Date.now();
            if (now - lastPasteEventTime < 500) return; // dedup
            lastPasteEventTime = now;
            addEvent('paste', 'Paste action detected in the coding sandbox');
        };

        // Keyboard fallback: Monaco may swallow native paste events, so
        // we also detect Ctrl+V / Cmd+V at the document level.
        // Also detect screenshot keystrokes (PrintScreen, Cmd+Shift+3/4, Win+Shift+S).
        const handleKeydown = (e: KeyboardEvent) => {
            // ── Paste detection ──
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                const now = Date.now();
                if (now - lastPasteEventTime < 500) return; // dedup
                lastPasteEventTime = now;
                console.log('[Proctor] 📋 Paste detected via keyboard shortcut (Ctrl/Cmd+V)');
                addEvent('paste', 'Paste action detected in the coding sandbox');
            }

            // ── Screenshot detection (aggressive — covers Windows, macOS, Linux) ──
            const key = e.key;
            const isScreenshotKey =
                // Windows: PrintScreen, Alt+PrintScreen
                key === 'PrintScreen' ||
                // Windows: Win+Shift+S (Snipping Tool)
                (e.metaKey && e.shiftKey && key.toLowerCase() === 's') ||
                // Windows: Win+PrintScreen
                (e.metaKey && key === 'PrintScreen') ||
                // macOS: Cmd+Shift+3 (full screen), Cmd+Shift+4 (selection), Cmd+Shift+5 (toolbar)
                (e.metaKey && e.shiftKey && (key === '3' || key === '4' || key === '5')) ||
                // Alt+PrintScreen (Windows active window capture)
                (e.altKey && key === 'PrintScreen') ||
                // Ctrl+PrintScreen (some Linux DEs)
                (e.ctrlKey && key === 'PrintScreen') ||
                // Linux: Ctrl+Shift+PrintScreen (Gnome area screenshot)
                (e.ctrlKey && e.shiftKey && key === 'PrintScreen');

            if (isScreenshotKey) {
                console.log('[Proctor] 📸 SCREENSHOT ATTEMPT DETECTED — key:', key, 'meta:', e.metaKey, 'alt:', e.altKey, 'shift:', e.shiftKey);
                addEvent('screenshot', `Screenshot attempt detected (key: ${key}, meta: ${e.metaKey}, alt: ${e.altKey}, shift: ${e.shiftKey})`);
            }
        };

        if (editor) {
            editor.addEventListener('copy', handleCopy, true);
            editor.addEventListener('paste', handlePaste, true);
        }

        // Also listen on document level as a fallback (Monaco may swallow events)
        document.addEventListener('copy', handleCopy);
        document.addEventListener('paste', handlePaste);
        document.addEventListener('keydown', handleKeydown, true);

        // 3. WebSocket connection + frame capture
        connectWs();
        console.log('[Proctor] 🌐 Connecting to Python proctoring WebSocket...');
        // Small delay to let the video stream initialize before capturing
        const startTimer = window.setTimeout(() => {
            startCapture();
        }, 2000);

        // Cleanup
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);

            if (editor) {
                editor.removeEventListener('copy', handleCopy, true);
                editor.removeEventListener('paste', handlePaste, true);
            }
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('paste', handlePaste);
            document.removeEventListener('keydown', handleKeydown, true);

            clearTimeout(startTimer);
            stopCapture();

            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [enabled, addEvent, connectWs, startCapture, stopCapture, editorContainerRef]);

    // ── Flush logs to Node.js backend ────────────────────────────────
    const flushLogs = useCallback(async () => {
        const events = [...eventsRef.current];
        if (events.length === 0) {
            console.log('[Proctor] 📋 No events to flush — log is empty.');
            return;
        }

        console.log(`[Proctor] 📤 Flushing ${events.length} events to backend for interview: ${interviewId}`);
        try {
            const result = await apiRequest(`/interviews/${interviewId}/proctor-log`, 'POST', { events });
            console.log(`[Proctor] ✅ Flushed ${events.length} events to backend. Server confirmed: saved=${result?.saved}, total=${result?.total}`);
            eventsRef.current = []; // Clear after successful flush
        } catch (err) {
            console.error('[Proctor] ❌ Failed to flush events:', err);
        }
    }, [interviewId]);

    return {
        events: eventsRef.current,
        isConnected,
        flushLogs,
    };
}

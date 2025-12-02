"use client";

import { useEffect, useRef, useState } from "react";
import type { CropBoxPx } from "./useCamera";

type Landmark = { x: number; y: number; z: number };

function clamp01(v: number) {
    return Math.max(0, Math.min(1, v));
}

export function useHandTracking(
    videoRef: React.RefObject<HTMLVideoElement>,
    overlayCanvasRef: React.RefObject<HTMLCanvasElement>,
    enabled: boolean
) {
    const [handDetected, setHandDetected] = useState(false);
    const [handStable, setHandStable] = useState(false);

    // bbox en pixeles del frame (para recortar y enviar al backend)
    const boxPxRef = useRef<CropBoxPx | null>(null);

    const rafRef = useRef<number | null>(null);
    const landmarkerRef = useRef<any>(null);

    const prevCenterRef = useRef<{ x: number; y: number } | null>(null);
    const stableFramesRef = useRef(0);

    const lastDetectedRef = useRef(false);
    const lastStableRef = useRef(false);

    const tsRef = useRef(0);

    useEffect(() => {
        if (!enabled) {
            setHandDetected(false);
            setHandStable(false);
            boxPxRef.current = null;
            prevCenterRef.current = null;
            stableFramesRef.current = 0;
            tsRef.current = 0;

            // limpia overlay
            const c = overlayCanvasRef.current;
            if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
            return;
        }

        const video = videoRef.current;
        const overlay = overlayCanvasRef.current;
        if (!video || !overlay) return;

        let cancelled = false;

        const setup = async () => {
            const mp = await import("@mediapipe/tasks-vision");
            const { FilesetResolver, HandLandmarker } = mp;

            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );

            landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                },
                runningMode: "VIDEO",
                numHands: 1,
                minHandDetectionConfidence: 0.7,
                minHandPresenceConfidence: 0.7,
                minTrackingConfidence: 0.7,
            });

            const MOVE_THRESHOLD = 0.01;
            const STABLE_FRAMES_NEEDED = 15;

            const loop = () => {
                if (cancelled) return;

                // guards
                if (
                    video.readyState < 2 ||
                    video.videoWidth === 0 ||
                    video.videoHeight === 0 ||
                    !landmarkerRef.current
                ) {
                    rafRef.current = requestAnimationFrame(loop);
                    return;
                }

                // sync canvas con tamaño visual (para overlay nítido)
                const dpr = window.devicePixelRatio || 1;
                const cw = Math.max(1, Math.floor(video.clientWidth * dpr));
                const ch = Math.max(1, Math.floor(video.clientHeight * dpr));
                if (overlay.width !== cw || overlay.height !== ch) {
                    overlay.width = cw;
                    overlay.height = ch;
                }

                const ctx = overlay.getContext("2d");
                if (!ctx) {
                    rafRef.current = requestAnimationFrame(loop);
                    return;
                }

                // timestamp monotónico
                const now = Math.floor(performance.now());
                tsRef.current = Math.max(tsRef.current + 1, now);

                let results: any;
                try {
                    results = landmarkerRef.current.detectForVideo(video, tsRef.current);
                } catch {
                    rafRef.current = requestAnimationFrame(loop);
                    return;
                }

                const lm: Landmark[] | undefined = results?.landmarks?.[0];
                const hasHand = !!lm?.length;

                // limpia overlay
                ctx.clearRect(0, 0, overlay.width, overlay.height);

                if (!hasHand) {
                    boxPxRef.current = null;
                    prevCenterRef.current = null;
                    stableFramesRef.current = 0;

                    if (lastDetectedRef.current !== false) {
                        lastDetectedRef.current = false;
                        setHandDetected(false);
                    }
                    if (lastStableRef.current !== false) {
                        lastStableRef.current = false;
                        setHandStable(false);
                    }

                    rafRef.current = requestAnimationFrame(loop);
                    return;
                }

                if (lastDetectedRef.current !== true) {
                    lastDetectedRef.current = true;
                    setHandDetected(true);
                }

                // bbox normalizado (0..1)
                let minX = 1, minY = 1, maxX = 0, maxY = 0;
                for (const p of lm!) {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                }

                // padding alrededor de la mano (ajustable)
                const pad = 0.12;
                const w = maxX - minX;
                const h = maxY - minY;
                minX = clamp01(minX - w * pad);
                minY = clamp01(minY - h * pad);
                maxX = clamp01(maxX + w * pad);
                maxY = clamp01(maxY + h * pad);

                // centro para estabilidad
                const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
                const prev = prevCenterRef.current;
                prevCenterRef.current = center;

                if (!prev) {
                    stableFramesRef.current = 0;
                    if (lastStableRef.current !== false) {
                        lastStableRef.current = false;
                        setHandStable(false);
                    }
                } else {
                    const dx = center.x - prev.x;
                    const dy = center.y - prev.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < MOVE_THRESHOLD) stableFramesRef.current += 1;
                    else stableFramesRef.current = 0;

                    const isStable = stableFramesRef.current >= STABLE_FRAMES_NEEDED;
                    if (lastStableRef.current !== isStable) {
                        lastStableRef.current = isStable;
                        setHandStable(isStable);
                    }
                }

                // guarda bbox en pixeles del frame (para recortar)
                boxPxRef.current = {
                    x: minX * video.videoWidth,
                    y: minY * video.videoHeight,
                    width: (maxX - minX) * video.videoWidth,
                    height: (maxY - minY) * video.videoHeight,
                };

                // dibuja rectángulo en overlay (coordenadas de pantalla)
                const sx = video.clientWidth;
                const sy = video.clientHeight;

                const rx = minX * sx;
                const ry = minY * sy;
                const rw = (maxX - minX) * sx;
                const rh = (maxY - minY) * sy;

                // en canvas usamos dpr
                ctx.lineWidth = 3 * dpr;
                ctx.strokeStyle = lastStableRef.current ? "#22c55e" : "#f59e0b"; // verde estable / naranja moviendo
                ctx.strokeRect(rx * dpr, ry * dpr, rw * dpr, rh * dpr);

                rafRef.current = requestAnimationFrame(loop);
            };

            rafRef.current = requestAnimationFrame(loop);
        };

        void setup();

        return () => {
            cancelled = true;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;

            boxPxRef.current = null;
            prevCenterRef.current = null;
            stableFramesRef.current = 0;
            tsRef.current = 0;
            lastDetectedRef.current = false;
            lastStableRef.current = false;

            try {
                landmarkerRef.current?.close?.();
            } catch { }
            landmarkerRef.current = null;

            const c = overlayCanvasRef.current;
            if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
        };
    }, [enabled, videoRef, overlayCanvasRef]);

    return { handDetected, handStable, boxPxRef };
}

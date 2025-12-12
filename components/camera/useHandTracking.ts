"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type React from "react";
import type { CropBoxNorm } from "./useCamera";

export type CropBoxPx = {
    x: number;
    y: number;
    width: number;
    height: number;
};

// ROI por defecto (el mismo que usas en HomePage/Training)
const DEFAULT_ROI_NORM: CropBoxNorm = {
    x: 0.2,
    y: 0.125,
    width: 0.6,
    height: 0.75,
};

/**
 * Hook "manual" (sin IA):
 * - No detecta manos.
 * - Solo calcula una caja ROI fija en píxeles para recortar.
 * - Mantiene compatibilidad con el API anterior (handDetected/handStable/handSessionId/boxPxRef).
 *
 * Usa `markCaptured()` cuando el usuario capture para incrementar sessionId.
 */
export function useHandTracking(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>,
    enabled: boolean,
    roiNorm: CropBoxNorm = DEFAULT_ROI_NORM
) {
    const [handDetected, setHandDetected] = useState(false);
    const [handStable, setHandStable] = useState(false);
    const [handSessionId, setHandSessionId] = useState(0);

    // bbox en pixeles del frame (para recortar y enviar al backend)
    const boxPxRef = useRef<CropBoxPx | null>(null);

    const rafRef = useRef<number | null>(null);

    const roi = useMemo(() => roiNorm, [roiNorm.x, roiNorm.y, roiNorm.width, roiNorm.height]);

    const clearOverlay = useCallback(() => {
        const c = overlayCanvasRef.current;
        if (!c) return;
        const ctx = c.getContext("2d");
        ctx?.clearRect(0, 0, c.width, c.height);
    }, [overlayCanvasRef]);

    // Llamar cuando el usuario realmente capture (para "nueva sesión")
    const markCaptured = useCallback(() => {
        setHandSessionId((s) => s + 1);
    }, []);

    useEffect(() => {
        if (!enabled) {
            setHandDetected(false);
            setHandStable(false);
            boxPxRef.current = null;

            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;

            clearOverlay();
            return;
        }

        const video = videoRef.current;
        if (!video) return;

        let cancelled = false;

        const loop = () => {
            if (cancelled) return;

            // Si el vídeo no está listo, reintenta
            if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
                setHandDetected(false);
                setHandStable(false);
                boxPxRef.current = null;

                rafRef.current = requestAnimationFrame(loop);
                return;
            }

            // "Detectado/estable" significa: cámara lista para capturar
            setHandDetected(true);
            setHandStable(true);

            // ROI fijo en píxeles del frame
            const x = roi.x * video.videoWidth;
            const y = roi.y * video.videoHeight;
            const w = roi.width * video.videoWidth;
            const h = roi.height * video.videoHeight;

            boxPxRef.current = { x, y, width: w, height: h };

            // Limpia overlay (ya no dibujamos bbox dinámica)
            clearOverlay();

            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);

        return () => {
            cancelled = true;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;

            boxPxRef.current = null;
            clearOverlay();
        };
    }, [enabled, videoRef, clearOverlay, roi]);

    return { handDetected, handStable, handSessionId, boxPxRef, markCaptured };
}

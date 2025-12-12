"use client";

import { useEffect, useRef } from "react";
import type React from "react";
import type { CropBoxNorm } from "./useCamera";

export function useCropPreview(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    previewCanvasRef: React.RefObject<HTMLCanvasElement | null>,
    boxNorm: CropBoxNorm,
    enabled: boolean
) {
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        const canvas = previewCanvasRef.current;

        if (!enabled) {
            if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const video = videoRef.current;
        if (!video || !canvas) return;

        let cancelled = false;

        const loop = () => {
            if (cancelled) return;

            const ctx = canvas.getContext("2d");
            if (!ctx || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
                rafRef.current = requestAnimationFrame(loop);
                return;
            }

            // tamaño fijo de preview (nítido)
            const dpr = window.devicePixelRatio || 1;
            const size = 220; // px CSS
            const cw = Math.floor(size * dpr);
            const ch = Math.floor(size * dpr);
            if (canvas.width !== cw || canvas.height !== ch) {
                canvas.width = cw;
                canvas.height = ch;
            }
            canvas.style.width = `${size}px`;
            canvas.style.height = `${size}px`;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Convertimos ROI normalizado a pixeles (relativo al video REAL)
            const x = Math.round(boxNorm.x * video.videoWidth);
            const y = Math.round(boxNorm.y * video.videoHeight);
            const w = Math.round(boxNorm.width * video.videoWidth);
            const h = Math.round(boxNorm.height * video.videoHeight);

            // clamp de seguridad
            const cx = Math.max(0, Math.min(x, video.videoWidth - 1));
            const cy = Math.max(0, Math.min(y, video.videoHeight - 1));
            const cw2 = Math.max(1, Math.min(w, video.videoWidth - cx));
            const ch2 = Math.max(1, Math.min(h, video.videoHeight - cy));

            // Dibujamos el recorte escalado al cuadrado del preview
            ctx.drawImage(video, cx, cy, cw2, ch2, 0, 0, canvas.width, canvas.height);

            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);

        return () => {
            cancelled = true;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
        };
    }, [
        enabled,
        videoRef,
        previewCanvasRef,
        boxNorm.x,
        boxNorm.y,
        boxNorm.width,
        boxNorm.height,
    ]);
}

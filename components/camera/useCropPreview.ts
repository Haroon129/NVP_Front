"use client";

import { useEffect, useRef } from "react";
import type { CropBoxPx } from "./useCamera";

export function useCropPreview(
    videoRef: React.RefObject<HTMLVideoElement>,
    previewCanvasRef: React.RefObject<HTMLCanvasElement>,
    boxPxRef: React.RefObject<CropBoxPx | null>,
    enabled: boolean
) {
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (!enabled) {
            const c = previewCanvasRef.current;
            if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
            return;
        }

        const video = videoRef.current;
        const canvas = previewCanvasRef.current;
        if (!video || !canvas) return;

        let cancelled = false;

        const loop = () => {
            if (cancelled) return;

            const ctx = canvas.getContext("2d");
            if (!ctx || video.readyState < 2 || video.videoWidth === 0) {
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

            const box = boxPxRef.current;
            if (!box) {
                // placeholder
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = "#000";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.globalAlpha = 1;
                rafRef.current = requestAnimationFrame(loop);
                return;
            }

            // recorte y escalado al cuadrado
            const x = Math.max(0, Math.min(box.x, video.videoWidth - 1));
            const y = Math.max(0, Math.min(box.y, video.videoHeight - 1));
            const w = Math.max(1, Math.min(box.width, video.videoWidth - x));
            const h = Math.max(1, Math.min(box.height, video.videoHeight - y));

            ctx.drawImage(video, x, y, w, h, 0, 0, canvas.width, canvas.height);

            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);

        return () => {
            cancelled = true;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
        };
    }, [enabled, videoRef, previewCanvasRef, boxPxRef]);
}
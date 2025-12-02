"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type CropBoxPx = { x: number; y: number; width: number; height: number };

export function useCamera() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isTakingPhoto, setIsTakingPhoto] = useState(false);

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" },
                audio: false,
            });

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setIsCameraOn(true);
        } catch (error) {
            console.error("Error al encender la cámara:", error);
            alert("No se pudo acceder a la cámara. Revisa los permisos.");
        }
    }, []);

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setIsCameraOn(false);
    }, []);

    const capturePhoto = useCallback(async (): Promise<Blob | null> => {
        if (!videoRef.current) return null;

        setIsTakingPhoto(true);
        const video = videoRef.current;

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    setIsTakingPhoto(false);
                    resolve(blob);
                },
                "image/jpeg",
                0.9
            );
        });
    }, []);

    const captureCroppedPhoto = useCallback(
        async (box: CropBoxPx | null, maxDim = 512): Promise<Blob | null> => {
            if (!videoRef.current) return null;

            // fallback: si no hay box, manda frame completo
            if (!box || box.width <= 1 || box.height <= 1) return capturePhoto();

            setIsTakingPhoto(true);
            const video = videoRef.current;

            const srcW = video.videoWidth || 640;
            const srcH = video.videoHeight || 480;

            // clamp por seguridad
            const x = Math.max(0, Math.min(box.x, srcW - 1));
            const y = Math.max(0, Math.min(box.y, srcH - 1));
            const w = Math.max(1, Math.min(box.width, srcW - x));
            const h = Math.max(1, Math.min(box.height, srcH - y));

            const scale = Math.min(1, maxDim / Math.max(w, h));
            const outW = Math.max(1, Math.round(w * scale));
            const outH = Math.max(1, Math.round(h * scale));

            const canvas = document.createElement("canvas");
            canvas.width = outW;
            canvas.height = outH;

            const ctx = canvas.getContext("2d");
            if (!ctx) return null;

            ctx.drawImage(video, x, y, w, h, 0, 0, outW, outH);

            return new Promise((resolve) => {
                canvas.toBlob(
                    (blob) => {
                        setIsTakingPhoto(false);
                        resolve(blob);
                    },
                    "image/jpeg",
                    0.9
                );
            });
        },
        [capturePhoto]
    );

    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, []);

    return {
        videoRef,
        isCameraOn,
        isTakingPhoto,
        startCamera,
        stopCamera,
        capturePhoto,
        captureCroppedPhoto,
    };
}

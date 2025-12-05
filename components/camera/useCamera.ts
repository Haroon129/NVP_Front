"use client";

import { useCallback, useRef, useState } from "react";

export type CropBoxNorm = {
    x: number;      // 0..1 (izquierda)
    y: number;      // 0..1 (arriba)
    width: number;  // 0..1
    height: number; // 0..1
};

export function useCamera() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [isCameraOn, setIsCameraOn] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startCamera = useCallback(async () => {
        try {
            setError(null);

            if (streamRef.current) {
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                },
                audio: false,
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            setIsCameraOn(true);
        } catch (err: any) {
            console.error("Error al activar la cámara", err);
            setError("No se pudo acceder a la cámara. Revisa los permisos del navegador.");
            setIsCameraOn(false);
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraOn(false);
    }, []);

    const capturePhotoInBox = useCallback(
        async (box: CropBoxNorm): Promise<Blob | null> => {
            const video = videoRef.current;
            if (!video) {
                console.warn("No hay referencia de vídeo para capturar.");
                return null;
            }
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                console.warn("El vídeo aún no está listo para capturar.");
                return null;
            }

            const sx = box.x * video.videoWidth;
            const sy = box.y * video.videoHeight;
            const sw = box.width * video.videoWidth;
            const sh = box.height * video.videoHeight;

            const canvas = document.createElement("canvas");
            canvas.width = sw;
            canvas.height = sh;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                console.warn("No se pudo obtener el contexto 2D del canvas.");
                return null;
            }

            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

            return new Promise<Blob | null>((resolve) => {
                canvas.toBlob(
                    (blob) => {
                        resolve(blob);
                    },
                    "image/jpeg",
                    0.9
                );
            });
        },
        []
    );

    return {
        videoRef,
        isCameraOn,
        error,
        startCamera,
        stopCamera,
        capturePhotoInBox,
    };
}

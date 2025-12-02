"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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

    useEffect(() => {
        return () => {
            // limpiar al desmontar
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
    };
}
